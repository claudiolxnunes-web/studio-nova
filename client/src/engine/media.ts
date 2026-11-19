/**
 * Media registry: keeps decoded images, video elements and audio buffers for
 * the editor preview and the export pipeline.
 */
import type { MediaAsset, Project } from "@shared/editor";
import { getMediaBlob } from "@/lib/storage";
import { detectFaceAnchors, type FaceAnchors } from "./faceAnchors";

export interface MediaEntry {
  asset: MediaAsset;
  url: string;
  blob?: Blob;
  image?: HTMLImageElement;
  video?: HTMLVideoElement;
  /** Normalised face box (0..1) used by photo avatars. */
  face?: { x: number; y: number; w: number; h: number };
  /** Exact eye and mouth positions, when the landmark model could run. */
  anchors?: FaceAnchors;
  error?: string;
}

type Listener = () => void;

/**
 * Face box for photo avatars. Uses the experimental FaceDetector when the
 * browser exposes it and falls back to a portrait-friendly heuristic.
 */
export async function detectFaceBox(
  image: HTMLImageElement,
): Promise<{ x: number; y: number; w: number; h: number }> {
  const Detector = (window as unknown as {
    FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
      detect: (source: CanvasImageSource) => Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
    };
  }).FaceDetector;

  if (Detector) {
    try {
      const detector = new Detector({ fastMode: true, maxDetectedFaces: 1 });
      const faces = await detector.detect(image);
      const box = faces[0]?.boundingBox;
      if (box && box.width > 0 && box.height > 0) {
        return {
          x: box.x / image.width,
          y: box.y / image.height,
          w: box.width / image.width,
          h: box.height / image.height,
        };
      }
    } catch {
      /* fall through to the heuristic */
    }
  }

  return { x: 0.24, y: 0.08, w: 0.52, h: 0.5 };
}

/**
 * Landmarks first: they give the exact mouth and eye positions, and a much
 * better face box than any heuristic. Falls back to `detectFaceBox`.
 */
async function analyseFace(image: HTMLImageElement): Promise<{
  face: { x: number; y: number; w: number; h: number };
  anchors?: FaceAnchors;
}> {
  try {
    const anchors = await detectFaceAnchors(image);
    if (anchors && anchors.face.w > 0.05) {
      return { face: anchors.face, anchors };
    }
  } catch {
    /* the model may not load offline; the heuristic still works */
  }
  return { face: await detectFaceBox(image) };
}

class MediaRegistry {
  private entries = new Map<string, MediaEntry>();
  private pending = new Map<string, Promise<MediaEntry | undefined>>();
  private listeners = new Set<Listener>();
  private version = 0;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getVersion(): number {
    return this.version;
  }

  private emit(): void {
    this.version += 1;
    this.listeners.forEach(listener => listener());
  }

  get(id: string | undefined): MediaEntry | undefined {
    return id ? this.entries.get(id) : undefined;
  }

  async blob(id: string): Promise<Blob | undefined> {
    const entry = this.entries.get(id);
    if (entry?.blob) return entry.blob;
    const stored = await getMediaBlob(id);
    if (stored && entry) entry.blob = stored;
    return stored;
  }

  private async analyseExisting(entry: MediaEntry): Promise<MediaEntry> {
    if (!entry.image) return entry;
    const analysis = await analyseFace(entry.image);
    entry.face = analysis.face;
    entry.anchors = analysis.anchors;
    this.emit();
    return entry;
  }

  ensure(
    asset: MediaAsset,
    options: { face?: boolean } = {},
  ): Promise<MediaEntry | undefined> {
    const existing = this.entries.get(asset.id);
    if (existing && !existing.error) {
      if (options.face && existing.image && !existing.face) {
        return this.analyseExisting(existing);
      }
      return Promise.resolve(existing);
    }
    const running = this.pending.get(asset.id);
    if (running) {
      return running.then(entry => {
        if (options.face && entry?.image && !entry.face) {
          return this.analyseExisting(entry);
        }
        return entry;
      });
    }

    const task = (async () => {
      try {
        const blob = await getMediaBlob(asset.id);
        if (!blob) throw new Error("Arquivo não encontrado no navegador");
        const url = URL.createObjectURL(blob);
        const entry: MediaEntry = { asset, url, blob };

        if (asset.kind === "image") {
          const image = new Image();
          image.decoding = "async";
          await new Promise<void>((resolve, reject) => {
            let settled = false;
            const finish = (error?: Error) => {
              if (settled) return;
              settled = true;
              window.clearTimeout(timer);
              if (error) reject(error);
              else resolve();
            };
            const timer = window.setTimeout(
              () => finish(new Error("Tempo esgotado ao carregar a imagem")),
              10_000,
            );
            image.onload = () => finish();
            image.onerror = () => finish(new Error("Imagem inválida"));
            image.src = url;
          });
          entry.image = image;
          // Face landmarks are only needed by photo avatars. Running MediaPipe
          // for every background/photo made the first import load ~33 MB of
          // wasm and model for nothing.
          if (options.face) {
            const analysis = await analyseFace(image);
            entry.face = analysis.face;
            entry.anchors = analysis.anchors;
          }
        }

        if (asset.kind === "video") {
          const video = document.createElement("video");
          video.src = url;
          video.muted = true;
          video.playsInline = true;
          video.preload = "auto";
          video.loop = true;
          video.crossOrigin = "anonymous";
          await new Promise<void>(resolve => {
            const done = () => resolve();
            video.onloadeddata = done;
            video.onerror = done;
            setTimeout(done, 4000);
          });
          entry.video = video;
        }

        this.entries.set(asset.id, entry);
        this.emit();
        return entry;
      } catch (error) {
        const entry: MediaEntry = {
          asset,
          url: "",
          error: (error as Error).message,
        };
        this.entries.set(asset.id, entry);
        this.emit();
        return entry;
      } finally {
        this.pending.delete(asset.id);
      }
    })();

    this.pending.set(asset.id, task);
    return task;
  }

