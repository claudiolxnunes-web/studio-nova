/** Thin client for the editor's server routes. */

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
