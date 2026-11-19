/**
 * Canvas renderer. The exact same function draws the live preview and the
 * exported video, so what you see is what gets recorded.
 */
import type {
  AvatarLayer,
  ImageLayer,
  Layer,
  Project,
  Scene,
  ShapeLayer,
  TextLayer,
  VideoLayer,
} from "@shared/editor";
import { sceneStartTimes, totalDuration } from "@shared/editor";
import { narrationAmplitude } from "./audio";
import { drawAvatar } from "./avatar";
import { drawCaptions } from "./captions";
import { mediaRegistry } from "./media";

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawMediaCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  if (!sourceWidth || !sourceHeight) return;
  const scale = Math.max(w / sourceWidth, h / sourceHeight);
  const drawW = sourceWidth * scale;
  const drawH = sourceHeight * scale;
  ctx.drawImage(source, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH);
}

function drawMediaContain(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  if (!sourceWidth || !sourceHeight) return;
  const scale = Math.min(w / sourceWidth, h / sourceHeight);
  const drawW = sourceWidth * scale;
  const drawH = sourceHeight * scale;
  ctx.drawImage(source, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH);
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function layerAnimation(layer: Layer, sceneTime: number, instant: boolean) {
  if (instant) return { alpha: 1, offsetY: 0, scale: 1 };
  const delay = layer.animDelay ?? 0;
  const progress = clamp((sceneTime - delay) / 0.55);
  const ease = 1 - Math.pow(1 - progress, 3);
  switch (layer.anim ?? "none") {
    case "fade":
      return { alpha: ease, offsetY: 0, scale: 1 };
    case "rise":
      return { alpha: ease, offsetY: (1 - ease) * 64, scale: 1 };
    case "pop": {
      const overshoot = 1 + 0.06 * Math.sin(progress * Math.PI);
      return { alpha: ease, offsetY: 0, scale: 0.9 + 0.1 * ease * overshoot };
    }
    default:
      return { alpha: 1, offsetY: 0, scale: 1 };
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  const paragraphs = text.split("\n");
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function drawTextLayer(
  ctx: CanvasRenderingContext2D,
  layer: TextLayer,
  project: Project,
): void {
  const scale = project.width / 1920;
  const fontSize = layer.fontSize * Math.max(0.5, scale);
  const text = layer.uppercase ? layer.text.toUpperCase() : layer.text;
  ctx.font = `${layer.fontWeight} ${fontSize}px "${layer.fontFamily}", "Inter", system-ui, sans-serif`;
  ctx.textBaseline = "top";
  ctx.textAlign = layer.align === "center" ? "center" : layer.align === "right" ? "right" : "left";
  if ("letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${
      layer.letterSpacing * Math.max(0.5, scale)
    }px`;
  }

  const paddingX = layer.bgEnabled ? fontSize * 0.4 : 0;
  const paddingY = layer.bgEnabled ? fontSize * 0.28 : 0;
  const lines = wrapText(ctx, text, Math.max(40, layer.w - paddingX * 2));
  const lineHeight = fontSize * layer.lineHeight;
  const blockHeight = lines.length * lineHeight;

  const originX = layer.align === "center" ? layer.w / 2 : layer.align === "right" ? layer.w : 0;
  const startY = Math.max(0, (layer.h - blockHeight) / 2);

  if (layer.bgEnabled) {
    ctx.fillStyle = layer.bgColor;
    roundRectPath(
      ctx,
      -paddingX,
      startY - paddingY,
      layer.w + paddingX * 2,
      blockHeight + paddingY * 2,
      layer.bgRadius * Math.max(0.5, scale),
    );
    ctx.fill();
  }

  if (layer.shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = fontSize * 0.35;
    ctx.shadowOffsetY = fontSize * 0.08;
  }

  ctx.fillStyle = layer.color;
  lines.forEach((line, index) => {
    const y = startY + index * lineHeight + (lineHeight - fontSize) * 0.32;
    const highlight = layer.highlightWord?.trim();
    if (highlight && layer.highlightColor && line.includes(highlight)) {
      const segments = line.split(highlight);
      const parts: Array<{ text: string; color: string }> = [];
      segments.forEach((segment, segmentIndex) => {
        if (segment) parts.push({ text: segment, color: layer.color });
        if (segmentIndex < segments.length - 1) {
          parts.push({ text: highlight, color: layer.highlightColor as string });
        }
      });
      const totalWidth = parts.reduce((sum, part) => sum + ctx.measureText(part.text).width, 0);
      let cursor =
        layer.align === "center"
          ? (layer.w - totalWidth) / 2
          : layer.align === "right"
            ? layer.w - totalWidth
            : 0;
      const previousAlign = ctx.textAlign;
      ctx.textAlign = "left";
      parts.forEach(part => {
        ctx.fillStyle = part.color;
        ctx.fillText(part.text, cursor, y);
        cursor += ctx.measureText(part.text).width;
      });
      ctx.textAlign = previousAlign;
      ctx.fillStyle = layer.color;
    } else {
      ctx.fillText(line, originX, y);
    }
    if (layer.strokeWidth && layer.strokeWidth > 0 && layer.strokeColor) {
      ctx.strokeStyle = layer.strokeColor;
      ctx.lineWidth = layer.strokeWidth;
      ctx.lineJoin = "round";
      ctx.strokeText(line, originX, y);
    }
  });
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

/**
 * Shadow pass for image layers. Canvas clips the shadow together with the
 * source, which made `shadow: true` invisible. We render the clipped image on
 * an offscreen canvas first, then draw that opaque silhouette with a shadow.
 */
const imageShadowCache = new Map<string, HTMLCanvasElement>();

function imageShadowSource(
  layer: ImageLayer,
  image: HTMLImageElement,
): HTMLCanvasElement | null {
  const key = `${image.src}|${Math.round(layer.w)}x${Math.round(layer.h)}:${Math.round(
    layer.radius,
  )}:${layer.fit}`;
  const cached = imageShadowCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(layer.w));
  canvas.height = Math.max(1, Math.round(layer.h));
  const shadowCtx = canvas.getContext("2d");
  if (!shadowCtx) return null;

  shadowCtx.save();
  roundRectPath(shadowCtx, 0, 0, layer.w, layer.h, layer.radius);
  shadowCtx.clip();
  if (layer.fit === "cover") {
    drawMediaCover(shadowCtx, image, image.width, image.height, 0, 0, layer.w, layer.h);
  } else {
    drawMediaContain(shadowCtx, image, image.width, image.height, 0, 0, layer.w, layer.h);
  }
  shadowCtx.restore();

  if (imageShadowCache.size > 32) imageShadowCache.clear();
  imageShadowCache.set(key, canvas);
  return canvas;
}

function drawImageLayer(
  ctx: CanvasRenderingContext2D,
  layer: ImageLayer,
  sceneTime: number,
  sceneDuration: number,
): void {
  const entry = mediaRegistry.get(layer.mediaId);
  const image = entry?.image;

  if (image && layer.shadow) {
    const shadowSource = imageShadowSource(layer, image);
    if (shadowSource) {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = 40;
      ctx.shadowOffsetY = 18;
      ctx.drawImage(shadowSource, 0, 0, layer.w, layer.h);
      ctx.restore();
    }
  }

  ctx.save();
  roundRectPath(ctx, 0, 0, layer.w, layer.h, layer.radius);
  ctx.clip();

  if (image) {
    const zoom =
      layer.kenBurns === "none"
        ? 1
        : layer.kenBurns === "in"
          ? 1 + 0.08 * clamp(sceneTime / Math.max(0.1, sceneDuration))
          : 1.08 - 0.08 * clamp(sceneTime / Math.max(0.1, sceneDuration));
    ctx.translate(layer.w / 2, layer.h / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-layer.w / 2, -layer.h / 2);
    if (layer.fit === "cover") {
      drawMediaCover(ctx, image, image.width, image.height, 0, 0, layer.w, layer.h);
    } else {
      drawMediaContain(ctx, image, image.width, image.height, 0, 0, layer.w, layer.h);
    }
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(0, 0, layer.w, layer.h);
  }
  ctx.restore();
}

function drawVideoLayer(
  ctx: CanvasRenderingContext2D,
  layer: VideoLayer,
): void {
  const entry = mediaRegistry.get(layer.mediaId);
  const video = entry?.video;
  ctx.save();
  roundRectPath(ctx, 0, 0, layer.w, layer.h, layer.radius);
  ctx.clip();
  if (video && video.readyState >= 2) {
    if (layer.fit === "cover") {
      drawMediaCover(ctx, video, video.videoWidth, video.videoHeight, 0, 0, layer.w, layer.h);
    } else {
      drawMediaContain(ctx, video, video.videoWidth, video.videoHeight, 0, 0, layer.w, layer.h);
    }
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(0, 0, layer.w, layer.h);
  }
  ctx.restore();
}

function drawShapeLayer(ctx: CanvasRenderingContext2D, layer: ShapeLayer): void {
  ctx.save();
  ctx.fillStyle = layer.fill;
  if (layer.strokeWidth > 0) {
    ctx.strokeStyle = layer.stroke;
    ctx.lineWidth = layer.strokeWidth;
  }
  if (layer.shape === "ellipse") {
    ctx.beginPath();
    ctx.ellipse(layer.w / 2, layer.h / 2, layer.w / 2, layer.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    if (layer.strokeWidth > 0) ctx.stroke();
  } else if (layer.shape === "line") {
    ctx.fillRect(0, layer.h / 2 - Math.max(1, layer.strokeWidth || 2) / 2, layer.w, Math.max(1, layer.strokeWidth || 2));
  } else {
    roundRectPath(ctx, 0, 0, layer.w, layer.h, layer.radius);
    ctx.fill();
    if (layer.strokeWidth > 0) ctx.stroke();
  }
  ctx.restore();
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  project: Project,
  scene: Scene,
  sceneTime: number,
): void {
  const bg = scene.background;
  ctx.save();
  if (bg.type === "solid") {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, project.width, project.height);
  } else if (bg.type === "gradient") {
    const radians = (bg.angle * Math.PI) / 180;
    const halfDiagonal = Math.hypot(project.width, project.height) / 2;
    const cx = project.width / 2;
    const cy = project.height / 2;
    const gradient = ctx.createLinearGradient(
      cx - Math.cos(radians) * halfDiagonal,
      cy - Math.sin(radians) * halfDiagonal,
      cx + Math.cos(radians) * halfDiagonal,
      cy + Math.sin(radians) * halfDiagonal,
    );
    gradient.addColorStop(0, bg.color);
    gradient.addColorStop(1, bg.color2);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, project.width, project.height);
  } else if (bg.type === "image" || bg.type === "video") {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, project.width, project.height);
    const entry = mediaRegistry.get(bg.mediaId);
    const source = bg.type === "image" ? entry?.image : entry?.video;
    if (source) {
      if (bg.blur > 0 && "filter" in ctx) ctx.filter = `blur(${bg.blur}px)`;
      const sourceWidth =
        bg.type === "image" ? (entry?.image?.width ?? 0) : (entry?.video?.videoWidth ?? 0);
      const sourceHeight =
        bg.type === "image" ? (entry?.image?.height ?? 0) : (entry?.video?.videoHeight ?? 0);
      if (sourceWidth && sourceHeight) {
        const baseScale = Math.max(project.width / sourceWidth, project.height / sourceHeight);
        // Slow camera push keeps still backgrounds alive ("cena em movimento").
        const motion = bg.kenBurns ?? "none";
        const progress = clamp(sceneTime / Math.max(0.5, scene.duration), 0, 1);
        const zoom =
          motion === "in"
            ? 1 + progress * 0.1
            : motion === "out"
              ? 1.1 - progress * 0.1
              : 1;
        const scale = baseScale * zoom;
        const drawW = sourceWidth * scale;
        const drawH = sourceHeight * scale;
        const driftX = motion === "none" ? 0 : Math.sin(progress * Math.PI) * project.width * 0.012;
        const driftY = motion === "none" ? 0 : Math.cos(progress * Math.PI) * project.height * 0.008;
        ctx.drawImage(
          source,
          (project.width - drawW) / 2 + driftX,
          (project.height - drawH) / 2 + driftY,
          drawW,
          drawH,
        );
      }
      if ("filter" in ctx) ctx.filter = "none";
    }
    if (bg.dim > 0) {
      ctx.fillStyle = `rgba(6,6,10,${clamp(bg.dim, 0, 0.95)})`;
      ctx.fillRect(0, 0, project.width, project.height);
    }
  }
  ctx.restore();
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  project: Project,
  scene: Scene,
  sceneTime: number,
  instantAnimations = false,
): void {
  drawBackground(ctx, project, scene, sceneTime);

  const amplitude = narrationAmplitude(scene.narration.assetId, sceneTime);

  for (const layer of scene.layers) {
    if (layer.hidden) continue;
    const animation = layerAnimation(layer, sceneTime, instantAnimations);
    if (animation.alpha <= 0.001) continue;

    ctx.save();
    ctx.globalAlpha = clamp(layer.opacity * animation.alpha);
    if (layer.blend) ctx.globalCompositeOperation = layer.blend;
    const filters = layer.filters;
    if (filters) {
      const parts: string[] = [];
      if (filters.brightness !== 1) parts.push(`brightness(${filters.brightness})`);
      if (filters.contrast !== 1) parts.push(`contrast(${filters.contrast})`);
      if (filters.saturate !== 1) parts.push(`saturate(${filters.saturate})`);
      if (filters.blur > 0) parts.push(`blur(${filters.blur}px)`);
      if (filters.grayscale > 0) parts.push(`grayscale(${filters.grayscale})`);
      if (parts.length > 0 && "filter" in ctx) ctx.filter = parts.join(" ");
    }
    if (layer.shadowStyle) {
      ctx.shadowColor = layer.shadowStyle.color;
      ctx.shadowBlur = layer.shadowStyle.blur;
      ctx.shadowOffsetY = layer.shadowStyle.offsetY;
    }
    const cx = layer.x + layer.w / 2;
    const cy = layer.y + layer.h / 2 + animation.offsetY;
    ctx.translate(cx, cy);
    if (layer.rotation) ctx.rotate((layer.rotation * Math.PI) / 180);
    if (animation.scale !== 1) ctx.scale(animation.scale, animation.scale);
    if (layer.flipH || layer.flipV) ctx.scale(layer.flipH ? -1 : 1, layer.flipV ? -1 : 1);
    ctx.translate(-layer.w / 2, -layer.h / 2);

    if (layer.kind === "text") {
      drawTextLayer(ctx, layer, project);
    } else if (layer.kind === "image") {
      drawImageLayer(ctx, layer, sceneTime, scene.duration);
    } else if (layer.kind === "video") {
      drawVideoLayer(ctx, layer);
    } else if (layer.kind === "shape") {
      drawShapeLayer(ctx, layer);
    } else if (layer.kind === "avatar") {
      drawAvatar(ctx, layer as AvatarLayer, { amplitude, sceneTime });
    }

    if (layer.border && layer.border.width > 0) {
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.lineWidth = layer.border.width;
      ctx.strokeStyle = layer.border.color;
      const radius = layer.kind === "image" ? layer.radius : layer.kind === "shape" ? layer.radius : 0;
      if (radius > 0) {
        roundRectPath(ctx, 0, 0, layer.w, layer.h, radius);
        ctx.stroke();
      } else {
        ctx.strokeRect(0, 0, layer.w, layer.h);
      }
    }
    ctx.restore();
  }

  drawCaptions(ctx, project, scene, sceneTime);
}

export interface FrameInfo {
  sceneIndex: number;
  scene: Scene;
  sceneTime: number;
}

export function resolveFrame(project: Project, time: number): FrameInfo {
  const starts = sceneStartTimes(project);
  const total = totalDuration(project);
  const clamped = Math.max(0, Math.min(time, Math.max(0, total - 0.001)));
  let sceneIndex = project.scenes.length - 1;
  for (let index = 0; index < project.scenes.length; index += 1) {
    if (clamped >= starts[index]) sceneIndex = index;
  }
  const scene = project.scenes[sceneIndex];
  return { sceneIndex, scene, sceneTime: clamped - starts[sceneIndex] };
}

export function drawProjectFrame(
  ctx: CanvasRenderingContext2D,
  project: Project,
  time: number,
  instantAnimations = false,
): FrameInfo {
  ctx.save();
  ctx.clearRect(0, 0, project.width, project.height);
  const frame = resolveFrame(project, time);
  const { sceneIndex, scene, sceneTime } = frame;
  const previous = sceneIndex > 0 ? project.scenes[sceneIndex - 1] : null;
  const transition = scene.transition;
  const progress =
    previous && transition.type !== "none"
      ? clamp(sceneTime / Math.max(0.08, transition.duration))
      : 1;

  if (previous && progress < 1) {
    drawScene(ctx, project, previous, previous.duration, instantAnimations);
    ctx.save();
    if (transition.type === "fade") {
      ctx.globalAlpha = progress;
      drawScene(ctx, project, scene, sceneTime, instantAnimations);
    } else if (transition.type === "slide") {
      ctx.translate(project.width * (1 - progress), 0);
      drawScene(ctx, project, scene, sceneTime, instantAnimations);
    } else if (transition.type === "zoom") {
      const scale = 0.88 + 0.12 * progress;
      ctx.globalAlpha = progress;
      ctx.translate(project.width / 2, project.height / 2);
      ctx.scale(scale, scale);
      ctx.translate(-project.width / 2, -project.height / 2);
      drawScene(ctx, project, scene, sceneTime, instantAnimations);
    }
    ctx.restore();
  } else {
    drawScene(ctx, project, scene, sceneTime, instantAnimations);
  }
  ctx.restore();
  return frame;
}

/** Safe-area guides for social formats (preview only, never exported). */
export function drawSafeArea(ctx: CanvasRenderingContext2D, project: Project): void {
  const vertical = project.height > project.width;
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.setLineDash([12, 12]);
  ctx.lineWidth = 3;
  const marginX = project.width * (vertical ? 0.06 : 0.05);
  const marginTop = project.height * (vertical ? 0.13 : 0.06);
  const marginBottom = project.height * (vertical ? 0.16 : 0.06);
  ctx.strokeRect(
    marginX,
    marginTop,
    project.width - marginX * 2,
    project.height - marginTop - marginBottom,
  );
  ctx.restore();
}
