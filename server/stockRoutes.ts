/**
 * Free stock galleries.
 *
 * Pixabay, Pexels and Unsplash need a free API key (email sign-up). Openverse
 * is keyless, so the gallery works out of the box.
 *
 * Keys never reach the browser: searches run here and the chosen file is
 * downloaded through `/api/stock/file`, which accepts either a host from a
 * small allow-list or a URL signed by this process (so results from Openverse,
 * which live on many different CDNs, can still be imported safely).
 */
import type { Express, Request, Response } from "express";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import { publicConfig, readConfig, readStockKeys, writeConfig } from "./studioConfig";

export type StockProvider = "pexels" | "pixabay" | "unsplash" | "openverse";
export type StockKind = "photo" | "video";
export type StockOrientation = "landscape" | "portrait" | "square" | "";

export interface StockItem {
  id: string;
  provider: StockProvider;
  kind: StockKind;
  title: string;
  author: string;
  pageUrl: string;
  thumb: string;
  /** Full resolution file, downloaded only when the user imports it. */
  file: string;
  /** HMAC of `file`, lets the download proxy accept non-allow-listed CDNs. */
  token: string;
  /** HMAC of `thumb`, used as a smaller fallback when the original fails. */
  thumbToken?: string;
  /** Optional provider endpoint that must be pinged when the file is used. */
  trigger?: string;
  width: number;
  height: number;
  duration?: number;
}

interface StockSearchResult {
  provider: StockProvider;
  kind: StockKind;
  page: number;
  total: number;
  items: StockItem[];
}

const PER_PAGE = 24;

/** Providers of the actual media files, plus the thumbnail CDN of Pixabay videos. */
const ALLOWED_HOSTS = [
  "images.pexels.com",
  "videos.pexels.com",
  "cdn.pixabay.com",
  "pixabay.com",
  "i.vimeocdn.com",
  "images.unsplash.com",
  "plus.unsplash.com",
  "api.openverse.org",
];

/** In-memory secret: a restart invalidates tokens, which is harmless. */
const SIGNING_SECRET = crypto.randomBytes(32).toString("hex");

function sign(url: string): string {
  return crypto.createHmac("sha256", SIGNING_SECRET).update(url).digest("hex");
}

