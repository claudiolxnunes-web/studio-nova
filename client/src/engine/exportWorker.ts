/**
 * WebCodecs export worker.
 *
 * The main thread renders deterministic frames and sends VideoFrames here.
 * This worker encodes H.264 video + AAC audio and muxes a real MP4 file with
 * mp4-muxer. When OPFS is available, the muxer writes directly to disk so long
 * lessons do not have to fit in RAM.
 */
import {
  ArrayBufferTarget,
  FileSystemWritableFileStreamTarget,
  Muxer,
} from "mp4-muxer";
import type {
  FastExportFromWorker,
  FastExportInit,
  FastExportToWorker,
} from "./exportWorkerTypes";

type Scope = {
  onmessage: ((event: MessageEvent<FastExportToWorker>) => void) | null;
  postMessage: (message: FastExportFromWorker, transfer?: Transferable[]) => void;
};

const scope = globalThis as unknown as Scope;

let muxer: Muxer<ArrayBufferTarget | FileSystemWritableFileStreamTarget> | null =
  null;
let videoEncoder: VideoEncoder | null = null;
let audioEncoder: AudioEncoder | null = null;
let target: ArrayBufferTarget | FileSystemWritableFileStreamTarget | null = null;
let writable: FileSystemWritableFileStream | null = null;
let fileHandle: FileSystemFileHandle | null = null;
let mode: "disk" | "buffer" = "buffer";
let totalFrames = 0;
let encodedFrames = 0;
let audioCodecName: "aac" | "opus" | "none" = "none";

function post(message: FastExportFromWorker, transfer?: Transferable[]): void {
  scope.postMessage(message, transfer);
}

function fail(error: unknown): void {
  const message =
    error instanceof Error ? error.message : String(error ?? "Falha na exportação");
  try {
    videoEncoder?.close();
    audioEncoder?.close();
  } catch {
    /* already closed */
  }
  void writable?.abort().catch(() => undefined);
  post({ type: "error", message });
}

async function pickVideoConfig(config: FastExportInit): Promise<VideoEncoderConfig> {
  const candidates = [
    "avc1.640028", // High 4.0 — 1080p
    "avc1.4d401f", // Main 3.1 — 720p
    "avc1.42001f", // Baseline 3.1 — safe fallback
  ];

  for (const codec of candidates) {
    const candidate: VideoEncoderConfig = {
      codec,
      width: config.width,
      height: config.height,
      bitrate: config.videoBitrate,
      framerate: config.fps,
      latencyMode: "quality",
      avc: { format: "avc" },
    };
    try {
      const support = await VideoEncoder.isConfigSupported(candidate);
      if (support.supported) return candidate;
    } catch {
      /* try the next profile */
    }
  }

  throw new Error(
    "Este navegador não oferece um codificador H.264 compatível. A exportação usará o modo em tempo real.",
  );
}

async function pickAudioCodec(
  config: FastExportInit,
): Promise<{ codec: "aac" | "opus"; encoderCodec: string } | null> {
  if (!config.hasAudio) return null;
  if (typeof AudioEncoder === "undefined") {
    throw new Error("Este navegador não oferece codificação de áudio WebCodecs.");
  }

  const aac = {
    codec: "mp4a.40.2",
    sampleRate: config.sampleRate,
    numberOfChannels: 2,
    bitrate: config.audioBitrate,
  };
  try {
    const support = await AudioEncoder.isConfigSupported(aac);
    if (support.supported) return { codec: "aac", encoderCodec: "mp4a.40.2" };
  } catch {
    /* try Opus */
  }

  const opus = {
    codec: "opus",
    sampleRate: config.sampleRate,
    numberOfChannels: 2,
    bitrate: config.audioBitrate,
  };
  try {
    const support = await AudioEncoder.isConfigSupported(opus);
    if (support.supported) return { codec: "opus", encoderCodec: "opus" };
  } catch {
    /* no audio codec */
  }

  throw new Error(
    "Este navegador não oferece codificação de áudio AAC/Opus. A exportação usará o modo em tempo real.",
  );
}

