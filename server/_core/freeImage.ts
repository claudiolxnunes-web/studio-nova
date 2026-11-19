/**
 * Free image generation helpers.
 *
 * Primary: Pollinations (open, no API key, Flux/Turbo models).
 * Secondary: the Manus forge image service, used only when it is configured.
 *
 * Nothing here needs a paid account, which is what makes the "IA" buttons in
 * the studio work out of the box on a fresh install.
 */
import { generateImage } from "./imageGeneration";
import { ENV } from "./env";

export type ImageResult = {
  buffer: Buffer;
  mime: string;
  provider: "pollinations" | "manus";
};

export type ImageOptions = {
  prompt: string;
  width?: number;
  height?: number;
  model?: string;
  seed?: number;
  /** Stronger prompt rewriting on the provider side. */
  enhance?: boolean;
};

const POLLINATIONS_BASE = "https://image.pollinations.ai/prompt";
const FETCH_TIMEOUT_MS = 120_000;

function clampSize(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value ?? NaN)) return fallback;
  const size = Math.round(value as number);
  // Pollinations accepts a wide range; keep requests sane for memory and time.
  return Math.min(2048, Math.max(256, size));
}

async function withTimeout<T>(task: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await task(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function pollinations(options: ImageOptions): Promise<ImageResult> {
  const width = clampSize(options.width, 1024);
  const height = clampSize(options.height, 1024);
  const seed = options.seed ?? Math.floor(Math.random() * 1_000_000);
  const model = options.model?.trim() || "flux";
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    model,
    seed: String(seed),
    nologo: "true",
    private: "true",
    referrer: "studio-nova",
  });
  if (options.enhance) params.set("enhance", "true");

  const url = `${POLLINATIONS_BASE}/${encodeURIComponent(options.prompt)}?${params.toString()}`;

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await withTimeout(signal => fetch(url, { signal }), FETCH_TIMEOUT_MS);
      if (response.status === 402) {
        // The free tier allows one image per IP every ~45s. Wait politely
        // instead of failing, so a queue of images still completes.
        const payload = await response.json().catch(() => null);
        const message: string = payload?.error?.message ?? "";
        const seconds = Number(/retry after (\d+)s/i.exec(message)?.[1] ?? 45);
        if (attempt < 2 && seconds <= 60) {
          await new Promise(resolve => setTimeout(resolve, (seconds + 2) * 1000));
          continue;
        }
        throw new Error(
          "O gerador gratuito libera 1 imagem a cada 45 segundos. Tente de novo em instantes.",
        );
      }
      if (!response.ok) {
        throw new Error(`Pollinations respondeu ${response.status}`);
      }
      const mime = response.headers.get("content-type") ?? "image/jpeg";
      if (!mime.startsWith("image/")) {
        throw new Error("O gerador devolveu um conteúdo que não é imagem.");
      }
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength < 1024) {
        throw new Error("O gerador devolveu uma imagem vazia.");
      }
      return { buffer: Buffer.from(arrayBuffer), mime, provider: "pollinations" };
    } catch (error) {
      lastError = error;
      if (attempt === 2) break;
      await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Falha ao gerar a imagem.");
}

/** Serialises requests so two tabs never spend the same free slot. */
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

/**
 * Generates an image for free. Falls back to the paid forge service only when
 * it is explicitly configured, so a local install never depends on it.
 */
export async function generateFreeImage(options: ImageOptions): Promise<ImageResult> {
  if (options.prompt.trim().length < 3) {
    throw new Error("Descreva a imagem que você quer gerar.");
  }

  if (process.env.STUDIO_IMAGE_PROVIDER === "manus" && ENV.forgeApiUrl && ENV.forgeApiKey) {
    const result = await generateImage({
      prompt: options.prompt,
      quality: "medium",
    });
    if (result.url) {
      const response = await fetch(result.url);
      if (!response.ok) throw new Error("Não consegui baixar a imagem gerada.");
      const mime = response.headers.get("content-type") ?? "image/png";
      return { buffer: Buffer.from(await response.arrayBuffer()), mime, provider: "manus" };
    }
  }

  return enqueue(() => pollinations(options));
}
