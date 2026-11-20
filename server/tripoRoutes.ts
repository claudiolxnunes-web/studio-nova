/**
 * Tripo 3D generation provider.
 *
 * Text prompt -> task_id -> poll /v3/tasks/{id} -> download GLB and preview
 * image before the signed URLs expire (5 minutes). Files are served from
 * data/tripo/ so the browser can preview them with model-viewer.
 */
import type { Express, Request, Response } from "express";
import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { ensureDataDir, readConfig, writeConfig, type StudioConfig } from "./studioConfig";

const TRIPO_BASE =
  process.env.TRIPO_API_BASE || "https://openapi.tripo3d.ai/v3";

interface TripoJob {
  taskId: string;
  status: string;
  progress: number;
  modelUrl?: string;
  previewUrl?: string;
  remoteModelUrl?: string;
  error?: string;
  updatedAt: number;
}

const jobs = new Map<string, TripoJob>();

function tripoDir(): string {
  return path.resolve(process.cwd(), "data", "tripo");
}

function apiKey(config: StudioConfig): string {
  return config.tripoKey || process.env.TRIPO_API_KEY || "";
}

function tripoStatus(config: StudioConfig) {
  const key = apiKey(config);
  return {
    configured: Boolean(key),
    model: config.tripoModel || "v3.1-20260211",
    message: key
      ? "Tripo conectado. Cada modelo consome créditos da sua conta (1 crédito = US$ 0,01)."
      : "Cole a chave da Tripo API em Ajustes para gerar modelos 3D.",
  };
}

