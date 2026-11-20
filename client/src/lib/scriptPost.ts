/**
 * Script → ready-to-publish post.
 *
 * Splits a pasted script into a single post, a carousel or a story sequence,
 * fills the existing scene templates with the copy, optionally brings free
 * stock photos for the slides and generates the caption/hashtags package.
 */
import {
  DEFAULT_CAPTIONS,
  DEFAULT_THEME,
  PROJECT_SCHEMA_VERSION,
  PT_VOICES,
  buildTemplateLayers,
  formatPreset,
  newScene,
  uid,
  type FormatPresetId,
  type Layer,
  type MediaAsset,
  type Project,
  type SceneTemplateId,
} from "@shared/editor";
import {
  downloadStockItem,
  fetchStockStatus,
  searchStock,
  type StockItem,
  type StockOrientation,
  type StockProvider,
} from "./stockApi";
import { importFile } from "./mediaImport";
import { saveProject } from "./storage";
import { splitScript } from "./scriptVideo";

export type PostKind = "post" | "carrossel" | "story";

export interface PostProgress {
  step: string;
  index: number;
  total: number;
}

export interface ScriptPostOptions {
  script: string;
  title?: string;
  kind: PostKind;
  format: FormatPresetId;
  theme?: string;
  withImages: boolean;
  accent?: string;
  onProgress?: (info: PostProgress) => void;
}

export interface ScriptPostResult {
  project: Project;
  caption: string;
  hashtags: string;
  altTexts: string[];
}

interface SlidePlan {
  name: string;
  template: SceneTemplateId;
  headline: string;
  body: string;
  query: string;
  withImage: boolean;
  signature?: string;
}

const STOPWORDS = new Set(
  "a o as os um uma uns umas de do da dos das em no na nos nas por para com sem que se e ou mas como quando onde porque sobre entre ate apos antes mais menos muito pouco todo toda todos todas isso isto aquilo voce voces eu nos ele ela eles elas seu sua seus suas nosso nossa nossos nossas ja nao sim pode podem fazer faz ser esta estao foi eram tem ter teria vai vao".split(
    " ",
  ),
);

function cleanText(text: string): string {
  return text.replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
}

function firstSentence(text: string): string {
  const match = cleanText(text).match(/^.*?[.!?](?:\s|$)/s);
  return (match?.[0] ?? cleanText(text)).trim();
}

function restAfterFirst(text: string): string {
  const clean = cleanText(text);
  const first = firstSentence(clean);
  return clean.slice(first.length).trim();
}

