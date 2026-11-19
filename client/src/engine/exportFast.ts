/**
 * Fast, deterministic video export.
 *
 * Frames are rendered by the same canvas renderer used in the preview, then
 * encoded with WebCodecs (H.264 + AAC) inside a worker and muxed into a real
 * MP4. The old MediaRecorder path remains available as a fallback for browsers
 * without WebCodecs.
 */
import type { Project } from "@shared/editor";
import { totalDuration } from "@shared/editor";
import { getAudioBuffer, TimelinePlayer } from "./audio";
import { drawProjectFrame } from "./render";
import { mediaRegistry, prepareVideoFrame } from "./media";
import { safeFileName, scaleProjectToSize } from "./export";
import type {
  FastExportFromWorker,
  FastExportInit,
  FastExportToWorker,
} from "./exportWorkerTypes";

export interface FastExportOptions {
  width: number;
  height: number;
  fps: number;
  videoBitsPerSecond: number;
  audioBitsPerSecond?: number;
  onProgress?: (progress: number, message: string) => void;
  signal?: AbortSignal;
}

export interface FastExportResult {
  blob: Blob;
  mimeType: string;
  extension: "mp4";
  duration: number;
  audioCodec?: "aac" | "opus" | "none";
}

interface AudioMix {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
}

const AUDIO_SAMPLE_RATE = 48_000;

export function fastExportSupport(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof Worker !== "undefined" &&
    typeof VideoEncoder !== "undefined" &&
    typeof VideoFrame !== "undefined"
  );
}

function projectHasVideo(project: Project): boolean {
  return project.scenes.some(
    scene =>
      scene.background.type === "video" ||
      scene.layers.some(layer => layer.kind === "video"),
  );
}

/**
 * Mixes every scene narration into one stereo float track, resampling to
 * 48 kHz and respecting each scene's offset. This is the same timing the
 * preview uses, so the exported audio never drifts.
 */
async function mixNarration(project: Project): Promise<AudioMix | null> {
  const duration = totalDuration(project);
  if (duration <= 0) return null;

  const player = new TimelinePlayer();
  await player.prepare(project);

  const length = Math.ceil(duration * AUDIO_SAMPLE_RATE);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  let hasAudio = false;
  let sceneStart = 0;

  for (const scene of project.scenes) {
    const assetId = scene.narration.assetId;
    const buffer = assetId ? getAudioBuffer(assetId) : undefined;
    if (buffer) {
      hasAudio = true;
      const offset = Math.max(0, scene.narration.offset ?? 0);
      const available = Math.max(0, buffer.duration - offset);
      const seconds = Math.min(scene.duration, available);
      const frames = Math.min(
        Math.ceil(seconds * AUDIO_SAMPLE_RATE),
        length - Math.floor(sceneStart * AUDIO_SAMPLE_RATE),
      );
      const destinationStart = Math.floor(sceneStart * AUDIO_SAMPLE_RATE);
      const leftChannel = buffer.getChannelData(0);
      const rightChannel =
        buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : leftChannel;
      const ratio = buffer.sampleRate / AUDIO_SAMPLE_RATE;

      for (let index = 0; index < frames; index += 1) {
        const sourcePosition = (offset + index / AUDIO_SAMPLE_RATE) * ratio;
        const sourceIndex = Math.floor(sourcePosition);
        const fraction = sourcePosition - sourceIndex;
        const aLeft = leftChannel[sourceIndex] ?? 0;
        const bLeft = leftChannel[sourceIndex + 1] ?? aLeft;
        const aRight = rightChannel[sourceIndex] ?? 0;
        const bRight = rightChannel[sourceIndex + 1] ?? aRight;
        left[destinationStart + index] += aLeft + (bLeft - aLeft) * fraction;
        right[destinationStart + index] += aRight + (bRight - aRight) * fraction;
      }
    }
    sceneStart += scene.duration;
  }

  return hasAudio ? { left, right, sampleRate: AUDIO_SAMPLE_RATE } : null;
}

/** Yields to the event loop without relying on throttled timers. */
function yieldToUi(): Promise<void> {
  const scheduler = (
    globalThis as unknown as {
      scheduler?: { yield?: () => Promise<void> };
    }
  ).scheduler;
  if (scheduler?.yield) return scheduler.yield();
  return new Promise(resolve => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(0);
  });
}

async function cleanupOldExports(): Promise<void> {
  try {
    if (!navigator.storage?.getDirectory) return;
    const root = await navigator.storage.getDirectory();
    const directory = root as FileSystemDirectoryHandle & {
      entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
    };
    const cutoff = Date.now() - 60 * 60 * 1000;
    for await (const [name, handle] of directory.entries()) {
      if (!name.startsWith("studio-export-") || handle.kind !== "file") continue;
      const file = await (handle as FileSystemFileHandle).getFile();
      if (file.lastModified < cutoff) await root.removeEntry(name);
    }
  } catch {
    /* OPFS is optional */
  }
}

