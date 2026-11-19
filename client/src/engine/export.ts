/**
 * Video export: renders the timeline on a canvas, records it together with the
 * narration audio and returns a downloadable video file. Runs entirely in the
 * browser — nothing is uploaded.
 */
import type { Project } from "@shared/editor";
import { totalDuration } from "@shared/editor";
import { audioContext, TimelinePlayer } from "./audio";
import { mediaRegistry, prepareVideoFrame, syncVideoLayers } from "./media";
import { drawProjectFrame } from "./render";

export interface ExportOptions {
  width: number;
  height: number;
  fps: number;
  videoBitsPerSecond: number;
  onProgress?: (progress: number, message: string) => void;
  onFrame?: (canvas: HTMLCanvasElement) => void;
  signal?: AbortSignal;
}

export interface ExportResult {
  blob: Blob;
  mimeType: string;
  extension: "mp4" | "webm";
  duration: number;
}

const MP4_CANDIDATES = [
  'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
  'video/mp4;codecs="avc1.4D401E,mp4a.40.2"',
  "video/mp4",
];

const WEBM_CANDIDATES = [
  'video/webm;codecs="vp9,opus"',
  'video/webm;codecs="vp8,opus"',
  "video/webm",
];

export function pickMimeType(): { mimeType: string; extension: "mp4" | "webm" } {
  if (typeof MediaRecorder === "undefined") {
    return { mimeType: "video/webm", extension: "webm" };
  }
  for (const candidate of MP4_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return { mimeType: candidate, extension: "mp4" };
    }
  }
  for (const candidate of WEBM_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return { mimeType: candidate, extension: "webm" };
    }
  }
  return { mimeType: "", extension: "webm" };
}

export function exportSupport(): { canExport: boolean; extension: "mp4" | "webm" } {
  const { mimeType, extension } = pickMimeType();
  const canExport =
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    "captureStream" in HTMLCanvasElement.prototype &&
    mimeType !== "";
  return { canExport, extension };
}

/** A project re-laid out for another output size, preserving all content. */
export function scaleProjectToSize(
  project: Project,
  width: number,
  height: number,
): Project {
  if (width === project.width && height === project.height) return project;
  return {
    ...project,
    width,
    height,
    scenes: project.scenes.map(scene => ({
      ...scene,
      background: { ...scene.background },
      narration: { ...scene.narration },
      layers: scene.layers.map(layer => ({
        ...layer,
        x: (layer.x / project.width) * width,
        y: (layer.y / project.height) * height,
        w: (layer.w / project.width) * width,
        h: (layer.h / project.height) * height,
      })),
    })),
    captions: {
      ...project.captions,
      fontSize: (project.captions.fontSize / project.height) * height,
      margin: (project.captions.margin / project.height) * height,
    },
  };
}

export async function exportVideo(project: Project, options: ExportOptions): Promise<ExportResult> {
  const { width, height, fps, videoBitsPerSecond, onProgress, signal } = options;
  const { mimeType, extension } = pickMimeType();
  if (!mimeType) throw new Error("Este navegador não suporta gravação de vídeo.");

  await mediaRegistry.ensureAll(project.media);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Não foi possível preparar a tela de renderização.");

  const scaled = scaleProjectToSize(project, width, height);

  const player = new TimelinePlayer();
  await player.prepare(scaled);
  const duration = totalDuration(scaled);

  const context = audioContext();
  if (context.state === "suspended") await context.resume();
  const destination = context.createMediaStreamDestination();

  const stream = canvas.captureStream(fps);
  const audioTrack = destination.stream.getAudioTracks()[0];
  if (audioTrack) stream.addTrack(audioTrack);

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond,
    audioBitsPerSecond: 128000,
  });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = event => {
    if (event.data && event.data.size > 0) chunks.push(event.data);
  };

  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    recorder.onerror = event => reject(event instanceof ErrorEvent ? event.error : new Error("Falha ao gravar"));
  });

  // Prime the first frame before recording starts.
  drawProjectFrame(ctx, scaled, 0);
  onProgress?.(0, "Preparando a gravação…");
  recorder.start(250);
  await player.play(scaled, { destination });

  await new Promise<void>((resolve, reject) => {
    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      resolve();
    };

    const tick = () => {
      if (signal?.aborted) {
        player.stop();
        try {
          recorder.stop();
        } catch {
          /* ignore */
        }
        reject(new Error("Exportação cancelada."));
        return;
      }
      const time = player.time;
      drawProjectFrame(ctx, scaled, time);
      syncVideoLayers(scaled, time, true);
      onProgress?.(Math.min(1, time / duration), "Gravando…");
      if (time >= duration - 0.02) {
        stop();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    setTimeout(stop, (duration + 3) * 1000);
  });

  // Hold the last frame briefly so the tail of the audio is not cut.
  drawProjectFrame(ctx, scaled, Math.max(0, duration - 0.02));
  await new Promise(resolve => setTimeout(resolve, 350));
  player.stop();
  syncVideoLayers(scaled, duration, false);
  if (recorder.state !== "inactive") recorder.stop();
  const blob = await finished;
  audioTrack?.stop();

  onProgress?.(1, "Vídeo pronto");
  const actualExtension = await detectContainer(blob, extension);
  return { blob, mimeType, extension: actualExtension, duration };
}

/**
 * Some browsers claim MP4 support but write a WebM/Matroska stream. Reading
 * the first bytes keeps the downloaded file name honest.
 */
async function detectContainer(blob: Blob, fallback: "mp4" | "webm"): Promise<"mp4" | "webm"> {
  try {
    const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return "webm";
    const brand = String.fromCharCode(...head.slice(4, 8));
    if (brand === "ftyp") return "mp4";
  } catch {
    /* keep the recorder's guess */
  }
  return fallback;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function safeFileName(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9-_ ]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase() || "aula"
  );
}

/**
 * Renders one scene as a still PNG — used for posts, carousels, blog covers
 * and live thumbnails.
 */
export async function exportSceneImage(
  project: Project,
  sceneIndex: number,
  options: { scale?: number; time?: number } = {},
): Promise<Blob> {
  const scale = options.scale ?? 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(project.width * scale);
  canvas.height = Math.round(project.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível neste navegador.");

  const sceneStart = project.scenes
    .slice(0, sceneIndex)
    .reduce((sum, scene) => sum + scene.duration, 0);
  const time = options.time ?? sceneStart + Math.min(0.6, (project.scenes[sceneIndex]?.duration ?? 1) * 0.15);

  // Make sure images/videos exist and that a video layer is showing the exact
  // frame for this instant before we draw — otherwise a carousel slide can be
  // exported blank or with the first frame of the clip.
  await mediaRegistry.ensureAll(project.media);
  await prepareVideoFrame(project, time);

  if (scale !== 1) ctx.scale(scale, scale);
  drawProjectFrame(ctx, project, time, true);

  await new Promise(resolve => requestAnimationFrame(() => resolve(null)));

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error("Não foi possível gerar a imagem."));
    }, "image/png");
  });
}