function shorten(text: string, max: number): string {
  const clean = cleanText(text);
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > max * 0.55 ? lastSpace : max).trim()}…`;
}

/** Prefers complete sentences and never cuts a word in the middle. */
function excerpt(text: string, max: number): string {
  const clean = cleanText(text);
  if (!clean) return "";
  const sentences = clean.match(/[^.!?]+[.!?]*/g) ?? [clean];
  let result = "";
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    const candidate = result ? `${result} ${sentence}` : sentence;
    if (candidate.length > max) break;
    result = candidate;
  }
  return result || shorten(clean, max);
}

function keywords(text: string, limit = 4): string[] {
  const normalized = cleanText(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const counts = new Map<string, number>();
  for (const word of normalized.split(/[^a-z0-9]+/)) {
    if (word.length < 4 || STOPWORDS.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

const ENGLISH_TERMS: Record<string, string> = {
  produtividade: "productivity",
  rotina: "routine",
  estudos: "study",
  estudo: "study",
  financas: "finance",
  dinheiro: "money",
  negocios: "business",
  marketing: "marketing",
  vendas: "sales",
  lideranca: "leadership",
  motivacao: "motivation",
  foco: "focus",
  tempo: "time",
  organizacao: "organization",
  habitos: "habits",
  saude: "health",
  alimentacao: "food",
  exercicio: "exercise",
  tecnologia: "technology",
  programacao: "programming",
  carreira: "career",
  educacao: "education",
  aprendizado: "learning",
  criatividade: "creativity",
  empreendedorismo: "entrepreneurship",
  viagem: "travel",
  natureza: "nature",
  cidade: "city",
  equipe: "team",
  metas: "goals",
  planejamento: "planning",
  estrategia: "strategy",
  sucesso: "success",
  confianca: "confidence",
  prioridade: "priority",
  decisoes: "decisions",
  simples: "simple",
  pessoas: "people",
  trabalho: "work",
  escritorio: "office",
  casa: "home",
  familia: "family",
  valor: "value",
  cliente: "client",
  conteudo: "content",
  aula: "lesson",
  professor: "teacher",
  aluno: "student",
};

function englishTerm(word: string): string {
  const clean = word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return ENGLISH_TERMS[clean] ?? word;
}

function imageQuery(text: string, theme?: string): string {
  // Openverse indexes far more English material, so translate common
  // content-marketing themes before searching.
  const base = theme
    ?.trim()
    .split(/\s+/)
    .map(englishTerm)
    .join(" ");
  const words = keywords(text, 1).map(englishTerm);
  return (
    [base, ...words].filter(Boolean).join(" ").slice(0, 80) ||
    "minimal abstract background"
  );
}

/**
 * Openverse's relevance is much better with broad visual categories than with
 * long Portuguese phrases. These queries are rotated per slide.
 */
const VISUAL_CATEGORIES: Array<{ keys: string[]; queries: string[] }> = [
  {
    keys: ["produtividade", "rotina", "foco", "tempo", "organizacao", "habitos", "planejamento", "metas"],
    queries: ["workspace", "notebook", "workspace", "planning"],
  },
  {
    keys: ["estudo", "estudos", "educacao", "aprendizado", "aula", "curso"],
    queries: ["studying", "books", "classroom", "notebook"],
  },
  {
    keys: ["financas", "dinheiro", "investimento", "orcamento", "economia"],
    queries: ["finance", "calculator", "money", "budget"],
  },
  {
    keys: ["saude", "bem-estar", "alimentacao", "exercicio", "fitness", "yoga"],
    queries: ["wellness", "healthy food", "yoga", "fitness"],
  },
  {
    keys: ["tecnologia", "programacao", "software", "ia", "inteligencia artificial"],
    queries: ["technology", "laptop", "coding", "workspace"],
  },
  {
    keys: ["marketing", "vendas", "negocios", "empreendedorismo", "cliente"],
    queries: ["marketing", "meeting", "brainstorming", "workspace"],
  },
  {
    keys: ["criatividade", "design", "arte", "conteudo"],
    queries: ["creative", "art supplies", "workspace", "design"],
  },
  {
    keys: ["viagem", "turismo", "aventura"],
    queries: ["travel", "landscape", "adventure", "travel"],
  },
  {
    keys: ["natureza", "sustentabilidade", "meio ambiente"],
    queries: ["nature", "forest", "landscape", "nature"],
  },
];

function imageQueryForSlide(text: string, theme: string | undefined, index: number): string {
  const haystack = `${theme ?? ""} ${text}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  for (const category of VISUAL_CATEGORIES) {
    if (category.keys.some(key => haystack.includes(key))) {
      return category.queries[index % category.queries.length];
    }
  }
  return imageQuery(text, theme);
}

export function buildPostSlides(
  script: string,
  kind: PostKind,
  title?: string,
  theme?: string,
): SlidePlan[] {
  const clean = cleanText(script);
  if (!clean) throw new Error("Cole o roteiro antes de gerar a postagem.");

  const chunks = splitScript(clean, 260);
  const coverTitle = shorten(title?.trim() || firstSentence(clean), 78);
  const imageTheme = theme?.trim() || title?.trim() || "";
  const coverBodySource = title?.trim()
    ? firstSentence(clean)
    : restAfterFirst(clean);

  if (kind === "post") {
    return [
      {
        name: "Post",
        template: "feed",
        headline: coverTitle,
        body: excerpt(
          coverBodySource || "Salve para lembrar depois.",
          190,
        ),
        query: imageQueryForSlide(clean, imageTheme, 0),
        withImage: true,
      },
    ];
  }

  const slides: SlidePlan[] = [
    {
      name: "Capa",
      template: "feed",
      headline: coverTitle,
      body: excerpt(
        coverBodySource ||
          (kind === "carrossel"
            ? "O passo a passo completo em poucos slides."
            : "Deslize para aprender."),
        130,
      ),
      query: imageQueryForSlide(clean, imageTheme, 0),
      withImage: true,
      signature: kind === "carrossel" ? "ARRASTE →" : undefined,
    },
  ];

  const maxContent = kind === "story" ? 2 : 6;
  // The first block is the hook already shown on the cover.
  const contentSource = chunks.length > 1 ? chunks.slice(1) : chunks;
  const content = contentSource.slice(0, maxContent);
  content.forEach((chunk, index) => {
    const headline = shorten(firstSentence(chunk), 82);
    const body = excerpt(restAfterFirst(chunk), 165);
    slides.push({
      name: `Slide ${index + 2}`,
      template: "topico",
      headline,
      body,
      query: imageQueryForSlide(chunk, imageTheme, index + 1),
      withImage: true,
    });
  });

  slides.push({
    name: "Chamada",
    template: "cta",
    headline:
      kind === "story"
        ? "Toque no link da bio"
        : "Salve para consultar depois",
    body:
      kind === "story"
        ? "Veja o conteúdo completo no seu tempo."
        : "Compartilhe com quem precisa ver isso hoje.",
    query: "",
    withImage: false,
  });

  return slides;
}

