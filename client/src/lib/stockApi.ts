/** Client for the free stock galleries (Pixabay, Pexels, Unsplash, Openverse). */

export type StockProvider = "pexels" | "pixabay" | "unsplash" | "openverse";
export type StockKind = "photo" | "video";
export type StockOrientation = "landscape" | "portrait" | "square" | "";

export interface StockKeyState {
  configured: boolean;
  hint: string;
}

export type StockStatus = Record<StockProvider, StockKeyState>;

export interface StockItem {
  id: string;
  provider: StockProvider;
  kind: StockKind;
  title: string;
  author: string;
  pageUrl: string;
  thumb: string;
  file: string;
  token: string;
  thumbToken?: string;
  trigger?: string;
  width: number;
  height: number;
  duration?: number;
}

export interface StockSearchResult {
  provider: StockProvider;
  kind: StockKind;
  page: number;
  total: number;
  items: StockItem[];
}

export async function fetchUnsplashPhoto(input: string): Promise<StockItem> {
  const params = new URLSearchParams({ q: input.trim() });
  const response = await fetch(`/api/stock/unsplash/photo?${params.toString()}`);
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { item: StockItem };
  return payload.item;
}

async function readError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    if (payload?.error) return payload.error;
  } catch {
    /* ignore */
  }
  return `Falha na requisição (${response.status})`;
}

export async function fetchStockStatus(): Promise<StockStatus> {
  const response = await fetch("/api/stock/status");
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as StockStatus;
}

export async function saveStockKeys(patch: {
  pexelsKey?: string;
  pixabayKey?: string;
  unsplashKey?: string;
}): Promise<StockStatus> {
  const response = await fetch("/api/stock/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as StockStatus;
}

export async function searchStock(input: {
  provider: StockProvider;
  kind: StockKind;
  q: string;
  page?: number;
  orientation?: StockOrientation;
}): Promise<StockSearchResult> {
  const params = new URLSearchParams({
    provider: input.provider,
    kind: input.kind,
    q: input.q,
    page: String(input.page ?? 1),
  });
  if (input.orientation) params.set("orientation", input.orientation);
  const response = await fetch(`/api/stock/search?${params.toString()}`);
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as StockSearchResult;
}

function extensionFor(item: StockItem, mime: string): string {
  if (item.kind === "video") return "mp4";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

function slug(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "midia"
  );
}

/**
 * Downloads the full-size file through the local proxy and wraps it in a File,
 * ready for `api.importMediaFiles`.
 */
export async function downloadStockItem(item: StockItem): Promise<File> {
  if (!item.file) throw new Error("Esse item não tem arquivo para baixar.");

  const attempts = [
    { url: item.file, token: item.token },
    ...(item.thumb && item.thumbToken && item.thumb !== item.file
      ? [{ url: item.thumb, token: item.thumbToken }]
      : []),
  ];

  let lastError = "Não consegui baixar esse arquivo.";
  for (const attempt of attempts) {
    const params = new URLSearchParams({ url: attempt.url, token: attempt.token });
    if (item.trigger) params.set("trigger", item.trigger);
    let response: Response;
    try {
      response = await fetch(`/api/stock/file?${params.toString()}`);
    } catch {
      lastError = "Sem conexão com o servidor local.";
      continue;
    }
    if (!response.ok) {
      lastError = await readError(response);
      continue;
    }
    const blob = await response.blob();
    if (blob.size === 0) {
      lastError = "O arquivo veio vazio.";
      continue;
    }
    const mime = blob.type || (item.kind === "video" ? "video/mp4" : "image/jpeg");
    const credit = item.author ? `-${slug(item.author)}` : "";
    const name = `${slug(item.title)}${credit}-${item.provider}.${extensionFor(item, mime)}`;
    return new File([blob], name, { type: mime });
  }
  throw new Error(lastError);
}
