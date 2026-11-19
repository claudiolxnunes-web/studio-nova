/**
 * Talking portrait renderer.
 *
 * A still photo is turned into a presenter without leaving the browser: the
 * head sways, the chest breathes, the eyes blink and the mouth opens with the
 * narration. Instead of sliding a hard slice (which looks like a paper cutout),
 * each moving region is warped inside its own canvas with a feathered elliptical
 * mask, so the skin, beard and collar stretch naturally around the seam.
 *
 * Everything is deterministic from `time` and `amplitude`, which means the live
 * preview and the exported video show exactly the same motion.
 */

export interface FaceBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Eye and mouth positions in normalised image coordinates. */
export interface PortraitAnchors {
  eyeY: number;
  eyeLeftX: number;
  eyeRightX: number;
  mouthX: number;
  mouthY: number;
  mouthW: number;
}

export interface PortraitOptions {
  /** Box the portrait is drawn into (top-left corner, in canvas pixels). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Corner radius; use width / 2 for a circular frame. */
  radius?: number;
  time: number;
  /** Smoothed audio level, 0..1. */
  amplitude: number;
  mirror?: boolean;
  /** Blurred photo behind the portrait instead of a flat fill. */
  backdrop?: boolean;
  /** Subtle zoom-in/out drift, in percent. */
  drift?: number;
  /** Exact eye/mouth positions from MediaPipe; far better than guessing. */
  anchors?: PortraitAnchors | null;
}

const BLINK_PERIOD = 3.6;
const BLINK_DURATION = 0.16;

function blinkAmount(time: number): number {
  const phase = ((time % BLINK_PERIOD) + BLINK_PERIOD) % BLINK_PERIOD;
  if (phase > 0.9 && phase < 0.9 + BLINK_DURATION) {
    const t = (phase - 0.9) / BLINK_DURATION;
    return Math.sin(t * Math.PI);
  }
  // Occasional double blink keeps it from feeling metronomic.
  const second = (phase + BLINK_PERIOD * 0.5) % BLINK_PERIOD;
  if (second > 0.94 && second < 0.94 + BLINK_DURATION * 0.8) {
    const t = (second - 0.94) / (BLINK_DURATION * 0.8);
    return Math.sin(t * Math.PI) * 0.7;
  }
  return 0;
}

/** Smooth, deterministic "handheld camera" noise. */
function sway(time: number, seed: number): number {
  return (
    Math.sin(time * 0.55 + seed) * 0.6 +
    Math.sin(time * 1.37 + seed * 2.1) * 0.28 +
    Math.sin(time * 2.9 + seed * 3.7) * 0.12
  );
}

