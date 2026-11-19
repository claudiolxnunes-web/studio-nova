/**
 * Media helpers used by the editor: neural narration, caption transcription
 * and AI image generation. All routes are same-origin under /api/.
 */
import type { Express, Request, Response } from "express";
import { ENV } from "./_core/env";
import { generateFreeImage } from "./_core/freeImage";
import { SUPPORTED_VOICES, synthesize } from "./_core/tts";

type WordTiming = { word: string; start: number; end: number };

function forgeUrl(path: string): string {
  const base = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
  return new URL(path, base).toString();
}

async function transcribeAudio(
  audio: Buffer,
  mime: string,
  language: string,
): Promise<{ text: string; words: WordTiming[]; language: string }> {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    throw new Error("Serviço de transcrição não configurado neste projeto.");
  }
  const extension = mime.includes("wav") ? "wav" : mime.includes("ogg") ? "ogg" : "mp3";
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: mime }), `narracao.${extension}`);
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("language", language);
  form.append("timestamp_granularities[]", "word");

  const response = await fetch(forgeUrl("v1/audio/transcriptions"), {
    method: "POST",
    headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
    body: form,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Falha na transcrição (${response.status}) ${detail.slice(0, 200)}`);
  }

  const payload = (await response.json()) as {
    text?: string;
    language?: string;
    words?: Array<{ word?: string; start?: number; end?: number }>;
    segments?: Array<{ start?: number; end?: number; text?: string }>;
  };

  let words: WordTiming[] = (payload.words ?? [])
    .filter(item => typeof item.start === "number" && typeof item.end === "number")
    .map(item => ({
      word: (item.word ?? "").trim(),
      start: Number(item.start ?? 0),
      end: Number(item.end ?? 0),
    }))
    .filter(item => item.word.length > 0);

  if (words.length === 0 && payload.segments?.length) {
    // Fall back to evenly spread words inside each segment when word timings
    // are unavailable for this recording.
    for (const segment of payload.segments) {
      const start = Number(segment.start ?? 0);
      const end = Number(segment.end ?? start + 1);
      const tokens = (segment.text ?? "").trim().split(/\s+/).filter(Boolean);
      if (tokens.length === 0) continue;
      const step = (end - start) / tokens.length;
      tokens.forEach((token, index) => {
        words.push({
          word: token,
          start: Number((start + index * step).toFixed(3)),
          end: Number((start + (index + 1) * step).toFixed(3)),
        });
      });
    }
  }

  return {
    text: (payload.text ?? words.map(word => word.word).join(" ")).trim(),
    words,
    language: payload.language ?? language,
  };
}

export function registerMediaRoutes(app: Express): void {
  app.get("/api/voices", (_req: Request, res: Response) => {
    res.json({ voices: SUPPORTED_VOICES });
  });

  app.post("/api/tts", async (req: Request, res: Response) => {
    const { text, voiceId, rate, pitch } = req.body ?? {};
    if (typeof text !== "string" || text.trim().length === 0) {
      res.status(400).json({ error: "Escreva o roteiro antes de gerar a narração." });
      return;
    }
    try {
      const result = await synthesize({
        text,
        voiceId: typeof voiceId === "string" ? voiceId : undefined,
        rate: typeof rate === "number" ? rate : 1,
        pitch: typeof pitch === "number" ? pitch : 1,
      });
      res.setHeader("Content-Type", result.mime);
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Voice-Provider", result.provider);
      res.send(result.audio);
    } catch (error) {
      console.error("[TTS]", error);
      res.status(502).json({ error: (error as Error).message });
    }
  });

  app.post("/api/transcribe", async (req: Request, res: Response) => {
    const { audioBase64, mime, language } = req.body ?? {};
    if (typeof audioBase64 !== "string" || audioBase64.length === 0) {
      res.status(400).json({ error: "Áudio ausente para transcrição." });
      return;
    }
    try {
      const audio = Buffer.from(audioBase64, "base64");
      if (audio.byteLength > 24 * 1024 * 1024) {
        res.status(413).json({ error: "Áudio maior que 24 MB. Divida a cena em partes." });
        return;
      }
      const result = await transcribeAudio(
        audio,
        typeof mime === "string" && mime ? mime : "audio/mpeg",
        typeof language === "string" && language ? language : "pt",
      );
      res.json(result);
    } catch (error) {
      console.error("[Transcribe]", error);
      res.status(502).json({ error: (error as Error).message });
    }
  });

  app.post("/api/ai/image", async (req: Request, res: Response) => {
    const { prompt, quality, width, height, model, seed } = req.body ?? {};
    if (typeof prompt !== "string" || prompt.trim().length < 3) {
      res.status(400).json({ error: "Descreva a imagem que você quer gerar." });
      return;
    }
    try {
      const result = await generateFreeImage({
        prompt: prompt.trim(),
        width: typeof width === "number" ? width : quality === "high" ? 1440 : 1024,
        height: typeof height === "number" ? height : quality === "high" ? 1440 : 1024,
        model: typeof model === "string" ? model : undefined,
        seed: typeof seed === "number" ? seed : undefined,
        enhance: quality === "high",
      });
      res.json({
        dataUrl: `data:${result.mime};base64,${result.buffer.toString("base64")}`,
        mime: result.mime,
        provider: result.provider,
      });
    } catch (error) {
      console.error("[AI image]", error);
      res.status(502).json({ error: (error as Error).message });
    }
  });
}
