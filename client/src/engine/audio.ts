/**
 * Timeline audio engine. Decodes narration per scene, plays it in sync with
 * the visual timeline and exposes an amplitude envelope so avatars can move
 * their mouths with the actual voice.
 */
import type { Project } from "@shared/editor";
import { mediaRegistry } from "./media";

const ENVELOPE_FPS = 40;

const bufferCache = new Map<string, AudioBuffer>();
const envelopeCache = new Map<string, Float32Array>();

export function computeEnvelope(buffer: AudioBuffer, fps = ENVELOPE_FPS): Float32Array {
  const data = buffer.getChannelData(0);
  const windowSize = Math.max(1, Math.floor(buffer.sampleRate / fps));
  const frames = Math.max(1, Math.ceil(data.length / windowSize));
  const envelope = new Float32Array(frames);
  let peak = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    const start = frame * windowSize;
    const end = Math.min(data.length, start + windowSize);
    let sum = 0;
    for (let index = start; index < end; index += 1) sum += data[index] * data[index];
    const rms = Math.sqrt(sum / Math.max(1, end - start));
    envelope[frame] = rms;
    if (rms > peak) peak = rms;
  }
  if (peak > 0) {
    for (let frame = 0; frame < frames; frame += 1) {
      envelope[frame] = Math.min(1, envelope[frame] / peak);
    }
  }
  // Smooth so the mouth does not jitter.
  const smoothed = new Float32Array(frames);
  for (let frame = 0; frame < frames; frame += 1) {
    const prev = envelope[Math.max(0, frame - 1)];
    const next = envelope[Math.min(frames - 1, frame + 1)];
    smoothed[frame] = (prev + envelope[frame] * 2 + next) / 4;
  }
  return smoothed;
}

export function getEnvelope(assetId?: string): Float32Array | undefined {
  return assetId ? envelopeCache.get(assetId) : undefined;
}

export function getAudioBuffer(assetId: string): AudioBuffer | undefined {
  return bufferCache.get(assetId);
}

let sharedContext: AudioContext | null = null;
export function audioContext(): AudioContext {
  if (!sharedContext) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedContext = new Ctor();
  }
  return sharedContext;
}

export async function decodeNarration(assetId: string): Promise<AudioBuffer | undefined> {
  const cached = bufferCache.get(assetId);
  if (cached) return cached;
  const blob = await mediaRegistry.blob(assetId);
  if (!blob) return undefined;
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = await audioContext().decodeAudioData(arrayBuffer.slice(0));
    bufferCache.set(assetId, buffer);
    if (!envelopeCache.has(assetId)) envelopeCache.set(assetId, computeEnvelope(buffer));
    return buffer;
  } catch (error) {
    console.warn("[audio] não foi possível decodificar a narração", error);
    return undefined;
  }
}

export function rememberBuffer(assetId: string, buffer: AudioBuffer): void {
  bufferCache.set(assetId, buffer);
  envelopeCache.set(assetId, computeEnvelope(buffer));
}

export interface PlayOptions {
  from?: number;
  destination?: AudioNode;
  onEnded?: () => void;
}

/**
 * Real-time timeline player used by both preview and export. The audio clock is
 * the master clock so narration, avatars and captions never drift apart.
 */
export class TimelinePlayer {
  private sources: AudioBufferSourceNode[] = [];
  private ctx: AudioContext;
  private startStamp = 0;
  private from = 0;
  private playing = false;
  private duration = 0;
  private gain: GainNode | null = null;

  constructor(ctx: AudioContext = audioContext()) {
    this.ctx = ctx;
  }

  async prepare(project: Project): Promise<void> {
    this.duration = project.scenes.reduce((sum, scene) => sum + scene.duration, 0);
    await Promise.all(
      project.scenes.map(scene =>
        scene.narration.assetId ? decodeNarration(scene.narration.assetId) : Promise.resolve(undefined),
      ),
    );
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  get totalDuration(): number {
    return this.duration;
  }

  get time(): number {
    if (!this.playing) return this.from;
    return this.from + (this.ctx.currentTime - this.startStamp);
  }

  async play(project: Project, options: PlayOptions = {}): Promise<void> {
    this.stop();
    if (this.ctx.state === "suspended") await this.ctx.resume();

    const from = Math.max(0, options.from ?? 0);
    this.from = from;
    this.startStamp = this.ctx.currentTime + 0.06;
    this.playing = true;
    this.duration = project.scenes.reduce((sum, scene) => sum + scene.duration, 0);

    const gain = this.ctx.createGain();
    gain.gain.value = 1;
    gain.connect(options.destination ?? this.ctx.destination);
    this.gain = gain;

    let sceneStart = 0;
    for (const scene of project.scenes) {
      const assetId = scene.narration.assetId;
      const sceneEnd = sceneStart + scene.duration;
      const playFrom = Math.max(sceneStart, from);
      const sceneRemaining = sceneEnd - playFrom;
      if (assetId && sceneRemaining > 0.01) {
        const buffer = bufferCache.get(assetId) ?? (await decodeNarration(assetId));
        if (buffer) {
          // A split scene stores how much of the source audio was already
          // played. Add that offset so part 2 starts exactly where part 1 ends.
          const narrationOffset = Math.max(0, scene.narration.offset ?? 0);
          const offset = narrationOffset + (playFrom - sceneStart);
          if (offset < buffer.duration - 0.01) {
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(gain);
            const when = this.startStamp + (playFrom - from);
            const available = Math.max(0, buffer.duration - offset);
            source.start(
              Math.max(this.ctx.currentTime, when),
              offset,
              Math.min(sceneRemaining, available),
            );
            this.sources.push(source);
          }
        }
      }
      sceneStart = sceneEnd;
    }

    const endsAt = this.startStamp + (this.duration - from);
    const timer = window.setTimeout(
      () => {
        // Stop the sources as well: a narration longer than its scene must not
        // bleed into the next scene or keep playing after the timeline ends.
        this.stop();
        options.onEnded?.();
      },
      Math.max(0, (endsAt - this.ctx.currentTime) * 1000) + 60,
    );
    this.endTimer = timer;
  }

  private endTimer: number | null = null;

  stop(): void {
    this.sources.forEach(source => {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    });
    this.sources = [];
    if (this.endTimer) {
      window.clearTimeout(this.endTimer);
      this.endTimer = null;
    }
    this.gain?.disconnect();
    this.gain = null;
    this.playing = false;
  }

  seek(time: number): void {
    this.from = Math.max(0, Math.min(this.duration, time));
  }
}

/** Amplitude (0..1) of the scene narration at a given scene-local time. */
export function narrationAmplitude(assetId: string | undefined, sceneTime: number): number {
  if (!assetId) return 0;
  const envelope = envelopeCache.get(assetId);
  if (!envelope || envelope.length === 0) return 0;
  const index = Math.floor(sceneTime * ENVELOPE_FPS);
  if (index < 0) return 0;
  return envelope[Math.min(envelope.length - 1, index)] ?? 0;
}

export async function durationOf(blob: Blob): Promise<number> {
  try {
    const buffer = await blob.arrayBuffer();
    const decoded = await audioContext().decodeAudioData(buffer.slice(0));
    return decoded.duration;
  } catch {
    return 0;
  }
}
