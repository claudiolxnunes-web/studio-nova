/**
 * Presenter avatars drawn with vector shapes so the mouth, eyes and head can
 * follow the narration in real time (no external avatar service needed).
 * Everything is drawn inside a 100x100 unit box centred on the circle.
 */
import type { AvatarLayer } from "@shared/editor";
import { avatarPreset, type AvatarPreset } from "@shared/editor";
import { mediaRegistry } from "./media";
import { drawTalkingPortrait } from "./portrait";

interface AvatarDrawOptions {
  amplitude: number;
  sceneTime: number;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawHairBack(
  ctx: CanvasRenderingContext2D,
  preset: AvatarPreset
): void {
  ctx.fillStyle = preset.hairColor;
  if (preset.hair === "long") {
    ctx.beginPath();
    ctx.ellipse(50, 42, 26, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    roundRect(ctx, 25, 38, 50, 40, 20);
    ctx.fill();
  } else if (preset.hair === "bun") {
    ctx.beginPath();
    ctx.arc(50, 13, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(50, 40, 23, 25, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (preset.hair === "curly") {
    for (let index = 0; index < 11; index += 1) {
      const angle = (index / 11) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(
        50 + Math.cos(angle) * 21,
        34 + Math.sin(angle) * 20,
        8.5,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  } else if (preset.hair === "short") {
    ctx.beginPath();
    ctx.ellipse(50, 35, 22, 22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawAvatar(
  ctx: CanvasRenderingContext2D,
  layer: AvatarLayer,
  options: AvatarDrawOptions
): void {
  const preset = avatarPreset(layer.avatarId);
  const size = Math.min(layer.w, layer.h);
  const amplitude = Math.max(0, Math.min(1, options.amplitude));
  const t = options.sceneTime;
  const radius = (size / 2) * 0.93;

  ctx.save();
  ctx.translate(layer.w / 2, layer.h / 2);
  if (layer.mirror) ctx.scale(-1, 1);

  if (layer.ring) {
    const pulse = 1 + amplitude * 0.03;
    ctx.save();
    ctx.globalAlpha = 0.2 + amplitude * 0.28;
    ctx.fillStyle = layer.ringColor;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.02 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = Math.max(1, size * 0.011);
    ctx.strokeStyle = layer.ringColor;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.99 * pulse, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.closePath();
  const backdrop = ctx.createLinearGradient(-radius, -radius, radius, radius);
  backdrop.addColorStop(0, "#232840");
  backdrop.addColorStop(1, "#0C0E17");
  ctx.fillStyle = backdrop;
  ctx.fill();
  ctx.clip();

  if (layer.mode === "photo" && layer.photoMediaId) {
    const entry = mediaRegistry.get(layer.photoMediaId);
    const image = entry?.image;
    if (image) {
      ctx.save();
      drawTalkingPortrait(ctx, image, entry.face, {
        x: -radius,
        y: -radius,
        width: radius * 2,
        height: radius * 2,
        radius,
        time: t,
        amplitude,
        anchors: entry.anchors,
      });
      ctx.restore();
      ctx.restore();
      ctx.restore();
      return;
    }
  }

  const bobY = layer.bob
    ? Math.sin(t * 1.9) * size * 0.006 - amplitude * size * 0.01
    : 0;
  ctx.translate(0, bobY);
  ctx.scale(size / 100, size / 100);
  ctx.translate(-50, -50);

  // Shoulders and torso.
  ctx.fillStyle = preset.shirt;
  ctx.beginPath();
  ctx.moveTo(-6, 104);
  ctx.quadraticCurveTo(0, 78, 30, 70);
  ctx.lineTo(70, 70);
  ctx.quadraticCurveTo(100, 78, 106, 104);
  ctx.closePath();
  ctx.fill();

  // Neck with a jaw shadow.
  const neckGradient = ctx.createLinearGradient(0, 52, 0, 72);
  neckGradient.addColorStop(0, preset.skinShade);
  neckGradient.addColorStop(1, preset.skin);
  ctx.fillStyle = neckGradient;
  roundRect(ctx, 43.5, 52, 13, 20, 5);
  ctx.fill();
  const neckShadow = ctx.createLinearGradient(0, 52, 0, 60);
  neckShadow.addColorStop(0, "rgba(0,0,0,0.28)");
  neckShadow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = neckShadow;
  roundRect(ctx, 43.5, 52, 13, 9, 4);
  ctx.fill();

  // Collar detail.
  ctx.fillStyle = preset.shirtDark;
  ctx.beginPath();
  ctx.moveTo(44, 68);
  ctx.lineTo(56, 68);
  ctx.lineTo(52, 88);
  ctx.lineTo(48, 88);
  ctx.closePath();
  ctx.fill();

  drawHairBack(ctx, preset);

  // Head with a tapered jaw (less "cartoon circle").
  const headGradient = ctx.createLinearGradient(33, 14, 68, 64);
  headGradient.addColorStop(0, preset.skin);
  headGradient.addColorStop(1, preset.skinShade);
  ctx.fillStyle = headGradient;
  ctx.beginPath();
  ctx.moveTo(29.5, 34);
  ctx.bezierCurveTo(29.5, 18, 39.5, 12, 50, 12);
  ctx.bezierCurveTo(60.5, 12, 70.5, 18, 70.5, 34);
  ctx.bezierCurveTo(70.5, 48.5, 61.5, 61.5, 50, 62);
  ctx.bezierCurveTo(38.5, 61.5, 29.5, 48.5, 29.5, 34);
  ctx.closePath();
  ctx.fill();

  // Soft shadow along the jaw and temples.
  const edgeShade = ctx.createRadialGradient(50, 36, 12, 50, 38, 30);
  edgeShade.addColorStop(0, "rgba(0,0,0,0)");
  edgeShade.addColorStop(1, "rgba(0,0,0,0.16)");
  ctx.fillStyle = edgeShade;
  ctx.fill();

  // Fringe clipped inside the head so the hairline looks natural.
  if (preset.hair !== "bald") {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = preset.hairColor;
    ctx.beginPath();
    ctx.ellipse(50, 18.5, 21, 9.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(36.5, 25, 8.5, 10.5, -0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(63.5, 25.5, 7.5, 9.5, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.09)";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(40, 16.5);
    ctx.quadraticCurveTo(50, 13.5, 61, 17);
    ctx.stroke();
    ctx.restore();
  }

  // Ears with an inner shadow.
  ctx.fillStyle = preset.skinShade;
  ctx.beginPath();
  ctx.ellipse(29.2, 39.5, 3.3, 4.8, 0, 0, Math.PI * 2);
  ctx.ellipse(70.8, 39.5, 3.3, 4.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.14)";
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.arc(29.4, 39.5, 1.7, -1.2, 1.6);
  ctx.arc(70.6, 39.5, 1.7, 1.5, 4.3);
  ctx.stroke();

  if (preset.earrings) {
    ctx.fillStyle = "#E8C87A";
    ctx.beginPath();
    ctx.arc(29.2, 45.6, 1.6, 0, Math.PI * 2);
    ctx.arc(70.8, 45.6, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Eyes: almond shape with iris, lid line and a slow blink.
  const cycle = (t * 0.5 + 1.1) % 1;
  const blink = cycle > 0.955 ? Math.max(0.08, 1 - (cycle - 0.955) * 24) : 1;
  const eyeY = 37.5;
  const eyeCenters = [42.6, 57.4];
  for (const cx of eyeCenters) {
    const eyeH = Math.max(0.22, 1.75 * blink);
    ctx.fillStyle = "#F6F0E9";
    ctx.beginPath();
    ctx.ellipse(cx, eyeY, 3.5, eyeH, 0, 0, Math.PI * 2);
    ctx.fill();
    if (blink > 0.45) {
      ctx.fillStyle = "#4A3226";
      ctx.beginPath();
      ctx.arc(cx + 0.15, eyeY + 0.15, 1.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#20140F";
      ctx.beginPath();
      ctx.arc(cx + 0.15, eyeY + 0.15, 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(cx + 0.65, eyeY - 0.4, 0.34, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(38,24,17,0.8)";
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.ellipse(cx, eyeY, 3.5, eyeH, 0, Math.PI * 1.03, Math.PI * 1.97);
    ctx.stroke();
  }

  // Brows: thin, slightly angled.
  ctx.strokeStyle = preset.brows;
  ctx.lineWidth = 1.15;
  ctx.lineCap = "round";
  const lift = amplitude * 0.8;
  ctx.beginPath();
  ctx.moveTo(38.8, 32.2 - lift);
  ctx.quadraticCurveTo(42.4, 30.6 - lift, 46.2, 31.8 - lift);
  ctx.moveTo(53.8, 31.8 - lift);
  ctx.quadraticCurveTo(57.6, 30.6 - lift, 61.2, 32.2 - lift);
  ctx.stroke();

  // Nose: soft shading instead of a hard line.
  const noseShade = ctx.createLinearGradient(46, 38, 54, 46);
  noseShade.addColorStop(0, "rgba(0,0,0,0)");
  noseShade.addColorStop(1, "rgba(0,0,0,0.13)");
  ctx.fillStyle = noseShade;
  ctx.beginPath();
  ctx.ellipse(50.6, 43.6, 3.1, 2.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(74,44,32,0.32)";
  ctx.beginPath();
  ctx.ellipse(47.9, 45, 0.85, 0.6, 0, 0, Math.PI * 2);
  ctx.ellipse(52.9, 45, 0.85, 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cheek warmth.
  for (const cx of [39.5, 60.5]) {
    const cheek = ctx.createRadialGradient(cx, 44, 1, cx, 44, 6);
    cheek.addColorStop(0, "rgba(196,96,80,0.16)");
    cheek.addColorStop(1, "rgba(196,96,80,0)");
    ctx.fillStyle = cheek;
    ctx.beginPath();
    ctx.arc(cx, 44, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mouth: lips that open with the narration amplitude.
  const openness = 0.08 + amplitude * 0.92;
  const mouthW = 5.8 + amplitude * 2;
  const mouthH = 0.85 + openness * 4;
  const mouthY = 50.6;
  ctx.fillStyle = "#8E4B49";
  ctx.beginPath();
  ctx.ellipse(50, mouthY, mouthW, mouthH, 0, 0, Math.PI * 2);
  ctx.fill();
  if (mouthH > 1.5) {
    ctx.fillStyle = "#F1E8E2";
    ctx.beginPath();
    ctx.ellipse(
      50,
      mouthY - mouthH * 0.42,
      mouthW * 0.72,
      Math.max(0.3, mouthH * 0.26),
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.fillStyle = "#7A3A44";
    ctx.beginPath();
    ctx.ellipse(
      50,
      mouthY + mouthH * 0.42,
      mouthW * 0.5,
      mouthH * 0.22,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
  } else {
    ctx.strokeStyle = "rgba(88,42,40,0.55)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(50 - mouthW * 0.9, mouthY);
    ctx.quadraticCurveTo(50, mouthY + 0.5, 50 + mouthW * 0.9, mouthY);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.beginPath();
  ctx.ellipse(
    50,
    mouthY + mouthH * 0.95,
    mouthW * 0.42,
    Math.max(0.2, mouthH * 0.16),
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Chin and jaw shadow keep the face from looking flat.
  const chinShade = ctx.createLinearGradient(0, 53, 0, 62);
  chinShade.addColorStop(0, "rgba(0,0,0,0)");
  chinShade.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = chinShade;
  ctx.beginPath();
  ctx.ellipse(50, 57, 11, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  if (preset.glasses) {
    ctx.strokeStyle = "#1D2028";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    roundRect(ctx, 36.5, 33, 13, 10, 3.5);
    roundRect(ctx, 50.5, 33, 13, 10, 3.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(49.5, 37);
    ctx.lineTo(50.5, 37);
    ctx.stroke();
  }

  ctx.restore();
  ctx.restore();
}
