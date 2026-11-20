/**
 * Local settings store.
 *
 * Keys for the avatar engines live in `data/studio-config.json` on the machine
 * that runs the studio. Nothing is sent anywhere except to the provider the key
 * belongs to, and the browser only ever sees a masked preview.
 */
import fs from "node:fs/promises";
import path from "node:path";

export type EngineId = "portrait" | "heygen" | "did" | "tavus";

export interface StudioConfig {
  heygenKey: string;
  didKey: string;
  tavusKey: string;
  /** Optional Hugging Face token, used by experimental free GPU engines. */
  hfToken: string;
  /** Free stock photo/video APIs (Pexels, Pixabay and Unsplash). */
  pexelsKey: string;
  pixabayKey: string;
  unsplashKey: string;
  /** Optional local/remote ComfyUI server. */
  comfyUrl: string;
  comfyToken: string;
  comfyCheckpoint: string;
  /** Optional workflow exported with Save (API Format). Supports placeholders. */
  comfyWorkflow: string;
  /** Engine preselected in the avatar studio. */
  defaultEngine: EngineId;
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const CONFIG_FILE = path.join(DATA_DIR, "studio-config.json");

const DEFAULTS: StudioConfig = {
  heygenKey: "",
  didKey: "",
  tavusKey: "",
  hfToken: "",
  pexelsKey: "",
  pixabayKey: "",
  unsplashKey: "",
  comfyUrl: "",
  comfyToken: "",
  comfyCheckpoint: "",
  comfyWorkflow: "",
  defaultEngine: "portrait",
};

let cache: StudioConfig | null = null;

export async function ensureDataDir(): Promise<string> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  return DATA_DIR;
}

export async function readConfig(): Promise<StudioConfig> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(CONFIG_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<StudioConfig>;
    cache = { ...DEFAULTS, ...parsed };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

export async function writeConfig(patch: Partial<StudioConfig>): Promise<StudioConfig> {
  const current = await readConfig();
  const next: StudioConfig = { ...current };
  for (const key of Object.keys(DEFAULTS) as Array<keyof StudioConfig>) {
    const value = patch[key];
    if (value !== undefined && typeof value === "string") {
      (next[key] as string) = value.trim();
    }
  }
  if (patch.defaultEngine) next.defaultEngine = patch.defaultEngine;
  cache = next;
  await ensureDataDir();
  await fs.writeFile(CONFIG_FILE, JSON.stringify(next, null, 2), "utf8");
  // Keep the file private: it holds API keys.
  await fs.chmod(CONFIG_FILE, 0o600).catch(() => undefined);
  return next;
}

export function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

/** Stock keys may also come from the environment, handy for a shared install. */
export async function readStockKeys(): Promise<{
  pexels: string;
  pixabay: string;
  unsplash: string;
}> {
  const config = await readConfig();
  return {
    pexels: config.pexelsKey || process.env.PEXELS_API_KEY || "",
    pixabay: config.pixabayKey || process.env.PIXABAY_API_KEY || "",
    unsplash: config.unsplashKey || process.env.UNSPLASH_ACCESS_KEY || "",
  };
}

/** Public view: never leak the full key to the browser. */
export function publicConfig(config: StudioConfig) {
  const pexels = config.pexelsKey || process.env.PEXELS_API_KEY || "";
  const pixabay = config.pixabayKey || process.env.PIXABAY_API_KEY || "";
  const unsplash = config.unsplashKey || process.env.UNSPLASH_ACCESS_KEY || "";
  return {
    defaultEngine: config.defaultEngine,
    engines: {
      heygen: { configured: Boolean(config.heygenKey), hint: maskKey(config.heygenKey) },
      did: { configured: Boolean(config.didKey), hint: maskKey(config.didKey) },
      tavus: { configured: Boolean(config.tavusKey), hint: maskKey(config.tavusKey) },
      hf: { configured: Boolean(config.hfToken), hint: maskKey(config.hfToken) },
    },
    stock: {
      pexels: { configured: Boolean(pexels), hint: maskKey(pexels) },
      pixabay: { configured: Boolean(pixabay), hint: maskKey(pixabay) },
      unsplash: { configured: Boolean(unsplash), hint: maskKey(unsplash) },
      // Openverse needs no key at all, it is always available.
      openverse: { configured: true, hint: "" },
    },
  };
}
