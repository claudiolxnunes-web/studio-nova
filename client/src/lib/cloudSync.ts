/**
 * Cloud sync for Studio Nova.
 *
 * Local-first remains the default: IndexedDB is the source of truth while the
 * person works. When the user asks to sync, newer projects and their media are
 * copied to Supabase; newer cloud projects are brought back to IndexedDB.
 */
import { migrateProject, type MediaAsset, type MediaKind, type Project } from "@shared/editor";
import { supabase } from "@/lib/supabase";
import {
  getMediaBlob,
  listProjects,
  putMedia,
  saveProject,
} from "@/lib/storage";
import {
  chooseSyncAction,
  type SyncAction,
} from "@/lib/cloudSyncCore";

export interface CloudProjectRow {
  id: string;
  name: string;
  schema_version: number;
  data: Project;
  updated_at: string;
}

interface CloudAssetRow {
  asset_id: string;
  name: string;
  kind: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  storage_path: string;
  created_at: string;
}

export type SyncPhase =
  | "checking"
  | "uploading"
  | "downloading"
  | "done";

export interface SyncProgress {
  phase: SyncPhase;
  message: string;
  current: number;
  total: number;
}

export interface SyncResult {
  uploaded: string[];
  downloaded: string[];
  skipped: string[];
  errors: string[];
}

const BUCKET = "media";

function client() {
  if (!supabase) {
    throw new Error(
      "Supabase não configurado. Adicione VITE_SUPABASE_URL e a chave publicável no .env.",
    );
  }
  return supabase;
}

async function currentUserId(): Promise<string> {
  const sb = client();
  const { data, error } = await sb.auth.getSession();
  if (error) throw new Error(error.message);
  const id = data.session?.user.id;
  if (!id) throw new Error("Entre com Gmail para sincronizar com a nuvem.");
  return id;
}

function projectData(value: unknown): Project {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("O projeto na nuvem está vazio ou inválido.");
  }
  return migrateProject(structuredClone(parsed as Project));
}

