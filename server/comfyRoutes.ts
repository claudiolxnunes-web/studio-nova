/**
 * ComfyUI integration.
 *
 * The browser never talks to port 8188 directly: this server proxies the
 * ComfyUI REST API, injects prompt/seed/size into either a standard SDXL graph
 * or a user-supplied workflow exported with "Save (API Format)", polls the
 * history endpoint and stores the resulting media under data/comfy/.
 */
import type { Express, Request, Response } from "express";
import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {
  ensureDataDir,
  readConfig,
  writeConfig,
  type StudioConfig,
} from "./studioConfig";

export interface ComfyWorkflowValues {
  PROMPT: string;
  NEGATIVE: string;
  SEED: number;
  WIDTH: number;
  HEIGHT: number;
  STEPS: number;
  CFG: number;
  CHECKPOINT: string;
}

export interface ComfyImageInput {
  prompt: string;
  negative?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
  checkpoint?: string;
}

function comfyDir(): string {
  return path.resolve(process.cwd(), "data", "comfy");
}

function baseUrl(config: StudioConfig): string {
  return config.comfyUrl.replace(/\/+$/, "");
}

function headers(config: StudioConfig, extra: Record<string, string> = {}) {
  return {
    Accept: "application/json",
    ...(config.comfyToken
      ? {
          Authorization: `Bearer ${config.comfyToken}`,
          "X-API-Key": config.comfyToken,
        }
      : {}),
    ...extra,
  };
}

async function comfyFetch(
  config: StudioConfig,
  pathname: string,
  init: RequestInit = {},
  timeoutMs = 20_000,
): Promise<globalThis.Response> {
  const base = baseUrl(config);
  if (!/^https?:\/\//i.test(base)) {
    throw new Error("A URL do ComfyUI precisa começar com http:// ou https://");
  }
  return fetch(`${base}${pathname.startsWith("/") ? pathname : `/${pathname}`}`, {
    ...init,
    headers: headers(config, (init.headers as Record<string, string>) ?? {}),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

function clampInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
  step = 1,
): number {
  const number = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const rounded = Math.round(number / step) * step;
  return Math.max(min, Math.min(max, rounded));
}

/** Standard SDXL/text-to-image graph. Node IDs match the usual ComfyUI export. */
export function buildTextToImageWorkflow(
  values: ComfyWorkflowValues,
): Record<string, unknown> {
  return {
    "3": {
      class_type: "KSampler",
      inputs: {
        seed: values.SEED,
        steps: values.STEPS,
        cfg: values.CFG,
        sampler_name: "euler",
        scheduler: "normal",
        denoise: 1,
        model: ["4", 0],
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: ["5", 0],
      },
    },
    "4": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: values.CHECKPOINT },
    },
    "5": {
      class_type: "EmptyLatentImage",
      inputs: {
        width: values.WIDTH,
        height: values.HEIGHT,
        batch_size: 1,
      },
    },
    "6": {
      class_type: "CLIPTextEncode",
      inputs: { text: values.PROMPT, clip: ["4", 1] },
    },
    "7": {
      class_type: "CLIPTextEncode",
      inputs: { text: values.NEGATIVE, clip: ["4", 1] },
    },
    "8": {
      class_type: "VAEDecode",
      inputs: { samples: ["3", 0], vae: ["4", 2] },
    },
    "9": {
      class_type: "SaveImage",
      inputs: { filename_prefix: "studio-nova", images: ["8", 0] },
    },
  };
}

/**
 * Replaces {{PROMPT}}, {{NEGATIVE}}, {{SEED}}, {{WIDTH}}, {{HEIGHT}},
 * {{STEPS}}, {{CFG}} and {{CHECKPOINT}} in an exported API workflow.
 */