export function buildPostCaption(
  script: string,
  kind: PostKind,
  title?: string,
  theme?: string,
): { caption: string; hashtags: string } {
  const clean = cleanText(script);
  const hook = shorten(title?.trim() || firstSentence(clean), 120);
  const paragraphs = clean.split(/\n{2,}/).filter(Boolean);
  const summary = shorten(paragraphs.slice(0, 2).join("\n\n"), 720);
  const cta =
    kind === "carrossel"
      ? "Salve este carrossel para consultar depois e compartilhe com quem precisa."
      : kind === "story"
        ? "Toque no link da bio para ver o conteúdo completo."
        : "Salve este post para lembrar e comente o que você aplicaria primeiro.";

  const topicWords = keywords(`${theme ?? ""} ${clean}`, 6);
  const base = kind === "carrossel" ? ["carrossel", "conteudo", "dica"] : ["post", "conteudo", "dica"];
  const hashtags = Array.from(
    new Set([...topicWords.map(word => `#${word}`), ...base.map(word => `#${word}`)]),
  )
    .slice(0, 10)
    .join(" ");

  const caption = [hook, summary, cta, hashtags]
    .filter(part => part.trim().length > 0)
    .join("\n\n");

  return { caption, hashtags };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>(resolve => setTimeout(() => resolve(null), ms)),
  ]);
}

async function availableImageProviders(withImages: boolean): Promise<StockProvider[]> {
  const providers: StockProvider[] = ["openverse"];
  if (!withImages) return providers;
  const status = await withTimeout(fetchStockStatus(), 5_000).catch(() => null);
  if (status?.pexels.configured) providers.push("pexels");
  if (status?.pixabay.configured) providers.push("pixabay");
  if (status?.unsplash.configured) providers.push("unsplash");
  return providers;
}

async function findImage(
  query: string,
  orientation: StockOrientation,
  providers: StockProvider[],
  used: Set<string>,
  cache: Map<string, StockItem[]>,
  deadline: number,
): Promise<MediaAsset | null> {
  for (const provider of providers) {
    if (Date.now() > deadline) return null;
    const key = `${provider}:${orientation}:${query}`;
    let items = cache.get(key);
    if (!items) {
      const result = await withTimeout(
        searchStock({ provider, kind: "photo", q: query, orientation, page: 1 }),
        10_000,
      );
      if (!result) continue;
      items = result.items;
      cache.set(key, items);
    }

    for (const item of items) {
      if (Date.now() > deadline) return null;
      if (used.has(item.id) || !item.file) continue;
      const file = await withTimeout(downloadStockItem(item), 15_000);
      if (!file) continue;
      try {
        const asset = await withTimeout(importFile(file), 15_000);
        if (!asset) continue;
        used.add(item.id);
        return asset;
      } catch {
        /* try the next result */
      }
    }
  }
  return null;
}

function customiseLayers(layers: Layer[], slide: SlidePlan): Layer[] {
  return layers
    .map(layer => {
      if (layer.kind !== "text") return layer;
      if (layer.name === "Título") {
        const scale =
          slide.headline.length > 60
            ? 0.78
            : slide.headline.length > 42
              ? 0.9
              : 1;
        return {
          ...layer,
          text: slide.headline,
          fontSize: Math.round(layer.fontSize * scale),
        };
      }
      if (
        layer.name === "Apoio" ||
        layer.name === "Explicação" ||
        layer.name === "Subtítulo"
      ) {
        return { ...layer, text: slide.body };
      }
      if (layer.name === "Assinatura") {
        return { ...layer, text: slide.signature ?? "" };
      }
      if (layer.name === "Chamada") {
        return { ...layer, text: slide.headline };
      }
      if (layer.name === "Botão texto") {
        return { ...layer, text: "SALVAR" };
      }
      return layer;
    })
    .filter(layer => !(layer.kind === "text" && layer.text.trim().length === 0));
}

