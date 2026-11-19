/**
 * Script-to-video: splits a pasted script into scenes, narrates each scene with
 * the neural voice, transcribes it for karaoke captions and saves the project.
 * Everything runs in one go so the user does not need to stitch clips later.
 */
import type {
  FormatPresetId,
  Project,
  ProjectKind,
  Scene,
} from "@shared/editor";
import {
  DEFAULT_CAPTIONS,
  DEFAULT_THEME,
  PROJECT_SCHEMA_VERSION,
  buildTemplateLayers,
  formatPreset,
  newAvatarLayer,
  newScene,
  uid,
} from "@shared/editor";
import { durationOf } from "@/engine/audio";
import { estimateWordTimings } from "@/lib/timing";
import { generateNarration } from "@/lib/api";
import { importFiles } from "@/lib/mediaImport";
import { saveProject } from "@/lib/storage";

export function splitScript(text: string, maxChars = 320): string[] {
  const clean = text.replace(/\r/g, "").trim();
  if (!clean) return [];
  const paragraphs = clean
    .split(/\n{2,}/)
    .map(part => part.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  for (const paragraph of paragraphs) {
    const sentences = paragraph.match(/[^.!?]+[.!?]*/g) ?? [paragraph];
    let buffer = "";
    for (const raw of sentences) {
      const sentence = raw.trim();
      if (!sentence) continue;
      const candidate = buffer ? `${buffer} ${sentence}` : sentence;
      if (candidate.length > maxChars && buffer) {
        chunks.push(buffer);
        buffer = sentence;
      } else {
        buffer = candidate;
      }
    }
    if (buffer.trim()) chunks.push(buffer.trim());
  }
  return chunks.filter(chunk => chunk.length > 1);
}

export function estimateSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(2.5, words / 2.6);
}

function headline(text: string, max = 52): string {
  const firstSentence = text.split(/(?<=[.!?])\s/)[0] ?? text;
  const trimmed = firstSentence.replace(/[.!?]+$/, "").trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 24 ? lastSpace : max)}…`;
}

export interface ScriptVideoOptions {
  script: string;
  title: string;
  voiceId: string;
  rate: number;
  pitch: number;
  format: FormatPresetId;
  withAvatar: boolean;
  withCaptions: boolean;
  kind?: ProjectKind;
  onProgress?: (info: { step: string; index: number; total: number }) => void;
}

function buildScene(
  chunk: string,
  index: number,
  total: number,
  width: number,
  height: number,
  accent: string,
  withAvatar: boolean
): Scene {
  const template =
    index === 0 ? "capa" : index === total - 1 && total > 1 ? "cta" : "topico";
  const layers = buildTemplateLayers(template, width, height, accent);
  const title = headline(chunk);
  // The full text lives in the captions, so the visual stays clean.
  const secondary = "";

  const prepared = layers
    .map(layer => {
      if (layer.kind !== "text") return layer;
      if (
        layer.name === "Título" ||
        layer.name === "Citação" ||
        layer.name === "Chamada"
      ) {
        return { ...layer, text: title };
      }
      if (
        layer.name === "Subtítulo" ||
        layer.name === "Explicação" ||
        layer.name === "Linha de apoio"
      ) {
        return { ...layer, text: secondary };
      }
      return layer;
    })
    .filter(layer => !(layer.kind === "text" && layer.text === ""));

  if (withAvatar && template !== "cta") {
    // Keep the avatar fully inside the frame, with a margin, on every aspect ratio.
    const vertical = height > width;
    const size = Math.round(Math.min(width, height) * (vertical ? 0.34 : 0.3));
    const margin = Math.round(width * 0.06);
    prepared.push(
      newAvatarLayer({
        x: Math.round(width - size - margin),
        y: Math.round(height * 0.52),
        w: size,
        h: size,
        animDelay: 0.2,
      })
    );
  }

  return newScene({
    name: `Cena ${index + 1}`,
    duration: Math.max(3, Math.round(estimateSeconds(chunk))),
    background: {
      type: "gradient",
      color: "#0B0B10",
      color2: index % 2 === 0 ? "#2A1408" : "#101C24",
      angle: 140,
      dim: 0,
      blur: 0,
      kenBurns: "none",
    },
    layers: prepared,
    narration: {
      text: chunk,
      voiceId: "",
      rate: 1,
      pitch: 1,
    },
    transition: { type: "fade", duration: 0.5 },
  });
}

export async function generateVideoFromScript(
  options: ScriptVideoOptions
): Promise<Project> {
  const chunks = splitScript(options.script);
  if (chunks.length === 0)
    throw new Error("Cole um roteiro com pelo menos uma frase.");

  const preset = formatPreset(options.format);
  const now = Date.now();
  const scenes = chunks.map((chunk, index) =>
    buildScene(
      chunk,
      index,
      chunks.length,
      preset.width,
      preset.height,
      DEFAULT_THEME.accent,
      options.withAvatar
    )
  );

  const project: Project = {
    id: uid("project"),
    kind: options.kind ?? "aula",
    name: options.title.trim() || "Vídeo do roteiro",
    schemaVersion: PROJECT_SCHEMA_VERSION,
    format: preset.id,
    width: preset.width,
    height: preset.height,
    scenes,
    media: [],
    captions: { ...DEFAULT_CAPTIONS },
    theme: { ...DEFAULT_THEME },
    createdAt: now,
    updatedAt: now,
  };

  await saveProject(project);

  for (let index = 0; index < project.scenes.length; index += 1) {
    const scene = project.scenes[index];
    options.onProgress?.({
      step: "Gerando narração",
      index,
      total: project.scenes.length,
    });
    try {
      const blob = await generateNarration({
        text: scene.narration.text,
        voiceId: options.voiceId,
        rate: options.rate,
        pitch: options.pitch,
      });
      const extension = blob.type.includes("wav") ? "wav" : "mp3";
      const file = new File(
        [blob],
        `narracao-${index + 1}-${Date.now()}.${extension}`,
        {
          type: blob.type || "audio/mpeg",
        }
      );
      const [asset] = await importFiles([file]);
      if (asset) {
        project.media.push(asset);
        const duration = await durationOf(blob);
        scene.narration.assetId = asset.id;
        scene.narration.duration = duration;
        scene.narration.voiceId = options.voiceId;
        scene.narration.rate = options.rate;
        scene.narration.pitch = options.pitch;
        scene.duration = Number(Math.max(3, duration + 0.7).toFixed(2));
      }
    } catch (error) {
      options.onProgress?.({
        step: `Cena ${index + 1}: falha na narração (${(error as Error).message})`,
        index,
        total: project.scenes.length,
      });
    }

    if (options.withCaptions && scene.narration.duration) {
      options.onProgress?.({
        step: "Sincronizando legendas",
        index,
        total: project.scenes.length,
      });
      // Local timing: no speech service, no cost.
      scene.narration.words = estimateWordTimings(
        scene.narration.text,
        scene.narration.duration
      );
    }

    project.updatedAt = Date.now();
    await saveProject(project);
    options.onProgress?.({
      step: "Cena concluída",
      index,
      total: project.scenes.length,
    });
  }

  project.updatedAt = Date.now();
  await saveProject(project);
  return project;
}