function sameToken(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function hostAllowed(hostname: string): boolean {
  return ALLOWED_HOSTS.some(
    host => hostname === host || hostname.endsWith(`.${host}`),
  );
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return fallback;
}

function friendly(status: number, provider: string): string {
  if (status === 401 || status === 403) {
    return `A chave do ${provider} foi recusada. Confira em Ajustes.`;
  }
  if (status === 429) {
    return `Muitas buscas em pouco tempo no ${provider}. Espere alguns segundos.`;
  }
  return `${provider} respondeu ${status}.`;
}

/** Openverse returns all sorts of formats; stick to what the editor can show. */
function usableImageUrl(url: string, thumb: string): string {
  if (/\.(jpe?g|png|webp|gif)(\?|$)/i.test(url)) return url;
  return thumb || url;
}

/* -------------------------------------------------------------------------- */
/* Pixabay                                                                    */
/* -------------------------------------------------------------------------- */

interface PixabayPhotoHit {
  id: number;
  pageURL: string;
  tags: string;
  user: string;
  previewURL: string;
  webformatURL: string;
  largeImageURL: string;
  fullHDURL?: string;
  imageWidth: number;
  imageHeight: number;
}

interface PixabayVideoHit {
  id: number;
  pageURL: string;
  tags: string;
  user: string;
  duration: number;
  picture_id?: string;
  videos: Record<
    string,
    { url: string; width: number; height: number } | undefined
  >;
}

async function pixabaySearch(
  key: string,
  kind: StockKind,
  query: string,
  page: number,
  orientation: StockOrientation,
): Promise<StockSearchResult> {
  const base =
    kind === "video" ? "https://pixabay.com/api/videos/" : "https://pixabay.com/api/";
  const params = new URLSearchParams({
    key,
    q: query,
    per_page: String(PER_PAGE),
    page: String(Math.max(1, page)),
    safesearch: "true",
    lang: "pt",
  });
  if (kind === "photo") {
    params.set("image_type", "photo");
    if (orientation === "landscape") params.set("orientation", "horizontal");
    if (orientation === "portrait") params.set("orientation", "vertical");
  }

  const response = await fetch(`${base}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(friendly(response.status, "Pixabay"));

  if (kind === "photo") {
    const payload = (await response.json()) as {
      totalHits?: number;
      hits?: PixabayPhotoHit[];
    };
    return {
      provider: "pixabay",
      kind,
      page,
      total: payload.totalHits ?? 0,
      items: (payload.hits ?? []).map(hit => ({
        id: `pixabay-${hit.id}`,
        provider: "pixabay" as const,
        kind,
        title: hit.tags || "Foto Pixabay",
        author: hit.user,
        pageUrl: hit.pageURL,
        thumb: hit.webformatURL || hit.previewURL,
        file: hit.fullHDURL || hit.largeImageURL || hit.webformatURL,
        token: sign(hit.fullHDURL || hit.largeImageURL || hit.webformatURL),
        width: hit.imageWidth,
        height: hit.imageHeight,
      })),
    };
  }

  const payload = (await response.json()) as {
    totalHits?: number;
    hits?: PixabayVideoHit[];
  };
  return {
    provider: "pixabay",
    kind,
    page,
    total: payload.totalHits ?? 0,
    items: (payload.hits ?? []).map(hit => {
      const file =
        hit.videos.large?.url ??
        hit.videos.medium?.url ??
        hit.videos.small?.url ??
        hit.videos.tiny?.url ??
        "";
      const source = hit.videos.large ?? hit.videos.medium ?? hit.videos.small;
      return {
        id: `pixabay-${hit.id}`,
        provider: "pixabay" as const,
        kind,
        title: hit.tags || "Vídeo Pixabay",
        author: hit.user,
        pageUrl: hit.pageURL,
        thumb: hit.picture_id
          ? `https://i.vimeocdn.com/video/${hit.picture_id}_295x166.jpg`
          : "",
        file,
        token: sign(file),
        width: source?.width ?? 0,
        height: source?.height ?? 0,
        duration: hit.duration,
      };
    }),
  };
}

/* -------------------------------------------------------------------------- */
/* Pexels                                                                     */
/* -------------------------------------------------------------------------- */

interface PexelsPhoto {
  id: number;
  url: string;
  photographer: string;
  alt?: string;
  width: number;
  height: number;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    tiny: string;
  };
}

interface PexelsVideo {
  id: number;
  url: string;
  image: string;
  duration: number;
  user?: { name?: string };
  video_files?: Array<{
    link: string;
    width: number;
    height: number;
    quality?: string;
    file_type?: string;
  }>;
}

function pickPexelsVideoFile(files: PexelsVideo["video_files"]): string {
  const mp4 = (files ?? []).filter(
    file => file.file_type === "video/mp4" && file.width <= 1920,
  );
  const pool = mp4.length > 0 ? mp4 : (files ?? []).filter(file => file.file_type === "video/mp4");
  const sorted = pool.sort((a, b) => b.width - a.width);
  return sorted[0]?.link ?? "";
}

