/**
 * Camera capture: records a real clip (video + microphone) straight from the
 * browser so the presenter can appear in the scene without another app.
 */

export interface CameraSupport {
  supported: boolean;
  reason?: string;
}

export function cameraSupport(): CameraSupport {
  if (typeof navigator === "undefined") return { supported: false, reason: "Ambiente sem navegador." };
  if (!navigator.mediaDevices?.getUserMedia) {
    return { supported: false, reason: "Este navegador não expõe a câmera (use Chrome ou Edge)." };
  }
  if (typeof MediaRecorder === "undefined") {
    return { supported: false, reason: "Este navegador não grava vídeo (MediaRecorder indisponível)." };
  }
  return { supported: true };
}

export async function openCamera(facing: "user" | "environment" = "user"): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: facing,
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
    },
  });
}

function pickMime(): string {
  const candidates = [
    'video/webm;codecs="vp9,opus"',
    'video/webm;codecs="vp8,opus"',
    "video/webm",
    'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
    "video/mp4",
  ];
  for (const candidate of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return "";
}

export interface ClipResult {
  blob: Blob;
  duration: number;
  width: number;
  height: number;
}

export class CameraRecorder {
  private readonly recorder: MediaRecorder;
  private readonly chunks: Blob[] = [];
  private startedAt = 0;

  constructor(private readonly stream: MediaStream) {
    const mime = pickMime();
    this.recorder = new MediaRecorder(
      stream,
      mime ? { mimeType: mime, videoBitsPerSecond: 4_500_000 } : undefined,
    );
    this.recorder.ondataavailable = event => {
      if (event.data && event.data.size > 0) this.chunks.push(event.data);
    };
  }

  start(): void {
    this.chunks.length = 0;
    this.startedAt = performance.now();
    this.recorder.start(250);
  }

  stop(): Promise<ClipResult> {
    const duration = (performance.now() - this.startedAt) / 1000;
    const settings = this.stream.getVideoTracks()[0]?.getSettings();
    return new Promise<ClipResult>(resolve => {
      this.recorder.onstop = () => {
        resolve({
          blob: new Blob(this.chunks, { type: this.recorder.mimeType || "video/webm" }),
          duration,
          width: settings?.width ?? 1280,
          height: settings?.height ?? 720,
        });
      };
      if (this.recorder.state !== "inactive") this.recorder.stop();
      else resolve({ blob: new Blob(this.chunks, { type: "video/webm" }), duration, width: 1280, height: 720 });
    });
  }

  get active(): boolean {
    return this.recorder.state === "recording";
  }
}
