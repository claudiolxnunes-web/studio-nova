import type { MediaAsset, MediaKind } from "@shared/editor";
import { uid } from "@shared/editor";
import { putMedia } from "./storage";

function kindFromMime(mime: string): MediaKind | null {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return null;
}

async function measureImage(file: File): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Imagem inválida"));
      image.src = url;
    });
    return { width: image.width, height: image.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function measureVideo(file: File): Promise<{ width: number; height: number; duration: number }> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Vídeo inválido"));
      video.src = url;
    });
    return {
      width: video.videoWidth,
      height: video.videoHeight,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function measureAudio(file: File): Promise<number> {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const context = new Ctor();
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    const duration = buffer.duration;
    void context.close();
    return duration;
  } catch {
    return 0;
  }
}

export async function importFile(file: File): Promise<MediaAsset> {
  const mime = file.type || "application/octet-stream";
  const kind = kindFromMime(mime);
  if (!kind) {
    throw new Error(`Formato não suportado: ${file.name}`);
  }

  const asset: MediaAsset = {
    id: uid("media"),
    name: file.name,
    kind,
    mime,
    size: file.size,
    createdAt: Date.now(),
  };

  if (kind === "image") {
    const size = await measureImage(file);
    asset.width = size.width;
    asset.height = size.height;
  } else if (kind === "video") {
    const info = await measureVideo(file);
    asset.width = info.width;
    asset.height = info.height;
    asset.duration = info.duration;
  } else {
    asset.duration = await measureAudio(file);
  }

  await putMedia(asset, file);
  return asset;
}

export async function importFiles(files: File[]): Promise<MediaAsset[]> {
  const imported: MediaAsset[] = [];
  for (const file of files) {
    try {
      imported.push(await importFile(file));
    } catch (error) {
      console.warn("[media] falha ao importar", file.name, error);
    }
  }
  return imported;
}