async function tripoFetch(
  config: StudioConfig,
  pathname: string,
  init: RequestInit = {},
  timeoutMs = 30_000,
): Promise<globalThis.Response> {
  const key = apiKey(config);
  if (!key) throw new Error("Configure a chave da Tripo API em Ajustes.");
  return fetch(`${TRIPO_BASE}${pathname.startsWith("/") ? pathname : `/${pathname}`}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

function errorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "A Tripo recusou o trabalho.";
  const record = payload as {
    message?: string;
    error?: string | { message?: string; code?: number };
    code?: number;
  };
  if (typeof record.error === "string") return record.error;
  if (record.error && typeof record.error === "object" && record.error.message) {
    return record.error.message;
  }
  return record.message ?? "A Tripo recusou o trabalho.";
}

function extensionFor(url: string, fallback: string): string {
  try {
    const pathname = new URL(url).pathname;
    const extension = path.extname(pathname).replace(".", "").toLowerCase();
    if (/^(glb|gltf|fbx|obj|usdz|png|jpe?g|webp)$/.test(extension)) return extension;
  } catch {
    /* ignore */
  }
  return fallback;
}

async function downloadToFile(url: string, fallbackExtension: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) {
    throw new Error(`Não consegui baixar o arquivo da Tripo (${response.status}).`);
  }
  await ensureDataDir();
  await fs.mkdir(tripoDir(), { recursive: true });
  const extension = extensionFor(url, fallbackExtension);
  const name = `${crypto.randomBytes(9).toString("hex")}.${extension}`;
  await fs.writeFile(
    path.join(tripoDir(), name),
    Buffer.from(await response.arrayBuffer()),
  );
  return name;
}

export function registerTripoRoutes(app: Express): void {
  app.get("/api/tripo/status", async (_req: Request, res: Response) => {
    try {
      res.json(tripoStatus(await readConfig()));
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/tripo/config", async (req: Request, res: Response) => {
    const { key, model } = req.body ?? {};
    try {
      const config = await writeConfig({
        tripoKey: typeof key === "string" ? key : undefined,
        tripoModel: typeof model === "string" ? model : undefined,
      });
      res.json(tripoStatus(config));
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/tripo/text-to-3d", async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as {
      prompt?: string;
      model?: string;
      textureQuality?: string;
      geometryQuality?: string;
      faceLimit?: number;
    };
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (prompt.length < 5) {
      res.status(400).json({
        error: "Descreva o objeto 3D com pelo menos 5 caracteres.",
      });
      return;
    }
    if (prompt.length > 1024) {
      res.status(400).json({ error: "O prompt do Tripo aceita até 1024 caracteres." });
      return;
    }

    try {
      const config = await readConfig();
      const model = body.model?.trim() || config.tripoModel || "v3.1-20260211";
      const textureQuality = ["fast", "standard", "detailed"].includes(
        body.textureQuality ?? "",
      )
        ? body.textureQuality
        : "standard";
      const geometryQuality = body.geometryQuality === "detailed" ? "detailed" : "standard";
      const faceLimit =
        typeof body.faceLimit === "number" && Number.isFinite(body.faceLimit)
          ? Math.max(1000, Math.min(2_000_000, Math.round(body.faceLimit)))
          : undefined;

      const response = await tripoFetch(config, "/generation/text-to-model", {
        method: "POST",
        body: JSON.stringify({
          prompt,
          model,
          texture: true,
          pbr: true,
          texture_quality: textureQuality,
          geometry_quality: geometryQuality,
          ...(faceLimit ? { face_limit: faceLimit } : {}),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        code?: number;
        data?: { task_id?: string };
      };
      if (!response.ok || payload.code !== 0 || !payload.data?.task_id) {
        res.status(502).json({ error: errorMessage(payload) });
        return;
      }

      const taskId = payload.data.task_id;
      jobs.set(taskId, {
        taskId,
        status: "queued",
        progress: 0,
        updatedAt: Date.now(),
      });
      res.json({ taskId, model });
    } catch (error) {
      console.error("[Tripo]", error);
      res.status(502).json({ error: (error as Error).message });
    }
  });

  app.get("/api/tripo/tasks/:id", async (req: Request, res: Response) => {
    const taskId = req.params.id;
    const cached = jobs.get(taskId);
    if (cached?.status === "success") {
      res.json(cached);
      return;
    }

    try {
      const config = await readConfig();
      const response = await tripoFetch(
        config,
        `/tasks/${encodeURIComponent(taskId)}`,
        {},
        30_000,
      );
      const payload = (await response.json().catch(() => ({}))) as {
        code?: number;
        data?: {
          task_id?: string;
          status?: string;
          progress?: number;
          output?: {
            model_url?: string;
            rendered_image_url?: string;
            pbr_model?: string;
            base_model?: string;
            preview_image_url?: string;
          };
        };
      };
      if (!response.ok || payload.code !== 0 || !payload.data) {
        res.status(502).json({ error: errorMessage(payload) });
        return;
      }

      const data = payload.data;
      const status = data.status ?? "queued";
      const progress = typeof data.progress === "number" ? data.progress : 0;
      const job: TripoJob = {
        taskId,
        status,
        progress,
        updatedAt: Date.now(),
      };

      if (["failed", "cancelled", "banned", "expired"].includes(status)) {
        job.error = "A Tripo não conseguiu gerar este modelo.";
        jobs.set(taskId, job);
        res.json(job);
        return;
      }

      if (status === "success") {
        const modelUrl =
          data.output?.model_url ??
          data.output?.pbr_model ??
          data.output?.base_model ??
          "";
        const previewUrl =
          data.output?.rendered_image_url ??
          data.output?.preview_image_url ??
          "";
        job.status = "success";
        job.progress = 100;

        if (modelUrl) {
          try {
            const name = await downloadToFile(modelUrl, "glb");
            job.modelUrl = `/api/tripo/files/${name}`;
          } catch (error) {
            job.remoteModelUrl = modelUrl;
            job.error = `O modelo foi gerado, mas o download local falhou: ${
              (error as Error).message
            }`;
          }
        }
        if (previewUrl) {
          try {
            const name = await downloadToFile(previewUrl, "png");
            job.previewUrl = `/api/tripo/files/${name}`;
          } catch {
            /* preview is optional */
          }
        }
        jobs.set(taskId, job);
        res.json(job);
        return;
      }

      jobs.set(taskId, job);
      res.json(job);
    } catch (error) {
      console.error("[Tripo task]", error);
      res.status(502).json({ error: (error as Error).message });
    }
  });

  app.get("/api/tripo/files/:name", async (req: Request, res: Response) => {
    const name = path.basename(req.params.name);
    if (
      !/^[a-f0-9]+\.(glb|gltf|fbx|obj|usdz|png|jpe?g|webp)$/i.test(name)
    ) {
      res.status(400).end();
      return;
    }
    try {
      const file = path.join(tripoDir(), name);
      const stat = await fs.stat(file);
      const extension = path.extname(name).toLowerCase();
      const mime =
        extension === ".glb" || extension === ".gltf"
          ? "model/gltf-binary"
          : extension === ".fbx"
            ? "application/octet-stream"
            : extension === ".obj"
              ? "text/plain"
              : extension === ".usdz"
                ? "model/vnd.usdz+zip"
                : extension === ".jpg" || extension === ".jpeg"
                  ? "image/jpeg"
                  : extension === ".webp"
                    ? "image/webp"
                    : "image/png";
      res.setHeader("Content-Type", mime);
      res.setHeader("Content-Length", String(stat.size));
      res.setHeader("Cache-Control", "public, max-age=3600");
      const stream = createReadStream(file);
      stream.on("error", () => res.destroy());
      stream.pipe(res);
    } catch {
      res.status(404).end();
    }
  });
}