function roundRectPath(
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

interface Placement {
  originX: number;
  originY: number;
  drawW: number;
  drawH: number;
}

/**
 * Row-wise displacement warp.
 *
 * Each destination row samples the portrait from a slightly different height, so
 * the result is one continuous image: no second copy, no mask, no visible seam
 * where the "talking" area ends. `shiftAt` receives the distance from the mouth
 * (or eye) line and returns how far the content should move, in pixels.
 */
function warpRows(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  place: Placement,
  bandTop: number,
  bandBottom: number,
  shiftAt: (position: number, offsetFromCentre: number) => number,
  clip: { x: number; y: number; w: number; h: number },
): void {
  const step = 3;
  const span = Math.max(1, bandBottom - bandTop);
  const centre = (bandTop + bandBottom) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(clip.x, clip.y, clip.w, clip.h);
  ctx.clip();
  for (let y = bandTop; y < bandBottom; y += step) {
    const height = Math.min(step, bandBottom - y);
    const position = (y - bandTop) / span;
    const shift = shiftAt(position, y - centre);
    const srcY = (y - shift - place.originY) / place.drawH;
    if (srcY < -0.05 || srcY > 1.05) continue;
    ctx.drawImage(
      image,
      0,
      srcY * image.height,
      image.width,
      (height / place.drawH) * image.height,
      place.originX,
      y,
      place.drawW,
      height + 0.8,
    );
  }
  ctx.restore();
}

function smoothstep(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}


/**
 * Renders the talking portrait into the current canvas state.
 * The caller is responsible for clipping the final shape.
 */
export function drawTalkingPortrait(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  face: FaceBox | undefined,
  options: PortraitOptions,
): void {
  const { x, y, width, height, time, amplitude, anchors } = options;
  if (width < 4 || height < 4 || !image.width) return;

  const radius = options.radius ?? Math.min(width, height) / 2;
  const safeFace: FaceBox = face && face.w > 0.05
    ? face
    : { x: 0.22, y: 0.06, w: 0.56, h: 0.5 };

  const open = Math.max(0, Math.min(1, amplitude));
  const breathe = Math.sin(time * 1.35) * 0.004 + open * 0.002;
  const drift = ((options.drift ?? 28) / 1000) * Math.sin(time * 0.23);
  const headYaw = sway(time, 1.7) * 0.004;
  const blink = blinkAmount(time);

  ctx.save();
  ctx.beginPath();
  roundRectPath(ctx, x, y, width, height, radius);
  ctx.clip();

  // --- Backdrop: blurred, darkened copy of the photo ----------------------
  if (options.backdrop !== false) {
    const cover = Math.max(width / image.width, height / image.height) * 1.22;
    ctx.save();
    ctx.filter = "blur(22px) saturate(1.15) brightness(0.55)";
    ctx.drawImage(
      image,
      x + (width - image.width * cover) / 2,
      y + (height - image.height * cover) / 2,
      image.width * cover,
      image.height * cover,
    );
    ctx.restore();
  }

  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(headYaw * 0.35);
  ctx.scale(1 + breathe + drift, 1 + breathe + drift);
  ctx.translate(-(x + width / 2), -(y + height / 2));

  if (options.mirror) {
    ctx.translate(x + width / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(x + width / 2), 0);
  }

  // --- Placement: head occupies ~72% of the frame height ------------------
  const faceH = anchors ? Math.max(0.02, anchors.mouthY - anchors.eyeY + 0.14) : Math.max(0.02, safeFace.h);
  const scale = (height * 0.62) / (faceH * image.height);
  const drawW = image.width * scale;
  const drawH = image.height * scale;
  const faceCx = (anchors ? anchors.mouthX : safeFace.x + safeFace.w / 2) * drawW;
  const faceCy = (anchors ? (anchors.eyeY + anchors.mouthY) / 2 : safeFace.y + faceH / 2) * drawH;
  const originX = x + width / 2 - faceCx;
  const originY = y + height * 0.4 - faceCy + open * height * 0.004;

  const drawPortrait = (target: CanvasRenderingContext2D) => {
    target.drawImage(image, originX, originY, drawW, drawH);
  };
  const place: Placement = { originX, originY, drawW, drawH };
  const frameClip = { x, y, w: width, h: height };

  // Base layer.
  drawPortrait(ctx);

  // --- Mouth -------------------------------------------------------------
  const mouthX = anchors
    ? anchors.mouthX * drawW + originX
    : (safeFace.x + safeFace.w / 2) * drawW + originX;
  const mouthY = anchors
    ? anchors.mouthY * drawH + originY
    : (safeFace.y + faceH * 0.73) * drawH + originY;
  const mouthRx = Math.max(
    6,
    anchors ? anchors.mouthW * drawW * 0.78 : safeFace.w * drawW * 0.2,
  );
  const mouthBand = Math.max(
    8,
    anchors ? anchors.mouthW * drawW * 0.85 : faceH * drawH * 0.2,
  );
  const jawDrop = Math.pow(open, 0.78);
  const drop = jawDrop * mouthBand * 0.42;

  if (drop > 0.5) {
    warpRows(
      ctx,
      image,
      place,
      mouthY + mouthBand * 0.06,
      mouthY + mouthBand * 1.45,
      (position, offset) => {
        const window = Math.pow(Math.sin(Math.PI * position), 1.1);
        const bias = 0.6 + 0.4 * Math.min(1, Math.max(0, offset / (mouthBand * 0.8)));
        return drop * window * bias;
      },
      frameClip,
    );

    // A small shadow along the lip seam adds depth without leaving a smudge.
    const seam = ctx.createRadialGradient(
      mouthX,
      mouthY + mouthBand * 0.04,
      1,
      mouthX,
      mouthY + mouthBand * 0.04,
      mouthRx * 0.72,
    );
    seam.addColorStop(0, `rgba(52,12,8,${0.22 * jawDrop})`);
    seam.addColorStop(0.55, `rgba(52,12,8,${0.1 * jawDrop})`);
    seam.addColorStop(1, "rgba(52,12,8,0)");
    ctx.save();
    ctx.fillStyle = seam;
    ctx.beginPath();
    ctx.ellipse(
      mouthX,
      mouthY + mouthBand * 0.04,
      mouthRx * 0.72,
      mouthBand * 0.24,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
  }

  // --- Eyes --------------------------------------------------------------
  if (blink > 0.03) {
    const eyeY = anchors
      ? anchors.eyeY * drawH + originY
      : (safeFace.y + faceH * 0.38) * drawH + originY;
    const eyeSpacing = anchors
      ? Math.abs(anchors.eyeRightX - anchors.eyeLeftX)
      : safeFace.w * 0.36;
    const eyeHalf = Math.max(7, eyeSpacing * drawW * 0.42);
    const squeeze = blink * 0.55;
    warpRows(
      ctx,
      image,
      place,
      eyeY - eyeHalf,
      eyeY + eyeHalf,
      (position, offset) => {
        const window = Math.sin(Math.PI * position);
        return (-(offset * squeeze) / (1 - squeeze)) * window;
      },
      frameClip,
    );
  }

  // --- Grade and vignette ------------------------------------------------
  ctx.save();
  const vignette = ctx.createRadialGradient(
    x + width / 2,
    y + height * 0.45,
    Math.min(width, height) * 0.28,
    x + width / 2,
    y + height * 0.5,
    Math.max(width, height) * 0.78,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.34)");
  ctx.fillStyle = vignette;
  ctx.fillRect(x, y, width, height);
  ctx.restore();

  ctx.restore();
}

