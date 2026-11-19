/**
 * Brazilian Portuguese neural narration.
 *
 * Primary provider: the Microsoft Edge read-aloud neural voices (same voices
 * used by Edge's "Read aloud"), reached over the public WebSocket endpoint.
 * Fallback provider: Google Translate's speech endpoint, chunked into short
 * requests and concatenated, used when the primary provider is unreachable.
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import WebSocket from "ws";

const execFileAsync = promisify(execFile);

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const CHROMIUM_FULL_VERSION = "130.0.2849.68";
const EDGE_WSS =
  "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";
const OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0";

export const SUPPORTED_VOICES = [
  {
    id: "pt-BR-FranciscaNeural",
    name: "Francisca",
    gender: "Feminina",
    description: "Calorosa e didática — boa para aulas longas.",
    sample: "Olá! Hoje vamos aprender juntos.",
  },
  {
    id: "pt-BR-ThalitaMultilingualNeural",
    name: "Thalita",
    gender: "Feminina",
    description: "Jovem e leve — ótima para redes sociais.",
    sample: "Bora para mais uma dica rápida?",
  },
  {
    id: "pt-BR-AntonioNeural",
    name: "Antônio",
    gender: "Masculina",
    description: "Grave e firme — transmite autoridade.",
    sample: "Vamos direto ao ponto nesta aula.",
  },
];

export type SynthesizeOptions = {
  text: string;
  voiceId?: string;
  rate?: number;
  pitch?: number;
};

export type SynthesizeResult = {
  audio: Buffer;
  mime: string;
  provider: "edge" | "google";
};

function secMsGec(): string {
  const ticks = Math.floor(Date.now() / 1000) + 11644473600;
  const rounded = ticks - (ticks % 300);
  const stamp = (BigInt(rounded) * 10000000n).toString();
  return crypto
    .createHash("sha256")
    .update(`${stamp}${TRUSTED_CLIENT_TOKEN}`)
    .digest("hex")
    .toUpperCase();
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSsml(text: string, voiceId: string, rate: number, pitch: number): string {
  const ratePct = Math.round((rate - 1) * 100);
  const pitchHz = Math.round((pitch - 1) * 45);
  const rateStr = `${ratePct >= 0 ? "+" : ""}${ratePct}%`;
  const pitchStr = `${pitchHz >= 0 ? "+" : ""}${pitchHz}Hz`;
  return (
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='pt-BR'>` +
    `<voice name='${voiceId}'><prosody pitch='${pitchStr}' rate='${rateStr}' volume='+0%'>` +
    `${escapeXml(text)}</prosody></voice></speak>`
  );
}

async function synthesizeEdge(options: SynthesizeOptions): Promise<Buffer> {
  const { text, voiceId = "pt-BR-FranciscaNeural", rate = 1, pitch = 1 } = options;
  const url = `${EDGE_WSS}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGec()}&Sec-MS-GEC-Version=1-${CHROMIUM_FULL_VERSION}`;
  const requestId = crypto.randomUUID().replace(/-/g, "");

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let settled = false;
    const ws = new WebSocket(url, {
      headers: {
        Pragma: "no-cache",
        "Cache-Control": "no-cache",
        Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "User-Agent": BROWSER_UA,
      },
      handshakeTimeout: 12000,
    });

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      if (error) {
        reject(error);
        return;
      }
      if (chunks.length === 0) {
        reject(new Error("Narração vazia retornada pelo serviço de voz"));
        return;
      }
      resolve(Buffer.concat(chunks));
    };

    const timer = setTimeout(() => finish(new Error("Tempo esgotado ao gerar a narração")), 30000);

    ws.on("open", () => {
      const stamp = new Date().toISOString();
      ws.send(
        `X-Timestamp:${stamp}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
          JSON.stringify({
            context: {
              synthesis: {
                audio: {
                  metadataoptions: {
                    sentenceBoundaryEnabled: "false",
                    wordBoundaryEnabled: "true",
                  },
                  outputFormat: OUTPUT_FORMAT,
                },
              },
            },
          }),
      );
      ws.send(
        `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${stamp}Z\r\nPath:ssml\r\n\r\n` +
          buildSsml(text, voiceId, rate, pitch),
      );
    });

    ws.on("message", (data: WebSocket.RawData, isBinary: boolean) => {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      if (isBinary || buffer.subarray(0, 2).toString("utf8") !== "X-") {
        if (buffer.length > 2) {
          const headerLength = buffer.readUInt16BE(0);
          const header = buffer.subarray(2, 2 + headerLength).toString("utf8");
          if (header.includes("Path:audio")) {
            chunks.push(buffer.subarray(2 + headerLength));
          }
        }
        return;
      }
      const message = buffer.toString("utf8");
      if (message.includes("Path:turn.end")) {
        finish();
      }
    });

    ws.on("error", error => finish(error instanceof Error ? error : new Error(String(error))));
    ws.on("close", () => {
      if (!settled) finish(chunks.length > 0 ? undefined : new Error("Conexão de voz encerrada"));
    });
  });
}

function splitForGoogle(text: string, limit = 170): string[] {
  const pieces: string[] = [];
  const sentences = text.replace(/\s+/g, " ").split(/(?<=[.!?;:])\s+/);
  for (const sentence of sentences) {
    let current = "";
    for (const word of sentence.split(" ")) {
      if (word.length > limit) {
        if (current) {
          pieces.push(current);
          current = "";
        }
        for (let i = 0; i < word.length; i += limit) pieces.push(word.slice(i, i + limit));
        continue;
      }
      if ((current + " " + word).trim().length > limit) {
        if (current) pieces.push(current);
        current = word;
      } else {
        current = current ? `${current} ${word}` : word;
      }
    }
    if (current) pieces.push(current);
  }
  return pieces.filter(piece => piece.trim().length > 0);
}

async function synthesizeGoogle(text: string): Promise<Buffer> {  const buffers: Buffer[] = [];
  for (const chunk of splitForGoogle(text)) {
    const url =
      "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=pt-BR&ttsspeed=1&q=" +
      encodeURIComponent(chunk);
    const response = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Referer: "https://translate.google.com/",
      },
    });
    if (!response.ok) {
      throw new Error(`Falha no provedor de voz alternativo (${response.status})`);
    }
    buffers.push(Buffer.from(await response.arrayBuffer()));
  }
  if (buffers.length === 0) throw new Error("Nenhum áudio gerado");
  return Buffer.concat(buffers);
}

/**
 * Neural voice through the open-source `edge-tts` package.
 *
 * Microsoft changed the handshake token to a signed v2 hash, so the raw
 * WebSocket below is kept only as a fallback: the CLI speaks the current
 * protocol and ships the same neural voices, for free and without a key.
 */
