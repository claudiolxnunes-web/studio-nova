/** Client for Tripo 3D generation. */

export interface TripoStatus {
  configured: boolean;
  model: string;
  message: string;
}

export interface TripoTask {
  taskId: string;
  status: string;
  progress: number;
  modelUrl?: string;
  previewUrl?: string;
  remoteModelUrl?: string;
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

export async function fetchTripoStatus(): Promise<TripoStatus> {
  const response = await fetch("/api/tripo/status");
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as TripoStatus;
}

export async function saveTripoConfig(patch: {
  key?: string;
  model?: string;
}): Promise<TripoStatus> {
  const response = await fetch("/api/tripo/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as TripoStatus;
}

export async function startTripoModel(input: {
  prompt: string;
  model?: string;
  textureQuality?: "fast" | "standard" | "detailed";
  geometryQuality?: "standard" | "detailed";
  faceLimit?: number;
}): Promise<{ taskId: string; model: string }> {
  const response = await fetch("/api/tripo/text-to-3d", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as { taskId: string; model: string };
}

export async function getTripoTask(taskId: string): Promise<TripoTask> {
  const response = await fetch(`/api/tripo/tasks/${encodeURIComponent(taskId)}`);
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as TripoTask;
}

export async function waitForTripoTask(
  taskId: string,
  onUpdate: (task: TripoTask) => void,
  signal?: AbortSignal,
): Promise<TripoTask> {
  for (;;) {
    if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");
    const task = await getTripoTask(taskId);
    onUpdate(task);
    if (task.status === "success" || task.error) return task;
    if (["failed", "cancelled", "banned", "expired"].includes(task.status)) {
      return task;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}
