/**
 * Renders a talking-portrait video in the browser.
 *
 * The picture is animated by `drawTalkingPortrait` while the narration plays
 * through an AnalyserNode, so the mouth follows the real audio envelope. The
 * canvas stream and the audio track are recorded together with MediaRecorder —
 * no server, no credits, no upload.
 */
import { drawTalkingPortrait, type FaceBox, type PortraitAnchors } from "./portrait";
import { pickMimeType } from "./export";

export interface TalkingVideoOptions {
  imageUrl: string;
  face?: FaceBox;
  /** Exact eye/mouth positions from the landmark model. */
  anchors?: PortraitAnchors | null;
  audio: Blob;
  aspect?: "16:9" | "9:16" | "1:1";
  fps?: number;
  /** Accent ring around the presenter. */
  accent?: string;
  onProgress?: (progress: number, message: string) => void;
  signal?: AbortSignal;
}

export interface TalkingVideoResult {
  blob: Blob;
  extension: "mp4" | "webm";
  duration: number;
  width: number;
  height: number;
}

const SIZES: Record<string, { width: number; height: number }> = {
  "16:9": { width: 1280, height: 720 },
  "9:16": { width: 720, height: 1280 },
  "1:1": { width: 960, height: 960 },
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não consegui carregar o retrato."));
    image.src = url;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  zoom = 1,
): void {
  const scale = Math.max(width / image.width, height / image.height) * zoom;
  const drawW = image.width * scale;
  const drawH = image.height * scale;
  ctx.drawImage(image, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
}

export async function renderTalkingVideo(
  options: TalkingVideoOptions,
): Promise<TalkingVideoResult> {
  const size = SIZES[options.aspect ?? "1:1"] ?? SIZES["1:1"];
  const fps = options.fps ?? 30;
  const image = await loadImage(options.imageUrl);

  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(await options.audio.arrayBuffer());
  const duration = audioBuffer.duration;

  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponível neste navegador.");

  // Audio graph: source -> analyser -> recording destination.
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024;
  // Baixo valor de suavização: responde mais rápido a mudanças de fala (vogais/consoantes).
  analyser.smoothingTimeConstant = 0.3;
  const destination = audioContext.createMediaStreamDestination();
  source.connect(analyser);
  analyser.connect(destination);

  const stream = canvas.captureStream(fps);
  for (const track of destination.stream.getAudioTracks()) stream.addTrack(track);

  const { mimeType, extension } = pickMimeType();
  const recorder = new MediaRecorder(
    stream,
    mimeType ? { mimeType, videoBitsPerSecond: 7_000_000 } : { videoBitsPerSecond: 7_000_000 },
  );
  const chunks: Blob[] = [];
  recorder.ondataavailable = event => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const finished = new Promise<Blob>(resolve => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || "video/webm" }));
  });

  const samples = new Uint8Array(analyser.fftSize);
  const freqs = new Uint8Array(analyser.fftSize);
  let amplitude = 0;
  let mouthOpen = 0;
  const portraitSize = Math.min(size.width, size.height) * 0.84;

  const drawFrame = (time: number) => {
    // Time-domain: volume geral (RMS) — controla se a boca está aberta ou fechada.
    analyser.getByteTimeDomainData(samples);
    let sum = 0;
    for (let index = 0; index < samples.length; index += 1) {
      const value = (samples[index] - 128) / 128;
      sum += value * value;
    }
    const rms = Math.sqrt(sum / samples.length);
    const volume = Math.min(1, Math.pow(rms * 3.4, 0.8));

    // Frequency-domain: separa vogais (baixas) de consoantes (agudas).
    // Vogais abertas (a, o) concentram energia em baixa frequência -> boca mais aberta.
    // Consoantes (s, t, k) concentram em alta frequência -> boca menos aberta / mais fechada.
    analyser.getByteFrequencyData(freqs);
    let bass = 0;
    let treble = 0;
    // Bin 0 = DC, ignorar. Cada bin ≈ audioContext.sampleRate / fftSize Hz.
    // Com sampleRate 44100 e fftSize 1024: bin ≈ 43 Hz.
    // Vogais: ~250-900 Hz -> bins ~6-20. Consoantes sibilantes: >3000 Hz -> bins >70.
    for (let i = 1; i < freqs.length; i += 1) {
      const value = freqs[i] / 255;
      if (i <= 22) bass += value; // baixa frequência (vogais)
      else if (i >= 75) treble += value; // alta frequência (consoantes)
    }
    bass = Math.min(1, bass / 22);
    treble = Math.min(1, treble / (freqs.length - 75));

    // Mistura: volume garante abertura, frequência modula o tipo de abertura.
    const target = Math.min(1, volume * 0.6 + bass * 0.4);
    // Ataque rápido (abre com a fala), release um pouco mais lento (não fecha entre sílabas).
    amplitude += (target - amplitude) * (target > amplitude ? 0.6 : 0.14);

    // Suaviza a abertura da boca para não piscar entre frames.
    mouthOpen += (amplitude - mouthOpen) * 0.35;

    ctx.clearRect(0, 0, size.width, size.height);
    ctx.save();
    ctx.filter = "blur(34px) saturate(1.2) brightness(0.52)";
    drawCover(ctx, image, size.width, size.height, 1.25);
    ctx.restore();

    const wash = ctx.createLinearGradient(0, 0, 0, size.height);
    wash.addColorStop(0, "rgba(10,10,16,0.35)");
    wash.addColorStop(0.55, "rgba(10,10,16,0.1)");
    wash.addColorStop(1, "rgba(10,10,16,0.72)");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, size.width, size.height);

    const boxX = (size.width - portraitSize) / 2;
    const boxY = (size.height - portraitSize) / 2;

    // Soft shadow behind the presenter.
    ctx.save();
    ctx.filter = "blur(28px)";
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.ellipse(
      size.width / 2,
      boxY + portraitSize * 0.98,
      portraitSize * 0.42,
      portraitSize * 0.06,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();

    drawTalkingPortrait(ctx, image, options.face, {
      x: boxX,
      y: boxY,
      width: portraitSize,
      height: portraitSize,
      radius: portraitSize / 2,
      time,
      amplitude: mouthOpen,
      backdrop: false,
      anchors: options.anchors,
    });

    // Accent ring.
    ctx.save();
    ctx.strokeStyle = options.accent ?? "rgba(255,122,26,0.55)";
    ctx.lineWidth = Math.max(3, portraitSize * 0.006);
    ctx.beginPath();
    ctx.arc(size.width / 2, boxY + portraitSize / 2, portraitSize / 2 - ctx.lineWidth, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  drawFrame(0);
  options.onProgress?.(0.02, "Gravando…");
  recorder.start(250);
  source.start();

  const startedAt = audioContext.currentTime;
  await new Promise<void>((resolve, reject) => {
    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      resolve();
    };
    source.onended = stop;
    if (options.signal) {
      options.signal.addEventListener("abort", () => {
        stopped = true;
        reject(new DOMException("Cancelado", "AbortError"));
      });
    }
    const tick = () => {
      if (stopped) return;
      const time = audioContext.currentTime - startedAt;
      if (time >= duration + 0.05) {
        stop();
        return;
      }
      drawFrame(time);
      options.onProgress?.(Math.min(0.98, time / duration), "Gravando…");
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  // Keep the last frames for a moment so the tail audio is not cut.
  await new Promise(resolve => setTimeout(resolve, 180));
  recorder.stop();
  const blob = await finished;
  stream.getTracks().forEach(track => track.stop());
  await audioContext.close();

  options.onProgress?.(1, "Pronto!");
  return {
    blob,
    extension,
    duration,
    width: size.width,
    height: size.height,
  };
}