async function synthesizeEdgeCli(options: SynthesizeOptions): Promise<Buffer> {
  const { text, voiceId = "pt-BR-FranciscaNeural", rate = 1, pitch = 1 } = options;
  const tmp = path.join(os.tmpdir(), `studio-nova-tts-${crypto.randomUUID()}.mp3`);
  const ratePct = Math.round((rate - 1) * 100);
  const pitchHz = Math.round((pitch - 1) * 45);
  const python = process.env.STUDIO_PYTHON || "python3";
  try {
    await execFileAsync(
      python,
      [
        "-m",
        "edge_tts",
        "--voice",
        voiceId,
        "--text",
        text,
        "--rate",
        `${ratePct >= 0 ? "+" : ""}${ratePct}%`,
        "--pitch",
        `${pitchHz >= 0 ? "+" : ""}${pitchHz}Hz`,
        "--write-media",
        tmp,
      ],
      { timeout: 90_000, maxBuffer: 4 * 1024 * 1024 },
    );
    const audio = await fs.readFile(tmp);
    if (audio.byteLength < 512) throw new Error("Narração vazia.");
    return audio;
  } finally {
    await fs.unlink(tmp).catch(() => undefined);
  }
}

export async function synthesize(options: SynthesizeOptions): Promise<SynthesizeResult> {
  const text = options.text.replace(/\s+/g, " ").trim();
  if (!text) throw new Error("Escreva o roteiro antes de gerar a narração.");
  if (text.length > 4000) {
    throw new Error("Roteiro muito longo. Divida o texto em mais de uma cena (até 4000 caracteres).");
  }

  try {
    const audio = await synthesizeEdgeCli({ ...options, text });
    return { audio, mime: "audio/mpeg", provider: "edge" };
  } catch (cliError) {
    try {
      const audio = await synthesizeEdge({ ...options, text });
      return { audio, mime: "audio/mpeg", provider: "edge" };
    } catch (error) {
      console.warn(
        "[TTS] Voz neural indisponível, usando provedor alternativo:",
        (cliError as Error).message,
        "/",
        (error as Error).message,
      );
      const audio = await synthesizeGoogle(text);
      return { audio, mime: "audio/mpeg", provider: "google" };
    }
  }
}
