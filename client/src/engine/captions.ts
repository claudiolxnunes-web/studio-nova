/**
 * Captions: builds timed lines from transcription words (or from the script as
 * a fallback) and renders them as karaoke-style subtitles.
 */
import {
  narrationLength,
  sceneStartTimes,
  type CaptionSettings,
  type Project,
  type Scene,
  type WordTiming,
} from "@shared/editor";

export interface CaptionLine {
  words: WordTiming[];
  start: number;
  end: number;
}

export function buildCaptionLines(
  words: WordTiming[] | undefined,
  text: string,
  duration: number,
  maxWords: number,
): CaptionLine[] {
  const limit = Math.max(2, Math.min(12, maxWords));

  if (words && words.length > 0) {
    const lines: CaptionLine[] = [];
    let current: WordTiming[] = [];
    for (const word of words) {
      current.push(word);
      const endsSentence = /[.!?…]$/.test(word.word);
      if (current.length >= limit || endsSentence) {
        lines.push({
          words: current,
          start: current[0].start,
          end: current[current.length - 1].end,
        });
        current = [];
      }
    }
    if (current.length > 0) {
      lines.push({
        words: current,
        start: current[0].start,
        end: current[current.length - 1].end,
      });
    }
    return lines;
  }

  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const perLine = limit;
  const lineCount = Math.ceil(tokens.length / perLine);
  const step = duration / Math.max(1, lineCount);
  const lines: CaptionLine[] = [];
  for (let index = 0; index < lineCount; index += 1) {
    const slice = tokens.slice(index * perLine, (index + 1) * perLine);
    if (slice.length === 0) continue;
    const lineStart = index * step;
    const wordStep = step / slice.length;
    lines.push({
      start: lineStart,
      end: lineStart + step,
      words: slice.map((word, wordIndex) => ({
        word,
        start: lineStart + wordIndex * wordStep,
        end: lineStart + (wordIndex + 1) * wordStep,
      })),
    });
  }
  return lines;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
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

export function drawCaptions(
  ctx: CanvasRenderingContext2D,
  project: Project,
  scene: Scene,
  sceneTime: number,
): void {
  const settings: CaptionSettings = project.captions;
  if (!settings.enabled) return;

  const lines = buildCaptionLines(
    scene.narration.words,
    scene.narration.text,
    scene.duration,
    settings.maxWordsPerLine,
  );
  const line = lines.find(item => sceneTime >= item.start - 0.08 && sceneTime <= item.end + 0.12);
  if (!line) return;

  const fontSize = settings.fontSize * (project.width / 1080);
  const paddingX = fontSize * 0.42;
  const paddingY = fontSize * 0.24;
  const gap = fontSize * 0.28;

  ctx.save();
  ctx.font = `600 ${fontSize}px "Inter", system-ui, sans-serif`;
  ctx.textBaseline = "middle";

  const words = line.words.map(word => ({
    ...word,
    text: settings.uppercase ? word.word.toUpperCase() : word.word,
  }));

  const widths = words.map(word => ctx.measureText(word.text).width);
  const totalWidth = widths.reduce((sum, width) => sum + width, 0) + gap * (words.length - 1);
  const maxWidth = project.width * 0.86;

  let scale = 1;
  if (totalWidth + paddingX * 2 > maxWidth) {
    scale = maxWidth / (totalWidth + paddingX * 2);
  }

  const centerX = project.width / 2;
  const baseY =
    settings.position === "bottom"
      ? project.height - settings.margin * (project.height / 1080) - fontSize
      : settings.margin * (project.height / 1080) + fontSize;

  ctx.translate(centerX, baseY);
  ctx.scale(scale, scale);

  const boxWidth = totalWidth + paddingX * 2;
  const boxHeight = fontSize + paddingY * 2;
  if (settings.bgOpacity > 0.01) {
    ctx.globalAlpha = settings.bgOpacity;
    ctx.fillStyle = settings.bgColor;
    roundRect(ctx, -boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight, boxHeight * 0.32);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  let cursor = -totalWidth / 2;
  words.forEach((word, index) => {
    const active = sceneTime >= word.start - 0.05 && sceneTime <= word.end + 0.05;
    ctx.fillStyle = active ? settings.highlightColor : settings.color;
    ctx.textAlign = "left";
    ctx.fillText(word.text, cursor, 0);
    cursor += widths[index] + gap;
  });

  ctx.restore();
}

export interface CaptionEntry {
  start: number;
  end: number;
  text: string;
}

/** All visible caption lines with absolute timeline times. */
export function captionEntries(project: Project): CaptionEntry[] {
  const starts = sceneStartTimes(project);
  const entries: CaptionEntry[] = [];

  project.scenes.forEach((scene, index) => {
    const sceneStart = starts[index];
    const sceneDuration = Math.max(0.1, scene.duration);
    const narrationDuration =
      narrationLength(scene.narration) || sceneDuration;
    const lines = buildCaptionLines(
      scene.narration.words,
      scene.narration.text,
      narrationDuration,
      project.captions.maxWordsPerLine,
    );

    for (const line of lines) {
      const text = line.words
        .map(word => word.word)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (!text) continue;
      const start = sceneStart + Math.max(0, Math.min(sceneDuration, line.start));
      const end = sceneStart + Math.max(0, Math.min(sceneDuration, line.end));
      if (end <= start + 0.01) continue;
      entries.push({ start, end, text });
    }
  });

  return entries.sort((a, b) => a.start - b.start);
}

function timestamp(seconds: number, separator: "," | "."): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const ms = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const s = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const m = totalMinutes % 60;
  const h = Math.floor(totalMinutes / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(
    s,
  ).padStart(2, "0")}${separator}${String(ms).padStart(3, "0")}`;
}

/** SRT file, ready for YouTube, Hotmart and most LMS platforms. */
export function captionsToSrt(project: Project): string {
  const entries = captionEntries(project);
  return entries
    .map(
      (entry, index) =>
        `${index + 1}\n${timestamp(entry.start, ",")} --> ${timestamp(
          entry.end,
          ",",
        )}\n${entry.text}\n`,
    )
    .join("\n");
}

/** WebVTT file, ready for browsers, players and social platforms. */
export function captionsToVtt(project: Project): string {
  const entries = captionEntries(project);
  return `WEBVTT\n\n${entries
    .map(
      entry =>
        `${timestamp(entry.start, ".")} --> ${timestamp(entry.end, ".")}\n${
          entry.text
        }\n`,
    )
    .join("\n")}`;
}