export async function listCloudProjects(): Promise<CloudProjectRow[]> {
  const userId = await currentUserId();
  const sb = client();
  const { data, error } = await sb
    .from("projects")
    .select("id,name,schema_version,data,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CloudProjectRow[];
}

/**
 * Every media id referenced by the project, with metadata when available.
 * The project.media list is normally complete; collecting references as well
 * makes sync resilient to projects saved by older versions.
 */
export function collectMediaAssets(project: Project): MediaAsset[] {
  const byId = new Map(project.media.map(asset => [asset.id, asset]));
  const ids = new Set(project.media.map(asset => asset.id));

  for (const scene of project.scenes) {
    if (scene.background.mediaId) ids.add(scene.background.mediaId);
    if (scene.narration.assetId) ids.add(scene.narration.assetId);
    for (const layer of scene.layers) {
      if ("mediaId" in layer && layer.mediaId) ids.add(layer.mediaId);
      if (layer.kind === "avatar" && layer.photoMediaId) {
        ids.add(layer.photoMediaId);
      }
    }
  }

  return [...ids].flatMap(id => {
    const asset = byId.get(id);
    return asset ? [asset] : [];
  });
}

async function existingAssetRows(projectId: string, userId: string) {
  const sb = client();
  const { data, error } = await sb
    .from("project_assets")
    .select("asset_id,storage_path,size")
    .eq("user_id", userId)
    .eq("project_id", projectId);
  if (error) throw new Error(error.message);
  return new Map(
    ((data ?? []) as Array<{ asset_id: string; storage_path: string; size: number }>).map(
      row => [row.asset_id, row],
    ),
  );
}

async function uploadProjectMedia(
  project: Project,
  userId: string,
  warnings: string[],
): Promise<void> {
  const sb = client();
  const existing = await existingAssetRows(project.id, userId);
  const assets = collectMediaAssets(project);

  for (const asset of assets) {
    const storagePath = `${userId}/${project.id}/${asset.id}`;
    const previous = existing.get(asset.id);
    if (
      previous &&
      previous.storage_path === storagePath &&
      Number(previous.size) === Number(asset.size)
    ) {
      continue;
    }

    const blob = await getMediaBlob(asset.id);
    if (!blob) {
      warnings.push(`Mídia ausente no computador: ${asset.name}`);
      continue;
    }

    const { error: uploadError } = await sb.storage
      .from(BUCKET)
      .upload(storagePath, blob, {
        upsert: true,
        contentType: asset.mime || blob.type || "application/octet-stream",
      });
    if (uploadError) {
      warnings.push(`Falha ao enviar ${asset.name}: ${uploadError.message}`);
      continue;
    }

    const { error: rowError } = await sb.from("project_assets").upsert(
      {
        user_id: userId,
        project_id: project.id,
        asset_id: asset.id,
        name: asset.name,
        kind: asset.kind,
        mime: asset.mime,
        size: asset.size,
        width: asset.width ?? null,
        height: asset.height ?? null,
        duration: asset.duration ?? null,
        storage_path: storagePath,
      },
      { onConflict: "user_id,project_id,asset_id" },
    );
    if (rowError) {
      warnings.push(`Falha ao registrar ${asset.name}: ${rowError.message}`);
    }
  }
}

export async function pushProjectToCloud(project: Project): Promise<string[]> {
  const userId = await currentUserId();
  const sb = client();
  const warnings: string[] = [];

  // Media first: the JSON row must never point to files that were not uploaded.
  await uploadProjectMedia(project, userId, warnings);

  const { error } = await sb.from("projects").upsert(
    {
      user_id: userId,
      id: project.id,
      name: project.name,
      schema_version: project.schemaVersion,
      data: project,
    },
    { onConflict: "user_id,id" },
  );
  if (error) throw new Error(error.message);
  return warnings;
}

function assetFromRow(row: CloudAssetRow): MediaAsset {
  return {
    id: row.asset_id,
    name: row.name,
    kind: row.kind as MediaKind,
    mime: row.mime,
    size: Number(row.size) || 0,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    duration: row.duration ?? undefined,
    createdAt: Date.parse(row.created_at) || Date.now(),
  };
}

async function downloadAsset(
  asset: MediaAsset,
  row: CloudAssetRow | undefined,
  warnings: string[],
): Promise<void> {
  if (await getMediaBlob(asset.id)) return;
  if (!row?.storage_path) {
    warnings.push(`Mídia sem arquivo na nuvem: ${asset.name}`);
    return;
  }

  const sb = client();
  const { data, error } = await sb.storage.from(BUCKET).download(row.storage_path);
  if (error || !data) {
    warnings.push(
      `Falha ao baixar ${asset.name}: ${error?.message ?? "arquivo vazio"}`,
    );
    return;
  }
  await putMedia(asset, data);
}

export interface PullProjectResult {
  project: Project;
  warnings: string[];
}

export async function pullProjectFromCloud(
  projectId: string,
): Promise<PullProjectResult> {
  const userId = await currentUserId();
  const sb = client();

  const { data: row, error } = await sb
    .from("projects")
    .select("id,name,schema_version,data,updated_at")
    .eq("user_id", userId)
    .eq("id", projectId)
    .single();
  if (error || !row) {
    throw new Error(error?.message ?? "Projeto não encontrado na nuvem.");
  }

  const project = projectData((row as CloudProjectRow).data);
  const { data: assetRows, error: assetsError } = await sb
    .from("project_assets")
    .select(
      "asset_id,name,kind,mime,size,width,height,duration,storage_path,created_at",
    )
    .eq("user_id", userId)
    .eq("project_id", projectId);
  if (assetsError) throw new Error(assetsError.message);

  const rows = new Map(
    ((assetRows ?? []) as CloudAssetRow[]).map(asset => [asset.asset_id, asset]),
  );
  const warnings: string[] = [];
  const known = new Set(project.media.map(asset => asset.id));

  for (const asset of project.media) {
    await downloadAsset(asset, rows.get(asset.id), warnings);
  }

  // Recover files that exist in the bucket but were missing from the JSON.
  for (const rowAsset of rows.values()) {
    if (known.has(rowAsset.asset_id)) continue;
    const asset = assetFromRow(rowAsset);
    project.media.push(asset);
    known.add(asset.id);
    await downloadAsset(asset, rowAsset, warnings);
  }

  await saveProject(project);
  return { project, warnings };
}

export async function deleteCloudProject(projectId: string): Promise<void> {
  const userId = await currentUserId();
  const sb = client();
  const folder = `${userId}/${projectId}`;

  const { data: files, error: listError } = await sb.storage
    .from(BUCKET)
    .list(folder);
  if (listError) throw new Error(listError.message);

  if (files?.length) {
    const paths = files.map(file => `${folder}/${file.name}`);
    const { error: removeError } = await sb.storage.from(BUCKET).remove(paths);
    if (removeError) throw new Error(removeError.message);
  }

  const { error: assetsError } = await sb
    .from("project_assets")
    .delete()
    .eq("user_id", userId)
    .eq("project_id", projectId);
  if (assetsError) throw new Error(assetsError.message);

  const { error: projectError } = await sb
    .from("projects")
    .delete()
    .eq("user_id", userId)
    .eq("id", projectId);
  if (projectError) throw new Error(projectError.message);
}

function labelFor(
  id: string,
  local: Project | undefined,
  cloud: CloudProjectRow | undefined,
): string {
  return cloud?.name || local?.name || id;
}

export async function syncAllProjects(
  onProgress?: (progress: SyncProgress) => void,
): Promise<SyncResult> {
  const localProjects = await listProjects();
  const cloudProjects = await listCloudProjects();
  const localById = new Map(localProjects.map(project => [project.id, project]));
  const cloudById = new Map(cloudProjects.map(project => [project.id, project]));
  const ids = new Set([...localById.keys(), ...cloudById.keys()]);
  const result: SyncResult = {
    uploaded: [],
    downloaded: [],
    skipped: [],
    errors: [],
  };

  let index = 0;
  onProgress?.({
    phase: "checking",
    message: "Comparando projetos…",
    current: 0,
    total: ids.size,
  });

  for (const id of ids) {
    const local = localById.get(id);
    const cloud = cloudById.get(id);
    const action: SyncAction = chooseSyncAction(local, cloud);
    const name = labelFor(id, local, cloud);
    index += 1;

    try {
      if (action === "upload" && local) {
        onProgress?.({
          phase: "uploading",
          message: `Enviando ${name}…`,
          current: index,
          total: ids.size,
        });
        const warnings = await pushProjectToCloud(local);
        result.uploaded.push(name);
        result.errors.push(...warnings.map(warning => `${name}: ${warning}`));
      } else if (action === "download" && cloud) {
        onProgress?.({
          phase: "downloading",
          message: `Baixando ${name}…`,
          current: index,
          total: ids.size,
        });
        const pulled = await pullProjectFromCloud(cloud.id);
        result.downloaded.push(pulled.project.name);
        result.errors.push(
          ...pulled.warnings.map(warning => `${pulled.project.name}: ${warning}`),
        );
      } else {
        result.skipped.push(name);
      }
    } catch (error) {
      result.errors.push(`${name}: ${(error as Error).message}`);
    }
  }

  onProgress?.({
    phase: "done",
    message: "Sincronização concluída.",
    current: ids.size,
    total: ids.size,
  });
  return result;
}
