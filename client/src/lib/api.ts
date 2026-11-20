/** Thin client for the editor's server routes. */

import { generateComfyImage } from "./comfyApi";
import { generateNanoImage } from "./nanoApi";

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

async function readError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    if (payload?.error) return payload.error;
  } catch {
    /* ignore */
  }
  return `Falha na requisição (${response.status})`;
}

export async function generateNarration(params: {
  text: string;
  voiceId: string;
  rate: number;
  pitch: number;
  signal?: AbortSignal;
}): Promise<Blob> {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: params.text,
      voiceId: params.voiceId,
      rate: params.rate,
      pitch: params.pitch,
    }),
    signal: params.signal,
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.blob();
}

export async function transcribe(blob: Blob): Promise<{ text: string; words: WordTiming[] }> {
  const buffer = await blob.arrayBuffer();
  const audioBase64 = base64FromArrayBuffer(buffer);
  const response = await fetch("/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audioBase64,
      mime: blob.type || "audio/mpeg",
      language: "pt",
    }),
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as { text: string; words: WordTiming[] };
}

export async function generateAiImage(prompt: string): Promise<{ blob: Blob; mime: string }> {
  const response = await fetch("/api/ai/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { dataUrl: string; mime: string };
  const base64 = payload.dataUrl.split(",")[1] ?? "";
  const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
  return { blob: new Blob([bytes], { type: payload.mime }), mime: payload.mime };
}

/**
 * Provider order is configurable in Settings. Default: Nano Banana (Google) →
 * ComfyUI → free Pollinations. Every provider fails fast when unconfigured, so
 * the editor always completes with whichever tool the user has available.
 */
export async function generateImagePreferred(
  prompt: string,
  options: { width?: number; height?: number } = {},
): Promise<{
  blob: Blob;
  mime: string;
  source: "nano" | "comfy" | "pollinations";
}> {
  const preference =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("studio-image-provider")
      : null;
  const order: Array<"nano" | "comfy"> =
    preference === "comfy"
      ? ["comfy", "nano"]
      : preference === "free"
        ? []
        : ["nano", "comfy"];

  for (const provider of order) {
    try {
      if (provider === "nano") {
        const result = await generateNanoImage({
          prompt,
          width: options.width,
          height: options.height,
        });
        return { blob: result.blob, mime: result.mime, source: "nano" };
      }
      const result = await generateComfyImage({
        prompt,
        width: options.width,
        height: options.height,
      });
      return { blob: result.blob, mime: result.mime, source: "comfy" };
    } catch (error) {
      console.warn(`[${provider}] usando próximo provedor:`, (error as Error).message);
    }
  }

  const fallback = await generateAiImage(prompt);
  return { ...fallback, source: "pollinations" };
}

export function base64FromArrayBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

/** Speech synthesis fallback used only for live preview when no audio exists. */
export function speakFallback(text: string, rate = 1): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "pt-BR";
  utterance.rate = rate;
  const voice = window.speechSynthesis.getVoices().find(item => item.lang?.startsWith("pt-BR"));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}
