/** Client for the avatar service (engines, keys and render jobs). */

export type EngineId = "portrait" | "heygen" | "did" | "tavus";

export interface EngineInfo {
  id: EngineId;
  name: string;
  tag: string;
  description: string;
  quality: number;
  avatarLibrary: boolean;
  ready: boolean;
}

export interface AvatarConfigView {
  defaultEngine: EngineId;
  engines: {
    heygen: { configured: boolean; hint: string };
    did: { configured: boolean; hint: string };
    tavus: { configured: boolean; hint: string };
    hf: { configured: boolean; hint: string };
  };
}

export interface AvatarEnginesResponse {
  config: AvatarConfigView;
  engines: EngineInfo[];
}

export interface AvatarJob {
  id: string;
  engine: EngineId;
  status: "queued" | "rendering" | "done" | "error";
  progress: number;
  message: string;
  resultUrl?: string;
  error?: string;
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

export async function fetchEngines(): Promise<AvatarEnginesResponse> {
  const response = await fetch("/api/avatar/engines");
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as AvatarEnginesResponse;
}

export async function saveAvatarConfig(patch: {
  heygenKey?: string;
  didKey?: string;
  tavusKey?: string;
  hfToken?: string;
  defaultEngine?: EngineId;
}): Promise<AvatarConfigView> {
  const response = await fetch("/api/avatar/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as AvatarConfigView;
}

export async function fetchHeygenLibrary(): Promise<{
  avatars: Array<{ avatar_id: string; avatar_name: string; preview_image_url?: string; gender?: string }>;
  voices: Array<{ voice_id: string; name: string; language?: string; gender?: string }>;
}> {
  const response = await fetch("/api/avatar/heygen/avatars");
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as {
    avatars: Array<{ avatar_id: string; avatar_name: string; preview_image_url?: string; gender?: string }>;
    voices: Array<{ voice_id: string; name: string; language?: string; gender?: string }>;
  };
}

export interface CreateJobInput {
  engine: Exclude<EngineId, "portrait">;
  script?: string;
  audioDataUrl?: string;
  imageDataUrl?: string;
  sourceUrl?: string;
  aspect?: string;
  background?: string;
  name?: string;
  heygenAvatarId?: string;
  heygenVoiceId?: string;
  didVoiceId?: string;
  tavusReplicaId?: string;
}

export async function createAvatarJob(input: CreateJobInput): Promise<{ id: string }> {
  const response = await fetch("/api/avatar/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as { id: string };
}

export async function getAvatarJob(id: string): Promise<AvatarJob> {
  const response = await fetch(`/api/avatar/jobs/${id}`);
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as AvatarJob;
}

/** Polls a job until it finishes, reporting progress. */
export async function waitForAvatarJob(
  id: string,
  onUpdate: (job: AvatarJob) => void,
  signal?: AbortSignal,
): Promise<AvatarJob> {
  for (;;) {
    if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");
    const job = await getAvatarJob(id);
    onUpdate(job);
    if (job.status === "done" || job.status === "error") return job;
    await new Promise(resolve => setTimeout(resolve, 2500));
  }
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(blob);
  });
}