  async ensureAll(
    assets: MediaAsset[],
    options: { face?: boolean } = {},
  ): Promise<void> {
    await Promise.all(assets.map(asset => this.ensure(asset, options)));
  }

  forget(id: string): void {
    const entry = this.entries.get(id);
    if (entry?.url) URL.revokeObjectURL(entry.url);
    this.entries.delete(id);
    this.emit();
  }
}

export const mediaRegistry = new MediaRegistry();

function sceneStartTimes(project: Project): number[] {
  const starts: number[] = [];
  let acc = 0;
  for (const scene of project.scenes) {
    starts.push(acc);
    acc += scene.duration;
  }
  return starts;
}

/** Wrap the target into the media duration (video layers loop). */
function wrapVideoTime(video: HTMLVideoElement, target: number): number {
  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0.1) return Math.max(0, target);
  return ((target % duration) + duration) % duration;
}

function activeVideoSources(
  project: Project,
  time: number,
): Array<{ mediaId: string; video: HTMLVideoElement; target: number }> {
  const starts = sceneStartTimes(project);
  const sources: Array<{
    mediaId: string;
    video: HTMLVideoElement;
    target: number;
  }> = [];

  project.scenes.forEach((scene, sceneIndex) => {
    const sceneTime = time - starts[sceneIndex];
    if (sceneTime < 0 || sceneTime > scene.duration) return;

    const background = scene.background;
    if (background.type === "video" && background.mediaId) {
      const video = mediaRegistry.get(background.mediaId)?.video;
      if (video) {
        sources.push({
          mediaId: background.mediaId,
          video,
          target: (background.startAt ?? 0) + sceneTime,
        });
      }
    }

    for (const layer of scene.layers) {
      if (layer.kind !== "video" || layer.hidden) continue;
      const video = mediaRegistry.get(layer.mediaId)?.video;
      if (video) {
        sources.push({
          mediaId: layer.mediaId,
          video,
          target: layer.startAt + sceneTime,
        });
      }
    }
  });

  return sources;
}

/**
 * Keeps video layers and video backgrounds in sync with the timeline clock.
 * Called on every rendered frame for both the live preview and the recorder.
 */
export function syncVideoLayers(project: Project, time: number, playing: boolean): void {
  const sources = activeVideoSources(project, time);
  const active = new Set<string>();

  for (const { mediaId, video, target } of sources) {
    active.add(mediaId);
    const wrapped = wrapVideoTime(video, target);
    if (Math.abs(video.currentTime - wrapped) > 0.45) {
      try {
        video.currentTime = wrapped;
      } catch {
        /* seeking may fail before metadata is ready */
      }
    }
    if (playing && video.paused) void video.play().catch(() => undefined);
    if (!playing && !video.paused) video.pause();
  }

  // Pause every video that is not used by the current frame, so hidden
  // layers and backgrounds do not keep decoding in the background.
  project.media.forEach(asset => {
    if (asset.kind !== "video" || active.has(asset.id)) return;
    const video = mediaRegistry.get(asset.id)?.video;
    if (video && !video.paused) video.pause();
  });
}

/**
 * Waits until every active video is showing the frame for `time`. Used before
 * exporting a still PNG and before the first exported video frame, where the
 * browser needs a moment to complete the seek.
 */
export async function prepareVideoFrame(project: Project, time: number): Promise<void> {
  const sources = activeVideoSources(project, time);
  const waits: Promise<void>[] = [];

  for (const { video, target } of sources) {
    const wrapped = wrapVideoTime(video, target);
    if (Math.abs(video.currentTime - wrapped) <= 0.02) continue;
    waits.push(
      new Promise<void>(resolve => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          video.removeEventListener("seeked", finish);
          resolve();
        };
        const timer = window.setTimeout(finish, 700);
        video.addEventListener("seeked", finish, { once: true });
        try {
          video.currentTime = wrapped;
        } catch {
          finish();
        }
      }),
    );
  }

  syncVideoLayers(project, time, false);
  await Promise.all(waits);
}
