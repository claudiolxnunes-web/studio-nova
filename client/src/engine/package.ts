/**
 * Publication package: one ZIP with every scene rendered as PNG in the chosen
 * formats plus SRT/VTT captions. Ideal for carousels, feed posts, thumbnails and
 * repurposing a lesson for several networks without downloading files one by one.
 */
import { strToU8, zip } from "fflate";
import type { FormatPresetId, Project } from "@shared/editor";
import { formatPreset } from "@shared/editor";
import { captionsToSrt, captionsToVtt } from "./captions";
import { exportSceneImage, safeFileName, scaleProjectToSize } from "./export";

type ZipLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type ArchiveEntry = [Uint8Array, { level: ZipLevel }];

function zipFiles(files: Record<string, ArchiveEntry>): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zip(files, (error, data) => {
      if (error) reject(error);
      else resolve(data);
    });
  });
}

function arrayBufferOf(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function hasCaptionContent(project: Project): boolean {
  return project.scenes.some(
    scene =>
      scene.narration.text.trim().length > 0 ||
      Boolean(scene.narration.assetId) ||
      Boolean(scene.narration.words?.length),
  );
}

export interface PackageOptions {
  formats: FormatPresetId[];
  onProgress?: (progress: number, message: string) => void;
}

export async function exportImagePackage(
  project: Project,
  options: PackageOptions,
): Promise<Blob> {
  const formats = options.formats.length > 0 ? options.formats : [project.format];
  const total = formats.length * project.scenes.length;
  let done = 0;

  const files: Record<string, ArchiveEntry> = {};
  if (hasCaptionContent(project)) {
    files["legendas.srt"] = [strToU8(captionsToSrt(project)), { level: 6 }];
    files["legendas.vtt"] = [strToU8(captionsToVtt(project)), { level: 6 }];
  }

  for (const formatId of formats) {
    const preset = formatPreset(formatId);
    const scaled = scaleProjectToSize(project, preset.width, preset.height);
    const folder = `imagens/${preset.ratio.replace(":", "x")}-${preset.id}`;

    for (let index = 0; index < scaled.scenes.length; index += 1) {
      const label = String(index + 1).padStart(2, "0");
      const file = `${folder}/cena-${label}.png`;
      options.onProgress?.(
        done / Math.max(1, total),
        `Gerando ${preset.label} · cena ${index + 1} de ${scaled.scenes.length}…`,
      );
      const blob = await exportSceneImage(scaled, index, { scale: 1 });
      files[file] = [
        new Uint8Array(await blob.arrayBuffer()),
        { level: 0 },
      ];
      done += 1;
      options.onProgress?.(
        done / Math.max(1, total),
        `Cena ${index + 1} de ${scaled.scenes.length} pronta (${preset.label})`,
      );
    }
  }

  options.onProgress?.(0.98, "Fechando o pacote…");
  const data = await zipFiles(files);
  options.onProgress?.(1, "Pacote pronto");
  return new Blob([arrayBufferOf(data)], { type: "application/zip" });
}

export function imagePackageFileName(project: Project): string {
  return `${safeFileName(project.name)}-pacote.zip`;
}

export interface PostPackageMeta {
  caption: string;
  hashtags: string;
  altTexts?: string[];
}

export interface PostPackageOptions {
  meta: PostPackageMeta;
  onProgress?: (progress: number, message: string) => void;
}

/**
 * Ready-to-publish social package: every slide as PNG plus caption, hashtags,
 * alt text and SRT/VTT. No editor round-trip required.
 */
export async function exportPostPackage(
  project: Project,
  options: PostPackageOptions,
): Promise<Blob> {
  const files: Record<string, ArchiveEntry> = {
    "legenda.txt": [strToU8(options.meta.caption), { level: 6 }],
    "hashtags.txt": [strToU8(options.meta.hashtags), { level: 6 }],
  };
  if (hasCaptionContent(project)) {
    files["legendas.srt"] = [strToU8(captionsToSrt(project)), { level: 6 }];
    files["legendas.vtt"] = [strToU8(captionsToVtt(project)), { level: 6 }];
  }

  if (options.meta.altTexts?.length) {
    files["textos-alternativos.txt"] = [
      strToU8(options.meta.altTexts.join("\n")),
      { level: 6 },
    ];
  }

  for (let index = 0; index < project.scenes.length; index += 1) {
    const label = String(index + 1).padStart(2, "0");
    options.onProgress?.(
      index / Math.max(1, project.scenes.length),
      `Gerando slide ${index + 1} de ${project.scenes.length}…`,
    );
    const blob = await exportSceneImage(project, index, { scale: 1 });
    files[`imagens/slide-${label}.png`] = [
      new Uint8Array(await blob.arrayBuffer()),
      { level: 0 },
    ];
  }

  options.onProgress?.(0.98, "Fechando o pacote…");
  const data = await zipFiles(files);
  options.onProgress?.(1, "Pacote pronto");
  return new Blob([arrayBufferOf(data)], { type: "application/zip" });
}

export function postPackageFileName(project: Project): string {
  return `${safeFileName(project.name)}-postagem.zip`;
}