async function init(config: FastExportInit): Promise<void> {
  totalFrames = config.totalFrames;
  const audioCodec = await pickAudioCodec(config);
  audioCodecName = audioCodec?.codec ?? "none";
  const videoConfig = await pickVideoConfig(config);

  if (config.useDisk) {
    try {
      const root = await navigator.storage.getDirectory();
      fileHandle = await root.getFileHandle(config.fileName, { create: true });
      writable = await fileHandle.createWritable();
      target = new FileSystemWritableFileStreamTarget(writable);
      mode = "disk";
    } catch {
      target = null;
      writable = null;
      fileHandle = null;
      mode = "buffer";
    }
  }

  if (!target) {
    target = new ArrayBufferTarget();
    mode = "buffer";
  }

  muxer = new Muxer({
    target,
    video: {
      codec: "avc",
      width: config.width,
      height: config.height,
      frameRate: config.fps,
    },
    audio: audioCodec
      ? {
          codec: audioCodec.codec,
          numberOfChannels: 2,
          sampleRate: config.sampleRate,
        }
      : undefined,
    fastStart: mode === "disk" ? false : "in-memory",
    firstTimestampBehavior: "strict",
  });

  videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer?.addVideoChunk(chunk, meta),
    error: error => fail(error),
  });
  videoEncoder.configure(videoConfig);

  if (audioCodec) {
    audioEncoder = new AudioEncoder({
      output: (chunk, meta) => muxer?.addAudioChunk(chunk, meta),
      error: error => fail(error),
    });
    audioEncoder.configure({
      codec: audioCodec.encoderCodec,
      sampleRate: config.sampleRate,
      numberOfChannels: 2,
      bitrate: config.audioBitrate,
    });
  }

  post({ type: "ready", mode });
}

async function addAudio(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
): Promise<void> {
  if (!audioEncoder) {
    throw new Error("O áudio chegou antes de o codificador estar pronto.");
  }
  const totalSamples = Math.min(left.length, right.length);
  const chunkSize = 4096;

  for (let offset = 0; offset < totalSamples; offset += chunkSize) {
    const frames = Math.min(chunkSize, totalSamples - offset);
    const data = new Float32Array(frames * 2);
    data.set(left.subarray(offset, offset + frames), 0);
    data.set(right.subarray(offset, offset + frames), frames);
    const audioData = new AudioData({
      format: "f32-planar",
      sampleRate,
      numberOfFrames: frames,
      numberOfChannels: 2,
      timestamp: Math.round((offset / sampleRate) * 1_000_000),
      data,
    });
    audioEncoder.encode(audioData);
    audioData.close();
  }

  await audioEncoder.flush();
}

function addFrame(frame: VideoFrame, keyFrame: boolean): void {
  if (!videoEncoder) {
    frame.close();
    throw new Error("O quadro chegou antes de o codificador estar pronto.");
  }
  videoEncoder.encode(frame, { keyFrame });
  frame.close();
  encodedFrames += 1;
  if (encodedFrames % 5 === 0 || encodedFrames === totalFrames) {
    post({ type: "progress", encoded: encodedFrames, total: totalFrames });
  }
  post({ type: "frameDone" });
}

async function finish(): Promise<void> {
  if (!videoEncoder || !muxer) {
    throw new Error("A exportação não foi iniciada.");
  }

  await videoEncoder.flush();
  videoEncoder.close();
  videoEncoder = null;

  if (audioEncoder) {
    await audioEncoder.flush();
    audioEncoder.close();
    audioEncoder = null;
  }

  muxer.finalize();

  if (mode === "disk" && fileHandle && writable) {
    await writable.close();
    const file = await fileHandle.getFile();
    post({
      type: "done",
      mode: "disk",
      fileName: file.name,
      size: file.size,
      mimeType: "video/mp4",
      audioCodec: audioCodecName,
    });
    return;
  }

  const buffer = (target as ArrayBufferTarget).buffer;
  post(
    {
      type: "done",
      mode: "buffer",
      buffer,
      mimeType: "video/mp4",
      audioCodec: audioCodecName,
    },
    [buffer],
  );
}

async function abort(): Promise<void> {
  try {
    videoEncoder?.close();
    audioEncoder?.close();
  } catch {
    /* already closed */
  }
  videoEncoder = null;
  audioEncoder = null;
  try {
    await writable?.abort();
  } catch {
    /* already closed */
  }
  post({ type: "error", message: "Exportação cancelada." });
}

scope.onmessage = event => {
  const message = event.data;
  void (async () => {
    try {
      if (message.type === "init") await init(message.config);
      else if (message.type === "audio") {
        await addAudio(message.left, message.right, message.sampleRate);
      } else if (message.type === "frame") {
        addFrame(message.frame, message.keyFrame);
      } else if (message.type === "finish") await finish();
      else if (message.type === "abort") await abort();
    } catch (error) {
      fail(error);
    }
  })();
};