async function pexelsSearch(
  key: string,
  kind: StockKind,
  query: string,
  page: number,
  orientation: StockOrientation,
): Promise<StockSearchResult> {
  const pathname = kind === "video" ? "/videos/search" : "/search";
  const params = new URLSearchParams({
    query,
    per_page: String(PER_PAGE),
    page: String(Math.max(1, page)),
  });
  if (orientation) params.set("orientation", orientation);
  if (kind === "photo") params.set("locale", "pt-BR");

  const response = await fetch(`https://api.pexels.com/v1${pathname}?${params.toString()}`, {
    headers: { Authorization: key, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(friendly(response.status, "Pexels"));

  if (kind === "photo") {
    const payload = (await response.json()) as {
      total_results?: number;
      photos?: PexelsPhoto[];
    };
    return {
      provider: "pexels",
      kind,
      page,
      total: payload.total_results ?? 0,
      items: (payload.photos ?? []).map(photo => {
        const file = photo.src.large2x || photo.src.original;
        return {
          id: `pexels-${photo.id}`,
          provider: "pexels" as const,
          kind,
          title: photo.alt || "Foto Pexels",
          author: photo.photographer,
          pageUrl: photo.url,
          thumb: photo.src.medium || photo.src.small,
          file,
          token: sign(file),
          width: photo.width,
          height: photo.height,
        };
      }),
    };
  }

  const payload = (await response.json()) as {
    total_results?: number;
    videos?: PexelsVideo[];
  };
  return {
    provider: "pexels",
    kind,
    page,
    total: payload.total_results ?? 0,
    items: (payload.videos ?? []).map(video => {
      const file = pickPexelsVideoFile(video.video_files);
      const chosen = (video.video_files ?? []).find(item => item.link === file);
      return {
        id: `pexels-${video.id}`,
        provider: "pexels" as const,
        kind,
        title: `Vídeo de ${video.user?.name ?? "Pexels"}`,
        author: video.user?.name ?? "Pexels",
        pageUrl: video.url,
        thumb: video.image,
        file,
        token: sign(file),
        width: chosen?.width ?? 0,
        height: chosen?.height ?? 0,
        duration: video.duration,
      };
    }),
  };
}

/* -------------------------------------------------------------------------- */
/* Unsplash                                                                   */
/* -------------------------------------------------------------------------- */

interface UnsplashPhoto {
  id: string;
  alt_description?: string;
  width: number;
  height: number;
  user?: { name?: string };
  links: { html: string; download_location: string };
  urls: { raw: string; full: string; regular: string; small: string };
}

async function unsplashSearch(
  key: string,
  query: string,
  page: number,
  orientation: StockOrientation,
): Promise<StockSearchResult> {
  const params = new URLSearchParams({
    query,
    per_page: String(PER_PAGE),
    page: String(Math.max(1, page)),
  });
  if (orientation === "landscape") params.set("orientation", "landscape");
  if (orientation === "portrait") params.set("orientation", "portrait");
  if (orientation === "square") params.set("orientation", "squarish");

  const response = await fetch(`https://api.unsplash.com/search/photos?${params.toString()}`, {
    headers: {
      Authorization: `Client-ID ${key}`,
      "Accept-Version": "v1",
      Accept: "application/json",
    },
  });
  if (!response.ok) throw new Error(friendly(response.status, "Unsplash"));

  const payload = (await response.json()) as {
    total?: number;
    results?: UnsplashPhoto[];
  };
  return {
    provider: "unsplash",
    kind: "photo",
    page,
    total: payload.total ?? 0,
    items: (payload.results ?? []).map(photo => {
      const file = photo.urls.full || photo.urls.regular;
      return {
        id: `unsplash-${photo.id}`,
        provider: "unsplash" as const,
        kind: "photo" as const,
        title: photo.alt_description || "Foto Unsplash",
        author: photo.user?.name ?? "Unsplash",
        pageUrl: photo.links.html,
        thumb: photo.urls.small,
        file,
        token: sign(file),
        // Unsplash asks apps to ping this endpoint whenever a photo is downloaded.
        trigger: photo.links.download_location,
        width: photo.width,
        height: photo.height,
      };
    }),
  };
}

/* -------------------------------------------------------------------------- */
/* Openverse (no key needed)                                                  */
/* -------------------------------------------------------------------------- */

interface OpenversePhoto {
  id: string;
  title?: string;
  creator?: string;
  url: string;
  thumbnail?: string;
  foreign_landing_url?: string;
  license?: string;
  width?: number;
  height?: number;
}

async function openverseSearch(
  query: string,
  page: number,
  orientation: StockOrientation,
): Promise<StockSearchResult> {
  const params = new URLSearchParams({
    q: query,
    page: String(Math.max(1, page)),
    // Anonymous Openverse requests are capped at 20 results per page.
    page_size: String(Math.min(PER_PAGE, 20)),
    // Only licenses that allow commercial use, which is what a studio needs.
    license_type: "commercial",
  });
  if (orientation === "landscape") params.set("aspect_ratio", "wide");
  if (orientation === "portrait") params.set("aspect_ratio", "tall");
  if (orientation === "square") params.set("aspect_ratio", "square");

  const response = await fetch(`https://api.openverse.org/v1/images/?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(friendly(response.status, "Openverse"));

  const payload = (await response.json()) as {
    result_count?: number;
    results?: OpenversePhoto[];
  };
  return {
    provider: "openverse",
    kind: "photo",
    page,
    total: payload.result_count ?? 0,
    items: (payload.results ?? []).map(photo => {
      const thumb = photo.thumbnail || photo.url;
      const file = usableImageUrl(photo.url, thumb);
      return {
        id: `openverse-${photo.id}`,
        provider: "openverse" as const,
        kind: "photo" as const,
        title: photo.title || "Foto Openverse",
        author: photo.creator || "Openverse",
        pageUrl: photo.foreign_landing_url || photo.url,
        thumb,
        file,
        token: sign(file),
        thumbToken: thumb && thumb !== file ? sign(thumb) : undefined,
        width: photo.width ?? 0,
        height: photo.height ?? 0,
      };
    }),
  };
}

/* -------------------------------------------------------------------------- */
/* Routes                                                                     */
/* -------------------------------------------------------------------------- */

function stockStatus(config: Awaited<ReturnType<typeof readConfig>>) {
  return publicConfig(config).stock;
}

/** CDNs occasionally blip; retry a couple of times before giving up. */
async function fetchMedia(url: URL, attempts = 3): Promise<globalThis.Response> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "*/*", "User-Agent": "StudioNova/1.0 (+local)" },
        signal: AbortSignal.timeout(30_000),
      });
      if (response.ok || response.status < 500) return response;
      lastError = new Error(`O provedor respondeu ${response.status}.`);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 350 * (attempt + 1)));
  }
  throw lastError instanceof Error ? lastError : new Error("Falha ao baixar o arquivo.");
}

export function registerStockRoutes(app: Express): void {
  app.get("/api/stock/status", async (_req: Request, res: Response) => {
    const config = await readConfig();
    res.json(stockStatus(config));
  });

  app.post("/api/stock/config", async (req: Request, res: Response) => {
    const { pexelsKey, pixabayKey, unsplashKey } = req.body ?? {};
    try {
      const config = await writeConfig({
        pexelsKey: typeof pexelsKey === "string" ? pexelsKey : undefined,
        pixabayKey: typeof pixabayKey === "string" ? pixabayKey : undefined,
        unsplashKey: typeof unsplashKey === "string" ? unsplashKey : undefined,
      });
      res.json(stockStatus(config));
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/stock/search", async (req: Request, res: Response) => {
    const provider = asString(req.query.provider, "openverse") as StockProvider;
    const kind = asString(req.query.kind, "photo") as StockKind;
    const orientation = asString(req.query.orientation, "") as StockOrientation;
    const query = asString(req.query.q).trim();
    const page = Number(asString(req.query.page, "1")) || 1;

    const known: StockProvider[] = ["pexels", "pixabay", "unsplash", "openverse"];
    if (!known.includes(provider)) {
      res.status(400).json({ error: "Banco de imagens desconhecido." });
      return;
    }
    if (kind !== "photo" && kind !== "video") {
      res.status(400).json({ error: "Tipo de mídia desconhecido." });
      return;
    }
    if (kind === "video" && (provider === "unsplash" || provider === "openverse")) {
      res.status(400).json({ error: "Esse banco só tem fotos." });
      return;
    }
    if (query.length < 2) {
      res.status(400).json({ error: "Digite pelo menos duas letras para buscar." });
      return;
    }

    const keys = await readStockKeys();
    const key =
      provider === "pexels"
        ? keys.pexels
        : provider === "pixabay"
          ? keys.pixabay
          : provider === "unsplash"
            ? keys.unsplash
            : "";

    const label =
      provider === "pexels"
        ? "Pexels"
        : provider === "pixabay"
          ? "Pixabay"
          : provider === "unsplash"
            ? "Unsplash"
            : "Openverse";

    if (!key && provider !== "openverse") {
      res.status(400).json({
        error: `Configure a chave gratuita do ${label} em Ajustes.`,
        missing: provider,
      });
      return;
    }

    try {
      const result =
        provider === "pexels"
          ? await pexelsSearch(key, kind, query, page, orientation)
          : provider === "pixabay"
            ? await pixabaySearch(key, kind, query, page, orientation)
            : provider === "unsplash"
              ? await unsplashSearch(key, query, page, orientation)
              : await openverseSearch(query, page, orientation);
      res.json(result);
    } catch (error) {
      res.status(502).json({ error: (error as Error).message });
    }
  });

  /**
   * Streams a provider file to the browser so `fetch` can turn it into a Blob
   * (most CDNs do not send CORS headers, and the editor needs a real File).
   */
  app.get("/api/stock/file", async (req: Request, res: Response) => {
    const raw = asString(req.query.url);
    const token = asString(req.query.token);
    const trigger = asString(req.query.trigger);
    let target: URL;
    try {
      target = new URL(raw);
    } catch {
      res.status(400).json({ error: "Endereço inválido." });
      return;
    }
    if (target.protocol !== "https:") {
      res.status(400).json({ error: "Endereço não permitido." });
      return;
    }
    const trusted = hostAllowed(target.hostname) || (token !== "" && sameToken(token, sign(raw)));
    if (!trusted) {
      res.status(400).json({ error: "Endereço não permitido." });
      return;
    }

    // Unsplash compliance: ping the download endpoint when the asset is used.
    if (trigger) {
      try {
        const triggerUrl = new URL(trigger);
        if (triggerUrl.protocol === "https:" && triggerUrl.hostname === "api.unsplash.com") {
          const keys = await readStockKeys();
          if (keys.unsplash) {
            await fetch(triggerUrl, {
              headers: { Authorization: `Client-ID ${keys.unsplash}`, "Accept-Version": "v1" },
            }).catch(() => undefined);
          }
        }
      } catch {
        /* a failed ping must not block the download */
      }
    }

    try {
      const response = await fetchMedia(target);
      if (!response.ok || !response.body) {
        res.status(502).json({ error: `O provedor respondeu ${response.status}.` });
        return;
      }
      const finalUrl = response.url ? new URL(response.url) : target;
      if (!hostAllowed(finalUrl.hostname) && !(token && sameToken(token, sign(raw)))) {
        res.status(400).json({ error: "Redirecionamento não permitido." });
        return;
      }

      const length = Number(response.headers.get("content-length") ?? "0");
      if (length > 250 * 1024 * 1024) {
        res.status(413).json({ error: "Arquivo grande demais (limite de 250 MB)." });
        return;
      }

      res.setHeader("Content-Type", response.headers.get("content-type") ?? "application/octet-stream");
      if (length > 0) res.setHeader("Content-Length", String(length));
      res.setHeader("Cache-Control", "public, max-age=86400");
      Readable.fromWeb(response.body as never).pipe(res);
    } catch (error) {
      res.status(502).json({ error: (error as Error).message });
    }
  });
}
