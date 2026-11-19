/**
 * Project archive (.nova.zip): one portable file with the project JSON and
 * every media blob. It is the backup/transfer format for the local-first
 * editor and does not depend on the browser that created it.
 */
import { strFromU8, strToU8, unzip, zip } from "fflate";
import {
  PROJECT_SCHEMA_VERSION,
  migrateProject,
  uid,
  type MediaAsset,
  type Project,
} from "@shared/editor";
import { captionsToSrt, captionsToVtt } from "@/engine/captions";
import { getMediaBlob, putMedia, saveProject } from "./storage";

function archiveName(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9-_ ]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase() || "projeto"
  );
}

type ZipLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

function zipFiles(
  files: Record<string, [Uint8Array, { level: ZipLevel }]>,
): Promise<Uint8Array> {
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

function unzipFiles(data: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    unzip(data, (error, files) => {
      if (error) reject(error);
      else resolve(files);
    });
  });
}

export function projectArchiveFileName(project: Project): string {
  return `${archiveName(project.name)}.nova.zip`;
}

export async function exportProjectArchive(
  project: Project,
  onProgress?: (progress: number, message: string) => void,
): Promise<Blob> {
  const snapshot = migrateProject(structuredClone(project));
  snapshot.schemaVersion = PROJECT_SCHEMA_VERSION;

  const files: Record<string, [Uint8Array, { level: ZipLevel }]> = {
    "project.json": [
      strToU8(JSON.stringify(snapshot, null, 2)),
      { level: 6 },
    ],
    "legendas.srt": [strToU8(captionsToSrt(snapshot)), { level: 6 }],
    "legendas.vtt": [strToU8(captionsToVtt(snapshot)), { level: 6 }],
  };

  for (let index = 0; index < snapshot.media.length; index += 1) {
    const asset = snapshot.media[index];
    onProgress?.(
      0.1 + (index / Math.max(1, snapshot.media.length)) * 0.7,
      `Empacotando ${asset.name}…`,
    );
    const blob = await getMediaBlob(asset.id);
    if (!blob) continue;
    files[`media/${asset.id}`] = [
      new Uint8Array(await blob.arrayBuffer()),
      { level: 0 },
    ];
  }

  onProgress?.(0.9, "Fechando o arquivo…");
  const data = await zipFiles(files);
  onProgress?.(1, "Pacote pronto");
  return new Blob([arrayBufferOf(data)], { type: "application/zip" });
}

function remapMediaReferences(project: Project, mapping: Map<string, string>): void {
  project.scenes = project.scenes.map(scene => {
    const background = { ...scene.background };
    if (background.mediaId) {
      const mapped = mapping.get(background.mediaId);
      if (mapped) background.mediaId = mapped;
      else {
        background.mediaId = undefined;
        background.type = "gradient";
      }
    }

    const narration = { ...scene.narration };
    if (narration.assetId) {
      const mapped = mapping.get(narration.assetId);
      if (mapped) narration.assetId = mapped;
      else {
        narration.assetId = undefined;
        narration.words = undefined;
        narration.duration = undefined;
        narration.offset = 0;
      }
    }

    const layers = scene.layers.flatMap(layer => {
      if ("mediaId" in layer && layer.mediaId) {
        const mapped = mapping.get(layer.mediaId);
        if (!mapped) return [];
        layer.mediaId = mapped;
      }
      if (layer.kind === "avatar" && layer.photoMediaId) {
        const mapped = mapping.get(layer.photoMediaId);
        if (mapped) {
          layer.photoMediaId = mapped;
        } else {
          layer.photoMediaId = undefined;
          layer.mode = "vector";
        }
      }
      return [layer];
    });

    return { ...scene, background, narration, layers };
  });
}

export async function importProjectArchive(
  file: File,
  onProgress?: (progress: number, message: string) => void,
): Promise<Project> {
  const data = new Uint8Array(await file.arrayBuffer());
  const entries = await unzipFiles(data);
  const projectEntry = entries["project.json"];
  if (!projectEntry) {
    throw new Error("Arquivo inválido: project.json não encontrado.");
  }

  const parsed = JSON.parse(strFromU8(projectEntry)) as Project;
  const source = migrateProject(parsed);
  const mapping = new Map<string, string>();
  const media: MediaAsset[] = [];

  for (let index = 0; index < source.media.length; index += 1) {
    const asset = source.media[index];
    const bytes = entries[`media/${asset.id}`];
    if (!bytes) continue;
    const next: MediaAsset = {
      ...asset,
      id: uid("media"),
      createdAt: Date.now(),
    };
    onProgress?.(
      0.15 + (index / Math.max(1, source.media.length)) * 0.7,
      `Importando ${asset.name}…`,
    );
    await putMedia(
      next,
      new Blob([arrayBufferOf(bytes)], {
        type: asset.mime || "application/octet-stream",
      }),
    );
    media.push(next);
    mapping.set(asset.id, next.id);
  }

  remapMediaReferences(source, mapping);
  source.id = uid("project");
  source.name = source.name || "Projeto importado";
  source.schemaVersion = PROJECT_SCHEMA_VERSION;
  source.media = media;
  source.createdAt = Date.now();
  source.updatedAt = Date.now();

  onProgress?.(0.95, "Salvando projeto…");
  await saveProject(source);
  onProgress?.(1, "Projeto importado");
  return source;
}
