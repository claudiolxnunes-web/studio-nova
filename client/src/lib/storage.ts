/**
 * Local persistence: projects are JSON documents, media files are blobs.
 * Everything stays in the browser (IndexedDB) so a lesson never leaves the
 * editor unless the person exports it.
 */
import { migrateProject, type MediaAsset, type Project } from "@shared/editor";

// Kept from the first version so projects saved before the rename stay readable.
const DB_NAME = "estudio-de-aulas";
const DB_VERSION = 1;
const STORE_PROJECTS = "projects";
const STORE_MEDIA = "media";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_MEDIA)) {
        db.createObjectStore(STORE_MEDIA, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha ao abrir o banco local"));
  });
  return dbPromise;
}

async function withStore<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest | void,
): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const objectStore = tx.objectStore(store);
    let request: IDBRequest | void;
    try {
      request = run(objectStore);
    } catch (error) {
      reject(error);
      return;
    }
    tx.oncomplete = () => {
      if (request && "result" in request) resolve(request.result as T);
      else resolve(undefined);
    };
    tx.onerror = () => reject(tx.error ?? new Error("Falha no armazenamento local"));
    tx.onabort = () => reject(tx.error ?? new Error("Operação cancelada"));
  });
}

export async function listProjects(): Promise<Project[]> {
  const result = await withStore<Project[]>(STORE_PROJECTS, "readonly", store => store.getAll());
  const projects = (result ?? []).map(project => {
    try {
      return migrateProject(project);
    } catch (error) {
      console.warn("[storage] projeto incompatível ignorado", project?.id, error);
      return null;
    }
  }).filter((project): project is Project => project !== null);
  return projects.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveProject(project: Project): Promise<void> {
  await withStore(STORE_PROJECTS, "readwrite", store => store.put(project));
}

export async function deleteProject(id: string): Promise<void> {
  await withStore(STORE_PROJECTS, "readwrite", store => store.delete(id));
  // Media can be shared with duplicated projects. Only remove the blobs that
  // no remaining project references.
  await garbageCollectMedia();
}

/**
 * Deletes media blobs that no project references anymore. Called after a
 * project is deleted and can also be run at startup to clean legacy data.
 */
export async function garbageCollectMedia(): Promise<number> {
  const projects = await listProjects();
  const referenced = new Set<string>();
  for (const project of projects) {
    for (const asset of project.media) referenced.add(asset.id);
    for (const scene of project.scenes) {
      if (scene.narration.assetId) referenced.add(scene.narration.assetId);
      if (scene.background.mediaId) referenced.add(scene.background.mediaId);
      for (const layer of scene.layers) {
        if ("mediaId" in layer && layer.mediaId) referenced.add(layer.mediaId);
        if (layer.kind === "avatar" && layer.photoMediaId) {
          referenced.add(layer.photoMediaId);
        }
      }
    }
  }

  const stored =
    (await withStore<StoredMedia[]>(STORE_MEDIA, "readonly", store =>
      store.getAll(),
    )) ?? [];
  // Only collect assets that have existed for a while. This avoids deleting a
  // blob imported in another tab whose project has not been saved yet.
  const cutoff = Date.now() - 10 * 60 * 1000;
  const orphans = stored.filter(
    record =>
      !referenced.has(record.id) &&
      (record.asset?.createdAt ?? 0) < cutoff,
  );
  for (const orphan of orphans) await deleteMediaBlob(orphan.id);
  return orphans.length;
}

/** Ask the browser to keep IndexedDB data even under storage pressure. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) {
      return false;
    }
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function getProject(id: string): Promise<Project | undefined> {
  const project = await withStore<Project>(
    STORE_PROJECTS,
    "readonly",
    store => store.get(id),
  );
  return project ? migrateProject(project) : undefined;
}

export interface StoredMedia {
  id: string;
  asset: MediaAsset;
  blob: Blob;
}

export async function putMedia(asset: MediaAsset, blob: Blob): Promise<void> {
  await withStore(STORE_MEDIA, "readwrite", store => store.put({ id: asset.id, asset, blob }));
}

export async function getMediaBlob(id: string): Promise<Blob | undefined> {
  const record = await withStore<StoredMedia>(STORE_MEDIA, "readonly", store => store.get(id));
  return record?.blob;
}

export async function deleteMediaBlob(id: string): Promise<void> {
  await withStore(STORE_MEDIA, "readwrite", store => store.delete(id));
}

export async function clearAll(): Promise<void> {
  await withStore(STORE_PROJECTS, "readwrite", store => store.clear());
  await withStore(STORE_MEDIA, "readwrite", store => store.clear());
}
