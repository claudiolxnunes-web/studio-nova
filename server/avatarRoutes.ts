/**
 * Avatar rendering service.
 *
 * Three ways to put a person on screen:
 *  - "portrait": rendered in the browser, free, instant (handled by the client).
 *  - "heygen":   HeyGen v2 API, photoreal studio avatars (needs an API key).
 *  - "did":      D-ID talks API, turns a photo into a talking presenter.
 *  - "tavus":    Tavus replicas, good for long-form video.
 *
 * A job is created here, polled in the background and the resulting MP4 is
 * stored under data/avatars so the browser never has to talk to a provider
 * directly (keys stay on the server).
 */
import type { Express, Request, Response } from "express";
import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {
  ensureDataDir,
  publicConfig,
  readConfig,
  writeConfig,
  type EngineId,
} from "./studioConfig";

export type JobStatus = "queued" | "rendering" | "done" | "error";

interface AvatarJob {
  id: string;
  engine: EngineId;
  status: JobStatus;
  progress: number;
  message: string;
  providerId?: string;
  file?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

const jobs = new Map<string, AvatarJob>();
const AVATAR_DIR = () => path.resolve(process.cwd(), "data", "avatars");

const ASPECTS: Record<string, { width: number; height: number }> = {
  "16:9": { width: 1280, height: 720 },
  "9:16": { width: 720, height: 1280 },
  "1:1": { width: 1080, height: 1080 },
};

function aspectSize(aspect: string | undefined) {
  return ASPECTS[aspect ?? "16:9"] ?? ASPECTS["16:9"];
}

function newId(): string {
  return crypto.randomBytes(9).toString("hex");
}

async function saveJob(job: AvatarJob): Promise<void> {
  job.updatedAt = Date.now();
  jobs.set(job.id, job);
  try {
    await ensureDataDir();
    const snapshot = Array.from(jobs.values()).slice(-80);
    await fs.writeFile(
      path.join(process.cwd(), "data", "avatar-jobs.json"),
      JSON.stringify(snapshot, null, 2),
      "utf8",
    );
  } catch {
    /* persistence is best effort */
  }
}

async function downloadToFile(url: string, extension = "mp4"): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Não consegui baixar o vídeo (${response.status}).`);
  await ensureDataDir();
  await fs.mkdir(AVATAR_DIR(), { recursive: true });
  const file = `${newId()}.${extension}`;
  await fs.writeFile(path.join(AVATAR_DIR(), file), Buffer.from(await response.arrayBuffer()));
  return file;
}

function decodeDataUrl(dataUrl: string): { buffer: Buffer; mime: string } {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) throw new Error("Arquivo inválido (esperava um data URL em base64).");
  return { mime: match[1], buffer: Buffer.from(match[2], "base64") };
}

/* -------------------------------------------------------------------------- */
/* HeyGen                                                                     */
/* -------------------------------------------------------------------------- */

const HEYGEN_BASE = "https://api.heygen.com";

async function heygenRequest<T>(
  apiKey: string,
  pathname: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${HEYGEN_BASE}${pathname}`, {
    ...init,
    headers: {
      "X-Api-Key": apiKey,
      Accept: "application/json",
      ...(init.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text.slice(0, 300) };
  }
  if (!response.ok) {
    const message =
      (payload as { error?: { message?: string } | string })?.error &&
      typeof (payload as { error?: { message?: string } }).error === "object"
        ? (payload as { error: { message: string } }).error.message
        : (payload as { message?: string })?.message;
    throw new Error(message ?? `HeyGen respondeu ${response.status}`);
  }
  return payload as T;
}

async function heygenUploadAudio(apiKey: string, buffer: Buffer, mime: string): Promise<string> {
  const response = await fetch("https://upload.heygen.com/v1/asset", {
    method: "POST",
    headers: { "X-Api-Key": apiKey, "Content-Type": mime || "audio/mpeg" },
    body: new Uint8Array(buffer),
  });
  const payload = (await response.json().catch(() => null)) as
    | { data?: { url?: string }; message?: string }
    | null;
  const url = payload?.data?.url;
  if (!response.ok || !url) {
    throw new Error(payload?.message ?? "Falha ao enviar o áudio para o HeyGen.");
  }
  return url;
}

async function heygenStart(job: AvatarJob, body: AvatarRequestBody): Promise<void> {
  const config = await readConfig();
  if (!config.heygenKey) throw new Error("Configure sua chave do HeyGen em Ajustes.");
  const size = aspectSize(body.aspect);

  const character = body.heygenAvatarId
    ? { type: "avatar", avatar_id: body.heygenAvatarId, avatar_style: "normal" }
    : { type: "avatar", avatar_id: "Daisy-inskirt-20220818", avatar_style: "normal" };

  let voice: Record<string, unknown>;
  if (body.audioDataUrl) {
    const { buffer, mime } = decodeDataUrl(body.audioDataUrl);
    const audioUrl = await heygenUploadAudio(config.heygenKey, buffer, mime);
    voice = { type: "audio", audio_url: audioUrl };
  } else {
    voice = {
      type: "text",
      input_text: (body.script ?? "").slice(0, 1500),
      voice_id: body.heygenVoiceId ?? "2f9f5a1b6f8b4a5e9b8b0f0e1c2d3a4b",
      speed: 1,
    };
  }

  const payload = await heygenRequest<{ data?: { video_id?: string }; error?: unknown }>(
    config.heygenKey,
    "/v2/video/generate",
    {
      method: "POST",
      body: JSON.stringify({
        video_inputs: [
          {
            character,
            voice,
            background: { type: "color", value: body.background ?? "#101018" },
          },
        ],
        dimension: { width: size.width, height: size.height },
        caption: false,
      }),
    },
  );

  const videoId = payload?.data?.video_id;
  if (!videoId) throw new Error("O HeyGen não retornou o id do vídeo.");
  job.providerId = videoId;
  job.status = "rendering";
  job.progress = 10;
  job.message = "HeyGen está renderizando o seu avatar…";
}

async function heygenPoll(job: AvatarJob): Promise<void> {
  const config = await readConfig();
  const payload = await heygenRequest<{
    data?: { status?: string; video_url?: string; error?: { message?: string } };
    error?: { message?: string };
  }>(config.heygenKey, `/v1/video_status.get?video_id=${encodeURIComponent(job.providerId ?? "")}`);

  const status = payload?.data?.status;
  if (status === "completed" && payload.data?.video_url) {
    job.file = await downloadToFile(payload.data.video_url);
    job.status = "done";
    job.progress = 100;
    job.message = "Pronto!";
    return;
  }
  if (status === "failed") {
    throw new Error(payload?.data?.error?.message ?? payload?.error?.message ?? "Render falhou.");
  }
  job.progress = Math.min(90, job.progress + 6);
  job.message = status === "pending" ? "Na fila do HeyGen…" : "Renderizando no HeyGen…";
}

/* -------------------------------------------------------------------------- */
/* D-ID                                                                       */
/* -------------------------------------------------------------------------- */

const DID_BASE = "https://api.d-id.com";

async function didRequest<T>(apiKey: string, pathname: string, init: RequestInit = {}): Promise<T> {
  const auth = apiKey.includes(":") ? `Basic ${apiKey}` : `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
  const response = await fetch(`${DID_BASE}${pathname}`, {
    ...init,
    headers: {
      Authorization: auth,
      Accept: "application/json",
      ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const detail =
      (payload as { description?: string; message?: string })?.description ??
      (payload as { message?: string })?.message ??
      `D-ID respondeu ${response.status}`;
    throw new Error(detail);
  }
  return payload as T;
}

async function didStart(job: AvatarJob, body: AvatarRequestBody): Promise<void> {
  const config = await readConfig();
  if (!config.didKey) throw new Error("Configure sua chave do D-ID em Ajustes.");
  if (!body.imageDataUrl && !body.sourceUrl) {
    throw new Error("O D-ID precisa de uma foto do apresentador.");
  }

  let sourceUrl = body.sourceUrl ?? "";
  if (!sourceUrl && body.imageDataUrl) {
    const { buffer, mime } = decodeDataUrl(body.imageDataUrl);
    const form = new FormData();
    const extension = mime.includes("png") ? "png" : "jpg";
    form.append("image", new Blob([new Uint8Array(buffer)], { type: mime }), `avatar.${extension}`);
    const uploaded = await didRequest<{ url?: string }>(config.didKey, "/images", {
      method: "POST",
      body: form,
    });
    sourceUrl = uploaded.url ?? "";
    if (!sourceUrl) throw new Error("O D-ID não retornou a URL da imagem enviada.");
  }

  const script = body.audioDataUrl
    ? { type: "audio" as const, audio_url: body.audioDataUrl }
    : {
        type: "text" as const,
        input: (body.script ?? "").slice(0, 1500),
        provider: { type: "microsoft", voice_id: body.didVoiceId ?? "pt-BR-FranciscaNeural" },
      };

  const payload = await didRequest<{ id?: string }>(config.didKey, "/talks", {
    method: "POST",
    body: JSON.stringify({
      source_url: sourceUrl,
      script,
      config: { stitch: true, result_format: "mp4" },
    }),
  });
  if (!payload?.id) throw new Error("O D-ID não retornou o id do vídeo.");
  job.providerId = payload.id;
  job.status = "rendering";
  job.progress = 10;
  job.message = "D-ID está animando o seu retrato…";
}

async function didPoll(job: AvatarJob): Promise<void> {
  const config = await readConfig();
  const payload = await didRequest<{
    status?: string;
    result_url?: string;
    error?: { description?: string };
  }>(config.didKey, `/talks/${encodeURIComponent(job.providerId ?? "")}`);

  if (payload.status === "done" && payload.result_url) {
    job.file = await downloadToFile(payload.result_url);
    job.status = "done";
    job.progress = 100;
    job.message = "Pronto!";
    return;
  }
  if (payload.status === "error" || payload.status === "rejected") {
    throw new Error(payload.error?.description ?? "O D-ID recusou o pedido.");
  }
  job.progress = Math.min(90, job.progress + 6);
  job.message = payload.status === "created" ? "Na fila do D-ID…" : "Animando no D-ID…";
}

/* -------------------------------------------------------------------------- */
/* Tavus                                                                      */
/* -------------------------------------------------------------------------- */

const TAVUS_BASE = "https://tavusapi.com";

async function tavusRequest<T>(apiKey: string, pathname: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${TAVUS_BASE}${pathname}`, {
    ...init,
    headers: {
      "x-api-key": apiKey,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(
      (payload as { message?: string })?.message ?? `Tavus respondeu ${response.status}`,
    );
  }
  return payload as T;
}

async function tavusStart(job: AvatarJob, body: AvatarRequestBody): Promise<void> {
  const config = await readConfig();
  if (!config.tavusKey) throw new Error("Configure sua chave do Tavus em Ajustes.");
  if (!body.tavusReplicaId) throw new Error("Informe o replica_id do seu avatar no Tavus.");
  const payload = await tavusRequest<{ video_id?: string }>(config.tavusKey, "/v2/videos", {
    method: "POST",
    body: JSON.stringify({
      replica_id: body.tavusReplicaId,
      script: (body.script ?? "").slice(0, 2000),
      video_name: body.name ?? "Studio Nova",
    }),
  });
  if (!payload?.video_id) throw new Error("O Tavus não retornou o id do vídeo.");
  job.providerId = payload.video_id;
  job.status = "rendering";
  job.progress = 10;
  job.message = "Tavus está gerando o vídeo…";
}

async function tavusPoll(job: AvatarJob): Promise<void> {
  const config = await readConfig();
  const payload = await tavusRequest<{
    status?: string;
    download_url?: string;
    hosted_url?: string;
    error?: string;
  }>(config.tavusKey, `/v2/videos/${encodeURIComponent(job.providerId ?? "")}`);
  if (payload.status === "ready" && (payload.download_url || payload.hosted_url)) {
    job.file = await downloadToFile(payload.download_url ?? payload.hosted_url ?? "");
    job.status = "done";
    job.progress = 100;
    job.message = "Pronto!";
    return;
  }
  if (payload.status === "error") throw new Error(payload.error ?? "O Tavus recusou o pedido.");
  job.progress = Math.min(90, job.progress + 5);
  job.message = "Gerando no Tavus…";
}

/* -------------------------------------------------------------------------- */
/* Job runner                                                                 */
/* -------------------------------------------------------------------------- */

interface AvatarRequestBody {
  engine: EngineId;
  script?: string;
  audioDataUrl?: string;
  imageDataUrl?: string;
  sourceUrl?: string;
  aspect?: string;
  background?: string;
  name?: string;
  heygenAvatarId?: string;
  heygenVoiceId?: string;
  didVoiceId?: string;
  tavusReplicaId?: string;
}

const polling = new Set<string>();

async function runJob(job: AvatarJob, body: AvatarRequestBody): Promise<void> {
  try {
    await saveJob(job);
    if (job.engine === "heygen") await heygenStart(job, body);
    else if (job.engine === "did") await didStart(job, body);
    else if (job.engine === "tavus") await tavusStart(job, body);
    else throw new Error("Esse motor é renderizado no navegador.");

    await saveJob(job);
    polling.add(job.id);
    void pollLoop(job);
  } catch (error) {
    job.status = "error";
    job.error = (error as Error).message;
    job.message = job.error;
    job.progress = 0;
    await saveJob(job);
  }
}

async function pollLoop(job: AvatarJob): Promise<void> {
  while (polling.has(job.id)) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    try {
      if (job.engine === "heygen") await heygenPoll(job);
      else if (job.engine === "did") await didPoll(job);
      else if (job.engine === "tavus") await tavusPoll(job);
      await saveJob(job);
      if (job.status === "done" || job.status === "error") break;
    } catch (error) {
      job.status = "error";
      job.error = (error as Error).message;
      job.message = job.error;
      await saveJob(job);
      break;
    }
    if (Date.now() - job.createdAt > 30 * 60 * 1000) {
      job.status = "error";
      job.error = "Tempo esgotado aguardando o provedor.";
      await saveJob(job);
      break;
    }
  }
  polling.delete(job.id);
}

/* -------------------------------------------------------------------------- */
/* Routes                                                                     */
/* -------------------------------------------------------------------------- */

const ENGINE_CATALOG = [
  {
    id: "portrait" as const,
    name: "Retrato Falante",
    tag: "Grátis · instantâneo",
    description:
      "Seu retrato ganha vida no próprio navegador: pisca, respira e mexe a boca junto com a narração. Sem créditos, sem fila.",
    quality: 3,
    avatarLibrary: true,
  },
  {
    id: "heygen" as const,
    name: "HeyGen",
    tag: "Pago · máxima qualidade",
    description:
      "Avatares de estúdio fotorrealistas, com corpo, gestos e iluminação profissional. O melhor resultado possível.",
    quality: 5,
    avatarLibrary: false,
  },
  {
    id: "did" as const,
    name: "D-ID",
    tag: "Pago · foto → vídeo",
    description:
      "Transforma qualquer foto em apresentador falante. Ótimo para dar vida a retratos e personagens.",
    quality: 4,
    avatarLibrary: false,
  },
  {
    id: "tavus" as const,
    name: "Tavus",
    tag: "Pago · vídeos longos",
    description: "Replicas clonadas do seu próprio vídeo, boas para aulas e treinamentos longos.",
    quality: 4,
    avatarLibrary: false,
  },
];

export function registerAvatarRoutes(app: Express): void {
  app.get("/api/avatar/engines", async (_req: Request, res: Response) => {
    const config = await readConfig();
    res.json({
      config: publicConfig(config),
      engines: ENGINE_CATALOG.map(engine => ({
        ...engine,
        ready:
          engine.id === "portrait" ||
          (engine.id === "heygen" && Boolean(config.heygenKey)) ||
          (engine.id === "did" && Boolean(config.didKey)) ||
          (engine.id === "tavus" && Boolean(config.tavusKey)),
      })),
    });
  });

  app.post("/api/avatar/config", async (req: Request, res: Response) => {
    const { heygenKey, didKey, tavusKey, hfToken, defaultEngine } = req.body ?? {};
    try {
      const config = await writeConfig({
        heygenKey: typeof heygenKey === "string" ? heygenKey : undefined,
        didKey: typeof didKey === "string" ? didKey : undefined,
        tavusKey: typeof tavusKey === "string" ? tavusKey : undefined,
        hfToken: typeof hfToken === "string" ? hfToken : undefined,
        defaultEngine: defaultEngine,
      });
      res.json(publicConfig(config));
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/avatar/heygen/avatars", async (_req: Request, res: Response) => {
    const config = await readConfig();
    if (!config.heygenKey) {
      res.status(400).json({ error: "Configure sua chave do HeyGen em Ajustes." });
      return;
    }
    try {
      const avatars = await heygenRequest<{
        data?: { avatars?: Array<{ avatar_id: string; avatar_name: string; preview_image_url?: string; gender?: string }> };
      }>(config.heygenKey, "/v2/avatars");
      const voices = await heygenRequest<{
        data?: { voices?: Array<{ voice_id: string; name: string; language?: string; gender?: string; preview_audio?: string }> };
      }>(config.heygenKey, "/v2/voices");
      res.json({
        avatars: avatars?.data?.avatars ?? [],
        voices: (voices?.data?.voices ?? []).filter(voice =>
          (voice.language ?? "").toLowerCase().includes("portuguese") ||
          (voice.language ?? "").toLowerCase().includes("português"),
        ),
      });
    } catch (error) {
      res.status(502).json({ error: (error as Error).message });
    }
  });

  app.post("/api/avatar/jobs", async (req: Request, res: Response) => {
    const body = req.body as AvatarRequestBody;
    if (!body?.engine) {
      res.status(400).json({ error: "Escolha um motor de avatar." });
      return;
    }
    if (body.engine === "portrait") {
      res.status(400).json({ error: "O retrato falante é renderizado no navegador." });
      return;
    }
    if (!body.script?.trim() && !body.audioDataUrl) {
      res.status(400).json({ error: "Escreva o roteiro ou gere a narração antes de renderizar." });
      return;
    }
    const job: AvatarJob = {
      id: newId(),
      engine: body.engine,
      status: "queued",
      progress: 2,
      message: "Enviando para o provedor…",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    void runJob(job, body);
    res.status(202).json({ id: job.id, status: job.status });
  });

  app.get("/api/avatar/jobs/:id", (req: Request, res: Response) => {
    const job = jobs.get(req.params.id);
    if (!job) {
      res.status(404).json({ error: "Trabalho não encontrado." });
      return;
    }
    res.json({
      ...job,
      resultUrl: job.file ? `/api/avatar/files/${job.file}` : undefined,
    });
  });

  app.get("/api/avatar/files/:name", async (req: Request, res: Response) => {
    const name = path.basename(req.params.name);
    if (!/^[a-f0-9]+\.(mp4|webm)$/.test(name)) {
      res.status(400).end();
      return;
    }
    try {
      const file = path.join(AVATAR_DIR(), name);
      const stat = await fs.stat(file);
      res.setHeader(
        "Content-Type",
        name.endsWith(".webm") ? "video/webm" : "video/mp4",
      );
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "public, max-age=3600");

      const range = req.headers.range;
      if (!range) {
        res.setHeader("Content-Length", String(stat.size));
        const stream = createReadStream(file);
        stream.on("error", () => res.destroy());
        stream.pipe(res);
        return;
      }

      const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if (!match) {
        res.status(416).setHeader("Content-Range", `bytes */${stat.size}`).end();
        return;
      }

      let start = match[1] ? Number(match[1]) : 0;
      let end = match[2] ? Number(match[2]) : stat.size - 1;
      if (!match[1] && match[2]) {
        const suffixLength = Number(match[2]);
        start = Math.max(0, stat.size - suffixLength);
        end = stat.size - 1;
      }
      if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        start < 0 ||
        start > end ||
        start >= stat.size
      ) {
        res.status(416).setHeader("Content-Range", `bytes */${stat.size}`).end();
        return;
      }
      end = Math.min(end, stat.size - 1);
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
      res.setHeader("Content-Length", String(end - start + 1));
      const stream = createReadStream(file, { start, end });
      stream.on("error", () => res.destroy());
      stream.pipe(res);
    } catch {
      if (!res.headersSent) res.status(404).end();
      else res.destroy();
    }
  });
}
