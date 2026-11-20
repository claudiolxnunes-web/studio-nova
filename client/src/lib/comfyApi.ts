/** Client for the local ComfyUI provider (proxied by the Studio Nova server). */

export interface ComfyStatus {
  configured: boolean;
  online: boolean;
  url: string;
  checkpoint: string;
  workflow: string;
  workflowConfigured: boolean;
  message?: string;
  version?: string;
  python?: string;
  devices?: Array<{
    name: string;
    type: string;
    vramTotal: number;
    vramFree: number;
  }>;
  queueRunning?: number;
  queuePending?: number;
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

export async function fetchComfyStatus(): Promise<ComfyStatus> {
  const response = await fetch("/api/comfy/status");
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as ComfyStatus;
}

export async function saveComfyConfig(patch: {
  url?: string;
  token?: string;
  checkpoint?: string;
  workflow?: string;
}): Promise<ComfyStatus> {
  const response = await fetch("/api/comfy/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as ComfyStatus;
}

export async function fetchComfyCheckpoints(): Promise<string[]> {
  const response = await fetch("/api/comfy/checkpoints");
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { checkpoints?: string[] };
  return payload.checkpoints ?? [];
}

export interface ComfyImageParams {
  prompt: string;
  negative?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
  checkpoint?: string;
}

export interface ComfyImageResult {
  blob: Blob;
  mime: string;
  promptId: string;
  source: "comfy";
}

/**
 * Generates an image on ComfyUI. The server builds the workflow, waits for the
 * render and returns a local file URL, so the browser receives a normal Blob.
 */
export async function generateComfyImage(
  params: ComfyImageParams,
): Promise<ComfyImageResult> {
  const response = await fetch("/api/comfy/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as {
    url: string;
    mime: string;
    promptId: string;
  };

  const fileResponse = await fetch(payload.url);
  if (!fileResponse.ok) {
    throw new Error("A imagem foi gerada, mas não pôde ser baixada.");
  }
  return {
    blob: await fileResponse.blob(),
    mime: payload.mime,
    promptId: payload.promptId,
    source: "comfy",
  };
}
