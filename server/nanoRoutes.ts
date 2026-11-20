/**
 * Nano Banana (Google Gemini image generation) provider.
 *
 * Uses the Google AI Studio API key stored on the server. The default model is
 * gemini-nano-banana-2.1, but the user can choose the cheaper/lite variants to
 * stretch the free quota. If the quota is exhausted, the client falls back to
 * ComfyUI or the free Pollinations provider.
 */
import type { Express, Request, Response } from "express";
import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { ensureDataDir, readConfig, writeConfig, type StudioConfig } from "./studioConfig";

const NANO_BASE =
  process.env.NANO_API_BASE || "https://generativelanguage.googleapis.com/v1beta";

const ALLOWED_RATIOS: Array<{ ratio: string; value: number }> = [
  { ratio: "1:1", value: 1 },
  { ratio: "4:5", value: 0.8 },
  { ratio: "3:4", value: 0.75 },
  { ratio: "2:3", value: 0.6667 },
  { ratio: "9:16", value: 0.5625 },
  { ratio: "16:9", value: 1.7778 },
  { ratio: "4:3", value: 1.3333 },
  { ratio: "5:4", value: 1.25 },
  { ratio: "3:2", value: 1.5 },
  { ratio: "21:9", value: 2.3333 },
];

export function aspectRatioFor(width: number, height: number): string {
  const target = Math.max(0.01, width / Math.max(1, height));
  let best = ALLOWED_RATIOS[0];
  let bestDistance = Infinity;
  for (const candidate of ALLOWED_RATIOS) {
    const distance = Math.abs(Math.log(target / candidate.value));
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best.ratio;
}

interface ExtractedImage {
  data: string;
  mime: string;
}

/**
 * The Interactions API returns `output_image`; older/alternate responses may
 * put the inline image in steps or candidates. Walk the payload instead of
 * relying on one exact shape.
 */
export function extractNanoImage(payload: unknown): ExtractedImage | null {
  const seen = new Set<unknown>();

  // The Interactions API exposes the final image directly; check it before
  // walking the steps so an interim "thought" image is never selected.
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    const direct = record.output_image ?? record.outputImage;
    if (direct && typeof direct === "object") {
      const image = direct as Record<string, unknown>;
      if (typeof image.data === "string" && image.data.length >= 32) {
        const data = image.data.startsWith("data:")
          ? image.data.slice(image.data.indexOf(",") + 1)
          : image.data;
        return {
          data,
          mime:
            (typeof image.mime_type === "string" && image.mime_type) ||
            (typeof image.mimeType === "string" && image.mimeType) ||
            "image/png",
        };
      }
    }
  }

  const walk = (value: unknown, depth: number): ExtractedImage | null => {
    if (!value || depth > 10 || typeof value !== "object") return null;
    if (seen.has(value)) return null;
    seen.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = walk(item, depth + 1);
        if (found) return found;
      }
      return null;
    }

    const record = value as Record<string, unknown>;
    const dataCandidates = [
      record.data,
      (record.inlineData as Record<string, unknown> | undefined)?.data,
      (record.inline_data as Record<string, unknown> | undefined)?.data,
      (record.image as Record<string, unknown> | undefined)?.data,
    ];
    const mime =
      (typeof record.mime_type === "string" && record.mime_type) ||
      (typeof record.mimeType === "string" && record.mimeType) ||
      (typeof (record.inlineData as Record<string, unknown> | undefined)?.mimeType ===
      "string"
        ? ((record.inlineData as Record<string, unknown>).mimeType as string)
        : "") ||
      (typeof (record.inline_data as Record<string, unknown> | undefined)
        ?.mime_type === "string"
        ? ((record.inline_data as Record<string, unknown>).mime_type as string)
        : "");

    for (const data of dataCandidates) {
      if (typeof data !== "string" || data.length < 32) continue;
      if (mime.startsWith("image/") || record.type === "image" || record.output_image) {
        const clean = data.includes(",") && data.startsWith("data:")
          ? data.slice(data.indexOf(",") + 1)
          : data;
        return { data: clean, mime: mime || "image/png" };
      }
    }

    for (const item of Object.values(record)) {
      const found = walk(item, depth + 1);
      if (found) return found;
    }
    return null;
  };

  return walk(payload, 0);
}

function nanoDir(): string {
  return path.resolve(process.cwd(), "data", "nano");
}

function apiKey(config: StudioConfig): string {
  return (
    config.geminiKey ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ""
  );
}