function gradientFor(index: number, accent: string): {
  color: string;
  color2: string;
  angle: number;
} {
  const variants = [
    { color: "#0B0B10", color2: "#2A1408", angle: 135 },
    { color: "#0B0B10", color2: "#101C24", angle: 155 },
    { color: "#141018", color2: accent, angle: 145 },
  ];
  return variants[index % variants.length];
}

export async function generatePostFromScript(
  options: ScriptPostOptions,
): Promise<ScriptPostResult> {
  const script = cleanText(options.script);
  const slides = buildPostSlides(
    script,
    options.kind,
    options.title,
    options.theme,
  );
  const preset = formatPreset(options.format);
  const accent = options.accent ?? DEFAULT_THEME.accent;
  const orientation: StockOrientation =
    preset.height > preset.width
      ? "portrait"
      : preset.width === preset.height
        ? "square"
        : "landscape";

  const providers = await availableImageProviders(options.withImages);
  const cache = new Map<string, StockItem[]>();
  const used = new Set<string>();
  const media: MediaAsset[] = [];
  const assetsBySlide = new Map<number, MediaAsset>();
  // Cap the whole illustration step so a slow stock provider never blocks the
  // post forever. Slides without a photo still keep their designed gradient.
  const imageDeadline = Date.now() + 45_000;

  options.onProgress?.({
    step: "Montando os slides…",
    index: 0,
    total: slides.length,
  });

  for (let index = 0; index < slides.length; index += 1) {
    const slide = slides[index];
    if (!options.withImages || !slide.withImage) continue;
    if (Date.now() > imageDeadline) break;
    options.onProgress?.({
      step: `Buscando imagem para “${slide.headline}”…`,
      index,
      total: slides.length,
    });
    const asset = await findImage(
      slide.query,
      orientation,
      providers,
      used,
      cache,
      imageDeadline,
    );
    if (asset) {
      media.push(asset);
      assetsBySlide.set(index, asset);
    }
  }

  const scenes = slides.map((slide, index) => {
    const asset = assetsBySlide.get(index);
    const gradient = gradientFor(index, accent);
    const background = asset
      ? {
          type: "image" as const,
          color: "#0B0B10",
          color2: "#14141B",
          angle: 0,
          mediaId: asset.id,
          dim: 0.56,
          blur: 0,
          kenBurns: "in" as const,
        }
      : {
          type: "gradient" as const,
          ...gradient,
          dim: 0,
          blur: 0,
        };

    return newScene({
      name: slide.name,
      duration: 5,
      background,
      layers: customiseLayers(
        buildTemplateLayers(
          slide.template,
          preset.width,
          preset.height,
          accent,
        ),
        slide,
      ),
      narration: {
        text: "",
        voiceId: PT_VOICES[0].id,
        rate: 1,
        pitch: 1,
      },
      transition: { type: "fade", duration: 0.4 },
    });
  });

  const title =
    options.title?.trim() ||
    shorten(firstSentence(script), 64) ||
    "Post do roteiro";
  const kind: "carrossel" | "anuncio" | "post" =
    options.kind === "carrossel"
      ? "carrossel"
      : options.kind === "story"
        ? "anuncio"
        : "post";

  const project: Project = {
    id: uid("project"),
    kind,
    name: title,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    format: preset.id,
    width: preset.width,
    height: preset.height,
    scenes,
    media,
    captions: { ...DEFAULT_CAPTIONS, enabled: false },
    theme: { ...DEFAULT_THEME, accent },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  options.onProgress?.({
    step: "Salvando a postagem…",
    index: slides.length,
    total: slides.length,
  });
  await saveProject(project);

  const { caption, hashtags } = buildPostCaption(
    script,
    options.kind,
    options.title,
    options.theme,
  );
  const altTexts = slides.map(
    (slide, index) => `Slide ${index + 1}: ${slide.headline}`,
  );

  options.onProgress?.({
    step: "Postagem pronta",
    index: slides.length,
    total: slides.length,
  });

  return { project, caption, hashtags, altTexts };
}