export function applyWorkflowPlaceholders(
  input: unknown,
  values: ComfyWorkflowValues,
): unknown {
  const replacements: Record<string, string | number> = {
    "{{PROMPT}}": values.PROMPT,
    "{{NEGATIVE}}": values.NEGATIVE,
    "{{SEED}}": values.SEED,
    "{{WIDTH}}": values.WIDTH,
    "{{HEIGHT}}": values.HEIGHT,
    "{{STEPS}}": values.STEPS,
    "{{CFG}}": values.CFG,
    "{{CHECKPOINT}}": values.CHECKPOINT,
  };

  const replace = (value: unknown): unknown => {
    if (typeof value === "string") {
      const exact = replacements[value.trim()];
      if (exact !== undefined) return exact;
      return Object.entries(replacements).reduce(
        (text, [token, replacement]) =>
          text.replaceAll(token, String(replacement)),
        value,
      );
    }
    if (Array.isArray(value)) return value.map(replace);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [
          key,
          replace(item),
        ]),
      );
    }
    return value;
  };

  return replace(input);
}

function parseWorkflow(
  raw: string,
  values: ComfyWorkflowValues,
): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("O workflow do ComfyUI não é um JSON válido.");
  }
  const replaced = applyWorkflowPlaceholders(parsed, values);
  if (!replaced || typeof replaced !== "object" || Array.isArray(replaced)) {
    throw new Error("O workflow precisa ser um objeto JSON de nós.");
  }
  const record = replaced as Record<string, unknown>;
  // Accept both the plain API graph and a { prompt: { ... } } wrapper.
  if (
    record.prompt &&
    typeof record.prompt === "object" &&
    !Array.isArray(record.prompt)
  ) {
    return record.prompt as Record<string, unknown>;
  }
  return record;
}

function comfyError(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "O ComfyUI recusou o trabalho.";
  const data = payload as {
    error?: { message?: string; type?: string; details?: string };
    node_errors?: Record<string, { errors?: Array<{ message?: string }> }>;
    message?: string;
  };
  const base =
    data.error?.message ??
    data.error?.details ??
    data.message ??
    "O ComfyUI recusou o trabalho.";
  const nodes = Object.values(data.node_errors ?? {})
    .flatMap(node => node.errors ?? [])
    .map(error => error.message)
    .filter(Boolean)
    .join(" · ");
  return nodes ? `${base} (${nodes})` : base;
}

interface ComfyOutputFile {
  filename: string;
  subfolder?: string;
  type?: string;
}

function findOutputFile(outputs: unknown): ComfyOutputFile | null {
  if (!outputs || typeof outputs !== "object") return null;
  for (const node of Object.values(outputs as Record<string, unknown>)) {
    if (!node || typeof node !== "object") continue;
    const record = node as Record<string, unknown>;
    for (const key of ["images", "gifs", "videos"]) {
      const value = record[key];
      if (Array.isArray(value) && value.length > 0) {
        const first = value[0] as Partial<ComfyOutputFile>;
        if (typeof first.filename === "string") {
          return {
            filename: first.filename,
            subfolder: first.subfolder,
            type: first.type ?? "output",
          };
        }
      }
    }
  }
  return null;
}

function extensionFor(filename: string, mime: string): string {
  const fromName = path.extname(filename).replace(".", "").toLowerCase();
  if (/^(png|jpe?g|webp|gif|mp4|webm)$/.test(fromName)) return fromName;
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("webm")) return "webm";
  return "png";
}

async function statusPayload(config: StudioConfig) {
  const base = baseUrl(config);
  const publicState = {
    configured: Boolean(base),
    url: base,
    checkpoint: config.comfyCheckpoint,
    workflow: config.comfyWorkflow,
    workflowConfigured: Boolean(config.comfyWorkflow.trim()),
  };
  if (!base) {
    return {
      ...publicState,
      online: false,
      message: "Informe a URL do ComfyUI para conectar.",
    };
  }

  try {
    const [statsResponse, queueResponse] = await Promise.all([
      comfyFetch(config, "/system_stats", {}, 8_000),
      comfyFetch(config, "/queue", {}, 8_000).catch(() => null),
    ]);
    const stats = statsResponse.ok
      ? ((await statsResponse.json()) as {
          system?: { comfyui_version?: string; python_version?: string };
          devices?: Array<{
            name?: string;
            type?: string;
            vram_total?: number;
            vram_free?: number;
          }>;
        })
      : null;
    const queue =
      queueResponse && queueResponse.ok
        ? ((await queueResponse.json()) as {
            queue_running?: unknown[];
            queue_pending?: unknown[];
          })
        : null;

    return {
      ...publicState,
      online: statsResponse.ok,
      message: statsResponse.ok ? "ComfyUI conectado." : `ComfyUI respondeu ${statsResponse.status}.`,
      version: stats?.system?.comfyui_version,
      python: stats?.system?.python_version,
      devices: (stats?.devices ?? []).map(device => ({
        name: device.name ?? "Dispositivo",
        type: device.type ?? "unknown",
        vramTotal: device.vram_total ?? 0,
        vramFree: device.vram_free ?? 0,
      })),
      queueRunning: queue?.queue_running?.length ?? 0,
      queuePending: queue?.queue_pending?.length ?? 0,
    };
  } catch (error) {
    return {
      ...publicState,
      online: false,
      message: `Não consegui falar com o ComfyUI: ${(error as Error).message}`,
    };
  }
}