async function saveImage(image: ExtractedImage): Promise<string> {
  const mime = image.mime || "image/png";
  const extension = mime.includes("jpeg")
    ? "jpg"
    : mime.includes("webp")
      ? "webp"
      : "png";
  await ensureDataDir();
  await fs.mkdir(nanoDir(), { recursive: true });
  const name = `${crypto.randomBytes(9).toString("hex")}.${extension}`;
  await fs.writeFile(path.join(nanoDir(), name), Buffer.from(image.data, "base64"));
  return name;
}

function nanoStatus(config: StudioConfig) {
  const key = apiKey(config);
  return {
    configured: Boolean(key),
    model: config.geminiModel || "gemini-nano-banana-2.1",
    imageSize: config.geminiImageSize || "1K",
    message: key
      ? "Nano Banana usa a cota da sua chave do Google AI Studio. Se a cota acabar, o Studio usa o fallback gratuito."
      : "Cole a chave do Google AI Studio para ativar o Nano Banana.",
  };
}

export function registerNanoRoutes(app: Express): void {
  app.get("/api/nano/status", async (_req: Request, res: Response) => {
    try {
      res.json(nanoStatus(await readConfig()));
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/nano/config", async (req: Request, res: Response) => {
    const { key, model, imageSize } = req.body ?? {};
    try {
      const config = await writeConfig({
        geminiKey: typeof key === "string" ? key : undefined,
        geminiModel: typeof model === "string" ? model : undefined,
        geminiImageSize: typeof imageSize === "string" ? imageSize : undefined,
      });
      res.json(nanoStatus(config));
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/nano/image", async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as {
      prompt?: string;
      width?: number;
      height?: number;
      model?: string;
      imageSize?: string;
      aspectRatio?: string;
    };
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (prompt.length < 3) {
      res.status(400).json({ error: "Descreva a imagem que você quer gerar." });
      return;
    }

    try {
      const config = await readConfig();
      const key = apiKey(config);
      if (!key) {
        res.status(400).json({
          error: "Configure a chave do Nano Banana (Google AI Studio) em Ajustes.",
        });
        return;
      }

      const model =
        (typeof body.model === "string" && body.model.trim()) ||
        config.geminiModel ||
        "gemini-nano-banana-2.1";
      const imageSize =
        body.imageSize === "2K" || body.imageSize === "4K" || body.imageSize === "1K"
          ? body.imageSize
          : config.geminiImageSize || "1K";
      const aspectRatio =
        typeof body.aspectRatio === "string" && /^\d+:\d+$/.test(body.aspectRatio)
          ? body.aspectRatio
          : aspectRatioFor(
              typeof body.width === "number" ? body.width : 1024,
              typeof body.height === "number" ? body.height : 1024,
            );

      const response = await fetch(`${NANO_BASE}/interactions`, {
        method: "POST",
        headers: {
          "x-goog-api-key": key,
          "Content-Type": "application/json",
          "Api-Revision": "2026-05-20",
        },
        body: JSON.stringify({
          model,
          input: [{ type: "text", text: prompt }],
          response_format: {
            type: "image",
            mime_type: "image/png",
            aspect_ratio: aspectRatio,
            image_size: imageSize,
          },
        }),
        signal: AbortSignal.timeout(120_000),
      });

      const payload = (await response.json().catch(() => ({}))) as unknown;
      if (!response.ok) {
        const detail =
          payload && typeof payload === "object"
            ? JSON.stringify((payload as { error?: unknown }).error ?? payload).slice(
                0,
                400,
              )
            : "";
        res.status(502).json({
          error: `O Nano Banana respondeu ${response.status}. ${detail}`,
        });
        return;
      }

      const image = extractNanoImage(payload);
      if (!image) {
        res.status(502).json({
          error:
            "O Nano Banana respondeu sem imagem. Verifique se o modelo escolhido existe na sua conta.",
        });
        return;
      }

      const name = await saveImage(image);
      res.json({
        url: `/api/nano/files/${name}`,
        mime: image.mime,
        model,
        aspectRatio,
        imageSize,
      });
    } catch (error) {
      console.error("[Nano Banana]", error);
      res.status(502).json({ error: (error as Error).message });
    }
  });

  app.get("/api/nano/files/:name", async (req: Request, res: Response) => {
    const name = path.basename(req.params.name);
    if (!/^[a-f0-9]+\.(png|jpe?g|webp)$/i.test(name)) {
      res.status(400).end();
      return;
    }
    try {
      const file = path.join(nanoDir(), name);
      const stat = await fs.stat(file);
      const extension = path.extname(name).toLowerCase();
      res.setHeader(
        "Content-Type",
        extension === ".jpg" || extension === ".jpeg"
          ? "image/jpeg"
          : extension === ".webp"
            ? "image/webp"
            : "image/png",
      );
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
