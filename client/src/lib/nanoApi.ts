/** Client for Nano Banana (Google Gemini image generation). */

export interface NanoStatus {
  configured: boolean;
  model: string;
  imageSize: string;
  message: string;
}

export interface NanoImageParams {
  prompt: string;
  width?: number;
  height?: number;
  model?: string;
  imageSize?: "1K" | "2K" | "4K";
  aspectRatio?: string;
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

export async function fetchNanoStatus(): Promise<NanoStatus> {
  const response = await fetch("/api/nano/status");
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as NanoStatus;
}

export async function saveNanoConfig(patch: {
  key?: string;
  model?: string;
  imageSize?: string;
}): Promise<NanoStatus> {
  const response = await fetch("/api/nano/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as NanoStatus;
}

export async function generateNanoImage(
  params: NanoImageParams,
): Promise<{ blob: Blob; mime: string; source: "nano" }> {
  const response = await fetch("/api/nano/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { url: string; mime: string };
  const fileResponse = await fetch(payload.url);
  if (!fileResponse.ok) {
    throw new Error("O Nano Banana gerou a imagem, mas ela não pôde ser baixada.");
  }
  return {
    blob: await fileResponse.blob(),
    mime: payload.mime,
    source: "nano",
  };
}