export function registerComfyRoutes(app: Express): void {
  app.get("/api/comfy/status", async (_req: Request, res: Response) => {
    try {
      const config = await readConfig();
      res.json(await statusPayload(config));
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/comfy/config", async (req: Request, res: Response) => {
    const { url, token, checkpoint, workflow } = req.body ?? {};
    if (typeof url === "string" && url.trim() && !/^https?:\/\//i.test(url.trim())) {
      res.status(400).json({ error: "A URL do ComfyUI precisa começar com http:// ou https://" });
      return;
    }
    try {
      const config = await writeConfig({
        comfyUrl: typeof url === "string" ? url : undefined,
        comfyToken: typeof token === "string" ? token : undefined,
        comfyCheckpoint: typeof checkpoint === "string" ? checkpoint : undefined,
        comfyWorkflow: typeof workflow === "string" ? workflow : undefined,
      });
      res.json(await statusPayload(config));
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/comfy/checkpoints", async (_req: Request, res: Response) => {
    try {
      const config = await readConfig();
      if (!baseUrl(config)) {
        res.status(400).json({ error: "Configure a URL do ComfyUI primeiro." });
        return;
      }
      const response = await comfyFetch(
        config,
        "/object_info/CheckpointLoaderSimple",
        {},
        15_000,
      );
      if (!response.ok) {
        res.status(502).json({ error: `O ComfyUI respondeu ${response.status}.` });
        return;
      }
      const payload = (await response.json()) as {
        input?: { required?: { ckpt_name?: unknown[] } };
      };
      const options = payload?.input?.required?.ckpt_name?.[0];
      res.json({ checkpoints: Array.isArray(options) ? options : [] });
    } catch (error) {
      res.status(502).json({ error: (error as Error).message });
    }
  });

  app.post("/api/comfy/image", async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Partial<ComfyImageInput>;
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (prompt.length < 3) {
      res.status(400).json({ error: "Descreva a imagem que você quer gerar." });
      return;
    }

    try {
      const config = await readConfig();
      if (!baseUrl(config)) {
        res.status(400).json({ error: "Configure a URL do ComfyUI em Ajustes." });
        return;
      }

      const checkpoint =
        (typeof body.checkpoint === "string" && body.checkpoint.trim()) ||
        config.comfyCheckpoint ||
        "";
      const values: ComfyWorkflowValues = {
        PROMPT: prompt,
        NEGATIVE:
          typeof body.negative === "string"
            ? body.negative.trim()
            : "low quality, blurry, distorted, watermark, text",
        SEED:
          typeof body.seed === "number" && Number.isFinite(body.seed)
            ? Math.floor(body.seed)
            : Math.floor(Math.random() * 2_000_000_000),
        WIDTH: clampInt(body.width, 1024, 256, 2048, 8),
        HEIGHT: clampInt(body.height, 1024, 256, 2048, 8),
        STEPS: clampInt(body.steps, 25, 1, 80, 1),
        CFG: typeof body.cfg === "number" && Number.isFinite(body.cfg) ? body.cfg : 7,
        CHECKPOINT: checkpoint,
      };

      let workflow: Record<string, unknown>;
      let workflowMode: "custom" | "standard" = "standard";
      if (config.comfyWorkflow.trim()) {
        workflow = parseWorkflow(config.comfyWorkflow, values);
        workflowMode = "custom";
      } else {
        if (!checkpoint) {
          res.status(400).json({
            error: "Informe um checkpoint do ComfyUI em Ajustes ou cole um workflow API.",
          });
          return;
        }
        workflow = buildTextToImageWorkflow(values);
      }

      const clientId = crypto.randomUUID();
      const queueResponse = await comfyFetch(
        config,
        "/prompt",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: workflow, client_id: clientId }),
        },
        30_000,
      );
      const queued = (await queueResponse.json().catch(() => ({}))) as {
        prompt_id?: string;
      };
      if (!queueResponse.ok || !queued.prompt_id) {
        res.status(502).json({ error: comfyError(queued) });
        return;
      }

      const promptId = queued.prompt_id;
      const deadline = Date.now() + 180_000;
      let historyEntry: {
        outputs?: unknown;
        status?: { status_str?: string; messages?: unknown[] };
      } | null = null;

      while (Date.now() < deadline) {
        const historyResponse = await comfyFetch(
          config,
          `/history/${encodeURIComponent(promptId)}`,
          {},
          15_000,
        );
        if (historyResponse.ok) {
          const history = (await historyResponse.json()) as Record<
            string,
            {
              outputs?: unknown;
              status?: { status_str?: string; messages?: unknown[] };
            }
          >;
          historyEntry = history[promptId] ?? null;
        }
        if (historyEntry) {
          if (historyEntry.status?.status_str === "error") {
            throw new Error(
              `O ComfyUI falhou ao renderizar: ${JSON.stringify(
                historyEntry.status.messages ?? [],
              ).slice(0, 300)}`,
            );
          }
          if (historyEntry.outputs) break;
        }
        await new Promise(resolve => setTimeout(resolve, 900));
      }

      if (!historyEntry?.outputs) {
        res.status(504).json({
          error: "O ComfyUI demorou mais de 3 minutos para renderizar.",
        });
        return;
      }

      const output = findOutputFile(historyEntry.outputs);
      if (!output) {
        res.status(502).json({
          error: "O workflow terminou, mas não devolveu imagem ou vídeo em SaveImage/SaveVideo.",
        });
        return;
      }

      const params = new URLSearchParams({
        filename: output.filename,
        subfolder: output.subfolder ?? "",
        type: output.type ?? "output",
      });
      const fileResponse = await comfyFetch(
        config,
        `/view?${params.toString()}`,
        {},
        60_000,
      );
      if (!fileResponse.ok) {
        res.status(502).json({
          error: `O ComfyUI não entregou o arquivo (${fileResponse.status}).`,
        });
        return;
      }
      const buffer = Buffer.from(await fileResponse.arrayBuffer());
      const mime =
        fileResponse.headers.get("content-type") ?? "image/png";
      const extension = extensionFor(output.filename, mime);
      await ensureDataDir();
      await fs.mkdir(comfyDir(), { recursive: true });
      const name = `${crypto.randomBytes(9).toString("hex")}.${extension}`;
      await fs.writeFile(path.join(comfyDir(), name), buffer);

      res.json({
        promptId,
        url: `/api/comfy/files/${name}`,
        mime,
        width: values.WIDTH,
        height: values.HEIGHT,
        seed: values.SEED,
        workflowMode,
      });
    } catch (error) {
      console.error("[ComfyUI]", error);
      res.status(502).json({ error: (error as Error).message });
    }
  });

  app.get("/api/comfy/files/:name", async (req: Request, res: Response) => {
    const name = path.basename(req.params.name);
    if (!/^[a-f0-9]+\.(png|jpe?g|webp|gif|mp4|webm)$/i.test(name)) {
      res.status(400).end();
      return;
    }
    try {
      const file = path.join(comfyDir(), name);
      const stat = await fs.stat(file);
      const extension = path.extname(name).toLowerCase();
      const mime =
        extension === ".mp4"
          ? "video/mp4"
          : extension === ".webm"
            ? "video/webm"
            : extension === ".gif"
              ? "image/gif"
              : extension === ".webp"
                ? "image/webp"
                : extension === ".jpg" || extension === ".jpeg"
                  ? "image/jpeg"
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