export async function exportVideoFast(
  project: Project,
  options: FastExportOptions,
): Promise<FastExportResult> {
  if (!fastExportSupport()) {
    throw new Error("WebCodecs não está disponível neste navegador.");
  }

  const { width, height, fps, videoBitsPerSecond } = options;
  const scaled = scaleProjectToSize(project, width, height);
  const duration = totalDuration(scaled);
  if (duration <= 0) throw new Error("A timeline está vazia.");

  await mediaRegistry.ensureAll(scaled.media);
  await cleanupOldExports();

  options.onProgress?.(0.02, "Preparando o áudio…");
  const audio = await mixNarration(scaled);

  const totalFrames = Math.max(1, Math.round(duration * fps));
  const fileName = `studio-export-${Date.now()}-${safeFileName(project.name)}.mp4`;
  const worker = new Worker(new URL("./exportWorker.ts", import.meta.url), {
    type: "module",
  });

  let readyResolve: (() => void) | null = null;
  let readyReject: ((error: Error) => void) | null = null;
  let doneResolve: ((result: FastExportFromWorker) => void) | null = null;
  let doneReject: ((error: Error) => void) | null = null;
  let settled = false;

  const ready = new Promise<void>((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  const finished = new Promise<FastExportFromWorker>((resolve, reject) => {
    doneResolve = resolve;
    doneReject = reject;
  });

  let inFlight = 0;
  let failure: Error | null = null;
  const waiters: Array<() => void> = [];
  const releaseWaiter = () => {
    inFlight = Math.max(0, inFlight - 1);
    waiters.shift()?.();
  };
  const fail = (error: Error) => {
    if (settled) return;
    settled = true;
    failure = error;
    readyReject?.(error);
    doneReject?.(error);
    waiters.splice(0).forEach(resolve => resolve());
  };

  worker.onmessage = (event: MessageEvent<FastExportFromWorker>) => {
    const message = event.data;
    if (message.type === "ready") {
      readyResolve?.();
      return;
    }
    if (message.type === "frameDone") {
      releaseWaiter();
      return;
    }
    if (message.type === "progress") {
      const encoded = message.total > 0 ? message.encoded / message.total : 0;
      options.onProgress?.(
        0.08 + encoded * 0.78,
        `Codificando ${message.encoded} de ${message.total} quadros…`,
      );
      return;
    }
    if (message.type === "done") {
      settled = true;
      doneResolve?.(message);
      return;
    }
    if (message.type === "error") {
      fail(new Error(message.message));
    }
  };
  worker.onerror = event => {
    fail(new Error(event.message || "Falha no worker de exportação."));
  };

  const acquire = async () => {
    if (inFlight < 4) {
      inFlight += 1;
      return;
    }
    await new Promise<void>(resolve => waiters.push(resolve));
    if (failure) throw failure;
    inFlight += 1;
  };

  try {
    const config: FastExportInit = {
      width,
      height,
      fps,
      videoBitrate: videoBitsPerSecond,
      duration,
      totalFrames,
      hasAudio: Boolean(audio),
      sampleRate: audio?.sampleRate ?? AUDIO_SAMPLE_RATE,
      audioBitrate: options.audioBitsPerSecond ?? 128_000,
      useDisk: Boolean(navigator.storage?.getDirectory),
      fileName,
    };
    const initMessage: FastExportToWorker = { type: "init", config };
    worker.postMessage(initMessage);
    await ready;

    if (audio) {
      worker.postMessage(
        {
          type: "audio",
          left: audio.left,
          right: audio.right,
          sampleRate: audio.sampleRate,
        } satisfies FastExportToWorker,
        [audio.left.buffer, audio.right.buffer],
      );
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas indisponível neste navegador.");

    const hasVideo = projectHasVideo(scaled);
    const keyEvery = Math.max(1, Math.round(fps * 2));
    const frameDuration = Math.round(1_000_000 / fps);

    for (let frame = 0; frame < totalFrames; frame += 1) {
      if (failure) throw failure;
      if (options.signal?.aborted) {
        worker.postMessage({ type: "abort" } satisfies FastExportToWorker);
        throw new Error("Exportação cancelada.");
      }

      const time = Math.min(duration - 0.001, frame / fps);
      if (hasVideo) await prepareVideoFrame(scaled, time);
      drawProjectFrame(ctx, scaled, time, false);

      const videoFrame = new VideoFrame(canvas, {
        timestamp: Math.round((frame * 1_000_000) / fps),
        duration: frameDuration,
      });
      await acquire();
      worker.postMessage(
        {
          type: "frame",
          frame: videoFrame,
          keyFrame: frame % keyEvery === 0,
        } satisfies FastExportToWorker,
        [videoFrame],
      );

      if (frame % 4 === 0 || frame === totalFrames - 1) {
        options.onProgress?.(
          0.08 + (frame / totalFrames) * 0.78,
          `Renderizando quadro ${frame + 1} de ${totalFrames}…`,
        );
        await yieldToUi();
      }
    }

    worker.postMessage({ type: "finish" } satisfies FastExportToWorker);
    const result = await finished;

    if (result.type !== "done") {
      throw new Error("A exportação não retornou um arquivo.");
    }

    let blob: Blob;
    if (result.mode === "disk" && result.fileName) {
      const root = await navigator.storage.getDirectory();
      const handle = await root.getFileHandle(result.fileName);
      blob = await handle.getFile();
    } else if (result.buffer) {
      blob = new Blob([result.buffer], { type: result.mimeType });
    } else {
      throw new Error("O arquivo exportado veio vazio.");
    }

    options.onProgress?.(1, "Vídeo pronto");
    return {
      blob,
      mimeType: result.mimeType,
      extension: "mp4",
      duration,
      audioCodec: result.audioCodec,
    };
  } finally {
    worker.terminate();
  }
}
