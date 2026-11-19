/**
 * Shared editor model: used by the canvas renderer, the export pipeline,
 * the React UI and the server-side helpers.
 */

export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:5" | "1.91:1" | "2:3";

export type FormatPresetId =
  | "hotmart"
  | "youtube"
  | "reels"
  | "stories"
  | "feed"
  | "square"
  | "blog"
  | "pinterest";

export interface FormatPreset {
  id: FormatPresetId;
  label: string;
  ratio: AspectRatio;
  width: number;
  height: number;
  channel: string;
  hint: string;
}

export const FORMAT_PRESETS: FormatPreset[] = [
  {
    id: "hotmart",
    label: "Aula Hotmart",
    ratio: "16:9",
    width: 1920,
    height: 1080,
    channel: "Hotmart",
    hint: "Formato padrão de aula em vídeo da Hotmart.",
  },
  {
    id: "youtube",
    label: "YouTube",
    ratio: "16:9",
    width: 1920,
    height: 1080,
    channel: "YouTube",
    hint: "Aulas longas e vídeos horizontais.",
  },
  {
    id: "reels",
    label: "Reels / TikTok",
    ratio: "9:16",
    width: 1080,
    height: 1920,
    channel: "Instagram · TikTok · Shorts",
    hint: "Vertical. Deixe textos longe das bordas superior e inferior.",
  },
  {
    id: "stories",
    label: "Stories",
    ratio: "9:16",
    width: 1080,
    height: 1920,
    channel: "Instagram · Facebook",
    hint: "Vertical curto para stories e anúncios.",
  },
  {
    id: "feed",
    label: "Feed 4:5",
    ratio: "4:5",
    width: 1080,
    height: 1350,
    channel: "Instagram · Facebook",
    hint: "Ocupa mais espaço no feed.",
  },
  {
    id: "square",
    label: "Quadrado",
    ratio: "1:1",
    width: 1080,
    height: 1080,
    channel: "Feed · LinkedIn",
    hint: "Versátil para feed e carrosséis.",
  },
  {
    id: "blog",
    label: "Capa de blog",
    ratio: "1.91:1",
    width: 1200,
    height: 630,
    channel: "Blog · LinkedIn · prévia de link",
    hint: "Imagem de capa e miniatura de compartilhamento (Open Graph).",
  },
  {
    id: "pinterest",
    label: "Pinterest 2:3",
    ratio: "2:3",
    width: 1000,
    height: 1500,
    channel: "Pinterest · capas",
    hint: "Vertical alto para pins e capas de e-book.",
  },
];

export function formatPreset(id: FormatPresetId): FormatPreset {
  return FORMAT_PRESETS.find(preset => preset.id === id) ?? FORMAT_PRESETS[0];
}

export type LayerKind = "text" | "image" | "video" | "shape" | "avatar";

export type LayerAnimation = "none" | "fade" | "rise" | "pop";

export interface LayerFilters {
  brightness: number;
  contrast: number;
  saturate: number;
  blur: number;
  grayscale: number;
}

export const DEFAULT_FILTERS: LayerFilters = {
  brightness: 1,
  contrast: 1,
  saturate: 1,
  blur: 0,
  grayscale: 0,
};

export type BlendMode =
  | "source-over"
  | "multiply"
  | "screen"
  | "overlay"
  | "lighten"
  | "darken"
  | "soft-light"
  | "color-dodge";

export interface BaseLayer {
  id: string;
  kind: LayerKind;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  opacity: number;
  locked?: boolean;
  hidden?: boolean;
  anim?: LayerAnimation;
  animDelay?: number;
  flipH?: boolean;
  flipV?: boolean;
  blend?: BlendMode;
  filters?: LayerFilters;
  border?: { width: number; color: string };
  shadowStyle?: { color: string; blur: number; offsetY: number };
}

export interface TextLayer extends BaseLayer {
  kind: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  align: "left" | "center" | "right";
  lineHeight: number;
  letterSpacing: number;
  uppercase: boolean;
  bgEnabled: boolean;
  bgColor: string;
  bgRadius: number;
  shadow: boolean;
  strokeWidth?: number;
  strokeColor?: string;
  highlightColor?: string;
  highlightWord?: string;
}

export interface ImageLayer extends BaseLayer {
  kind: "image";
  mediaId: string;
  fit: "cover" | "contain";
  radius: number;
  shadow: boolean;
  kenBurns: "none" | "in" | "out";
}

export interface VideoLayer extends BaseLayer {
  kind: "video";
  mediaId: string;
  fit: "cover" | "contain";
  radius: number;
  startAt: number;
}

export interface ShapeLayer extends BaseLayer {
  kind: "shape";
  shape: "rect" | "ellipse" | "line";
  fill: string;
  stroke: string;
  strokeWidth: number;
  radius: number;
}

export interface AvatarLayer extends BaseLayer {
  kind: "avatar";
  avatarId: string;
  mode: "vector" | "photo";
  photoMediaId?: string;
  ring: boolean;
  ringColor: string;
  bob: boolean;
  mirror?: boolean;
}

export type Layer = TextLayer | ImageLayer | VideoLayer | ShapeLayer | AvatarLayer;

export interface SceneBackground {
  type: "solid" | "gradient" | "image" | "video";
  color: string;
  color2: string;
  angle: number;
  mediaId?: string;
  dim: number;
  blur: number;
  /** Slow camera push on image/video backgrounds. */
  kenBurns?: "none" | "in" | "out";
  /** Offset into the background video, in seconds (used when a scene is split). */
  startAt?: number;
}

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

export interface Narration {
  text: string;
  voiceId: string;
  rate: number;
  pitch: number;
  assetId?: string;
  /** Seconds skipped at the beginning of the audio asset (scene splits). */
  offset?: number;
  duration?: number;
  words?: WordTiming[];
  source?: "tts" | "mic" | "upload";
}

/** Seconds of narration still available after the scene's start offset. */
export function narrationLength(narration: Narration): number {
  if (!narration.duration) return 0;
  return Math.max(
    0,
    narration.duration - Math.max(0, narration.offset ?? 0),
  );
}

export type TransitionType = "none" | "fade" | "slide" | "zoom";

export interface SceneTransition {
  type: TransitionType;
  duration: number;
}

export interface Scene {
  id: string;
  name: string;
  duration: number;
  background: SceneBackground;
  layers: Layer[];
  narration: Narration;
  transition: SceneTransition;
}

export type MediaKind = "image" | "video" | "audio";

export interface MediaAsset {
  id: string;
  name: string;
  kind: MediaKind;
  mime: string;
  width?: number;
  height?: number;
  duration?: number;
  size: number;
  createdAt: number;
}

export interface CaptionSettings {
  enabled: boolean;
  position: "bottom" | "top";
  fontSize: number;
  color: string;
  highlightColor: string;
  bgColor: string;
  bgOpacity: number;
  maxWordsPerLine: number;
  uppercase: boolean;
  margin: number;
}

export interface ProjectTheme {
  accent: string;
  fontDisplay: string;
  fontBody: string;
}

export interface Project {
  id: string;
  name: string;
  kind?: ProjectKind;
  /** Document version, used to migrate projects saved by older releases. */
  schemaVersion: number;
  format: FormatPresetId;
  width: number;
  height: number;
  scenes: Scene[];
  media: MediaAsset[];
  captions: CaptionSettings;
  theme: ProjectTheme;
  createdAt: number;
  updatedAt: number;
}

export interface VoiceOption {
  id: string;
  name: string;
  gender: "Feminina" | "Masculina";
  description: string;
  sample: string;
}

export const PT_VOICES: VoiceOption[] = [
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

export interface AvatarPreset {
  id: string;
  name: string;
  skin: string;
  skinShade: string;
  hair: "long" | "short" | "bun" | "curly" | "bald";
  hairColor: string;
  shirt: string;
  shirtDark: string;
  glasses: boolean;
  earrings: boolean;
  brows: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: "ana",
    name: "Ana",
    skin: "#C98A62",
    skinShade: "#A96E4B",
    hair: "long",
    hairColor: "#2B1B12",
    shirt: "#FF7A1A",
    shirtDark: "#D65F0B",
    glasses: false,
    earrings: true,
    brows: "#241610",
  },
  {
    id: "bruno",
    name: "Bruno",
    skin: "#8D5B3C",
    skinShade: "#734528",
    hair: "short",
    hairColor: "#1C1410",
    shirt: "#2C6E6B",
    shirtDark: "#1F514F",
    glasses: true,
    earrings: false,
    brows: "#170F0B",
  },
  {
    id: "carla",
    name: "Carla",
    skin: "#E7B48C",
    skinShade: "#CE9A72",
    hair: "bun",
    hairColor: "#6B3A1E",
    shirt: "#6C5CE7",
    shirtDark: "#4F42BE",
    glasses: false,
    earrings: true,
    brows: "#4A2A16",
  },
  {
    id: "davi",
    name: "Davi",
    skin: "#5C3A26",
    skinShade: "#48291A",
    hair: "curly",
    hairColor: "#14100E",
    shirt: "#E8C547",
    shirtDark: "#C2A22F",
    glasses: false,
    earrings: false,
    brows: "#0F0B09",
  },
];

export function avatarPreset(id: string): AvatarPreset {
  return AVATAR_PRESETS.find(preset => preset.id === id) ?? AVATAR_PRESETS[0];
}

export const DEFAULT_CAPTIONS: CaptionSettings = {
  enabled: true,
  position: "bottom",
  fontSize: 54,
  color: "#FFFFFF",
  highlightColor: "#FFB020",
  bgColor: "#0B0B0F",
  bgOpacity: 0.55,
  maxWordsPerLine: 6,
  uppercase: false,
  margin: 96,
};

export const DEFAULT_THEME: ProjectTheme = {
  accent: "#FF7A1A",
  fontDisplay: "Space Grotesk",
  fontBody: "Inter",
};

export const PROJECT_SCHEMA_VERSION = 2;

/**
 * Reads projects saved by older versions without breaking the editor.
 * Version 2 introduced narration offsets, background video offsets and a
 * schema number. Projects without a number are treated as version 1.
 */
export function migrateProject(input: Project): Project {
  if (!input || !Array.isArray(input.scenes)) {
    throw new Error("Projeto inválido: cenas não encontradas.");
  }

  const project = input as Project;
  if (typeof project.schemaVersion !== "number") project.schemaVersion = 1;
  if (project.schemaVersion > PROJECT_SCHEMA_VERSION) {
    throw new Error(
      "Este projeto foi criado em uma versão mais nova do Studio Nova. Atualize o aplicativo para abri-lo.",
    );
  }

  if (project.schemaVersion < 2) {
    project.captions = { ...DEFAULT_CAPTIONS, ...project.captions };
    project.theme = { ...DEFAULT_THEME, ...project.theme };
    project.media = project.media ?? [];
    project.scenes = project.scenes.map(scene => ({
      ...scene,
      duration: Number.isFinite(scene.duration) ? scene.duration : 5,
      layers: scene.layers ?? [],
      background: {
        ...scene.background,
        startAt: scene.background?.startAt ?? 0,
      },
      narration: {
        ...scene.narration,
        offset: scene.narration?.offset ?? 0,
      },
    }));
    project.schemaVersion = PROJECT_SCHEMA_VERSION;
  }

  return project;
}

let counter = 0;
export function uid(prefix = "id"): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export function newTextLayer(partial: Partial<TextLayer> = {}): TextLayer {
  return {
    id: uid("layer"),
    kind: "text",
    name: "Texto",
    x: 160,
    y: 420,
    w: 1200,
    h: 220,
    rotation: 0,
    opacity: 1,
    anim: "rise",
    animDelay: 0,
    text: "Escreva aqui o título da sua aula",
    fontFamily: "Space Grotesk",
    fontSize: 96,
    fontWeight: 700,
    color: "#FFFFFF",
    align: "left",
    lineHeight: 1.12,
    letterSpacing: -1,
    uppercase: false,
    bgEnabled: false,
    bgColor: "#0B0B0F",
    bgRadius: 24,
    shadow: false,
    ...partial,
  };
}

export function newShapeLayer(partial: Partial<ShapeLayer> = {}): ShapeLayer {
  return {
    id: uid("layer"),
    kind: "shape",
    name: "Forma",
    x: 160,
    y: 700,
    w: 320,
    h: 12,
    rotation: 0,
    opacity: 1,
    anim: "fade",
    animDelay: 0,
    shape: "rect",
    fill: "#FF7A1A",
    stroke: "transparent",
    strokeWidth: 0,
    radius: 999,
    ...partial,
  };
}

export function newImageLayer(mediaId: string, partial: Partial<ImageLayer> = {}): ImageLayer {
  return {
    id: uid("layer"),
    kind: "image",
    name: "Imagem",
    x: 980,
    y: 220,
    w: 760,
    h: 640,
    rotation: 0,
    opacity: 1,
    anim: "fade",
    animDelay: 0,
    mediaId,
    fit: "cover",
    radius: 28,
    shadow: true,
    kenBurns: "in",
    ...partial,
  };
}

export function newVideoLayer(mediaId: string, partial: Partial<VideoLayer> = {}): VideoLayer {
  return {
    id: uid("layer"),
    kind: "video",
    name: "Vídeo",
    x: 560,
    y: 240,
    w: 800,
    h: 450,
    rotation: 0,
    opacity: 1,
    anim: "fade",
    animDelay: 0,
    mediaId,
    fit: "cover",
    radius: 24,
    startAt: 0,
    ...partial,
  };
}

export function newAvatarLayer(partial: Partial<AvatarLayer> = {}): AvatarLayer {
  return {
    id: uid("layer"),
    kind: "avatar",
    name: "Avatar",
    x: 1360,
    y: 520,
    w: 420,
    h: 420,
    rotation: 0,
    opacity: 1,
    anim: "pop",
    animDelay: 0.1,
    avatarId: "ana",
    mode: "vector",
    ring: true,
    ringColor: "#FF7A1A",
    bob: true,
    ...partial,
  };
}

export function newScene(partial: Partial<Scene> = {}): Scene {
  return {
    id: uid("scene"),
    name: "Nova cena",
    duration: 6,
    background: {
      type: "gradient",
      color: "#101018",
      color2: "#1D1630",
      angle: 135,
      dim: 0,
      blur: 0,
    },
    layers: [],
    narration: {
      text: "",
      voiceId: PT_VOICES[0].id,
      rate: 1,
      pitch: 1,
    },
    transition: { type: "fade", duration: 0.5 },
    ...partial,
  };
}

export function createStarterProject(name = "Minha primeira aula"): Project {
  const now = Date.now();
  const preset = formatPreset("hotmart");

  const opening = newScene({
    name: "Abertura",
    duration: 7,
    background: {
      type: "gradient",
      color: "#0B0B10",
      color2: "#2A1408",
      angle: 130,
      dim: 0,
      blur: 0,
    },
    layers: [
      newShapeLayer({ name: "Marca", x: 160, y: 330, w: 120, h: 10 }),
      newTextLayer({
        name: "Título",
        x: 160,
        y: 370,
        w: 1080,
        h: 250,
        text: "Aula 01 — Bem-vindo ao curso",
        fontSize: 92,
      }),
      newTextLayer({
        name: "Subtítulo",
        x: 160,
        y: 645,
        w: 940,
        h: 110,
        text: "No final desta aula você vai saber exatamente o primeiro passo.",
        fontSize: 36,
        fontWeight: 400,
        color: "#CFCADD",
        animDelay: 0.2,
      }),
      newAvatarLayer({ x: 1410, y: 400, w: 400, h: 400 }),
    ],
    narration: {
      text: "Olá! Seja bem-vindo à primeira aula do curso. Hoje eu vou te mostrar o caminho completo para começar com o pé direito.",
      voiceId: PT_VOICES[0].id,
      rate: 1,
      pitch: 1,
    },
  });

  const content = newScene({
    name: "Conteúdo",
    duration: 9,
    background: {
      type: "gradient",
      color: "#0B0B10",
      color2: "#101C24",
      angle: 160,
      dim: 0,
      blur: 0,
    },
    layers: [
      newTextLayer({
        name: "Título",
        x: 160,
        y: 150,
        w: 1200,
        h: 150,
        text: "Os 3 passos de hoje",
        fontSize: 76,
      }),
      newTextLayer({
        name: "Tópico 1",
        x: 160,
        y: 350,
        w: 900,
        h: 100,
        text: "1. Entenda o problema do seu aluno",
        fontSize: 44,
        fontWeight: 500,
        color: "#F1EEF8",
        animDelay: 0.1,
      }),
      newTextLayer({
        name: "Tópico 2",
        x: 160,
        y: 480,
        w: 900,
        h: 100,
        text: "2. Mostre o caminho em etapas curtas",
        fontSize: 44,
        fontWeight: 500,
        color: "#F1EEF8",
        animDelay: 0.25,
      }),
      newTextLayer({
        name: "Tópico 3",
        x: 160,
        y: 610,
        w: 900,
        h: 100,
        text: "3. Prove o resultado com um exemplo real",
        fontSize: 44,
        fontWeight: 500,
        color: "#F1EEF8",
        animDelay: 0.4,
      }),
      newAvatarLayer({ x: 1430, y: 480, w: 340, h: 340, animDelay: 0.3 }),
    ],
    narration: {
      text: "Nesta aula eu vou dividir o conteúdo em três passos: entender o problema do seu aluno, mostrar o caminho em etapas curtas e provar o resultado com um exemplo real.",
      voiceId: PT_VOICES[0].id,
      rate: 1,
      pitch: 1,
    },
  });

  const closing = newScene({
    name: "Encerramento",
    duration: 6,
    background: {
      type: "gradient",
      color: "#150A05",
      color2: "#0B0B10",
      angle: 200,
      dim: 0,
      blur: 0,
    },
    layers: [
      newTextLayer({
        name: "Chamada",
        x: 260,
        y: 360,
        w: 1400,
        h: 220,
        text: "Agora me conta: qual é o seu primeiro passo?",
        fontSize: 76,
        align: "center",
      }),
      newShapeLayer({ name: "Botão", x: 760, y: 660, w: 400, h: 88, radius: 999 }),
      newTextLayer({
        name: "Botão texto",
        x: 760,
        y: 678,
        w: 400,
        h: 56,
        text: "Responder na aula",
        fontSize: 32,
        fontWeight: 600,
        align: "center",
        color: "#0B0B10",
        animDelay: 0.2,
      }),
    ],
    narration: {
      text: "Para fechar: qual é o primeiro passo que você vai aplicar hoje? Responda na área de comentários da aula. Até a próxima!",
      voiceId: PT_VOICES[0].id,
      rate: 1,
      pitch: 1,
    },
  });

  return {
    id: uid("project"),
    kind: "aula",
    name,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    format: preset.id,
    width: preset.width,
    height: preset.height,
    scenes: [opening, content, closing],
    media: [],
    captions: { ...DEFAULT_CAPTIONS },
    theme: { ...DEFAULT_THEME },
    createdAt: now,
    updatedAt: now,
  };
}

export function totalDuration(project: Project): number {
  return project.scenes.reduce((sum, scene) => sum + scene.duration, 0);
}

export type ProjectKind = "aula" | "post" | "carrossel" | "blog" | "live" | "anuncio";

export type ScenarioId = "cidade" | "campo" | "floresta" | "praia" | "montanha" | "interior" | "estudio";

/** Photorealistic background prompts (no people) generated on demand. */
export const SCENARIOS: Array<{ id: ScenarioId; label: string; prompt: string }> = [
  {
    id: "cidade",
    label: "Cidade",
    prompt:
      "photorealistic urban background, modern city street with glass buildings and soft late afternoon light, empty scene with no people, cinematic depth of field, high resolution, 16:9",
  },
  {
    id: "campo",
    label: "Campo",
    prompt:
      "photorealistic countryside landscape, green fields, wooden fence and distant trees at golden hour, no people, cinematic wide shot, high resolution, 16:9",
  },
  {
    id: "floresta",
    label: "Floresta",
    prompt:
      "photorealistic lush forest background, soft sunlight through tall trees, mist and ferns, no people, cinematic depth of field, high resolution, 16:9",
  },
  {
    id: "praia",
    label: "Praia",
    prompt:
      "photorealistic tropical beach background, turquoise water, gentle waves and soft sand, warm light, no people, cinematic, high resolution, 16:9",
  },
  {
    id: "montanha",
    label: "Montanha",
    prompt:
      "photorealistic mountain range at sunrise, layered peaks and misty valley, no people, cinematic wide shot, high resolution, 16:9",
  },
  {
    id: "interior",
    label: "Interior",
    prompt:
      "photorealistic modern living room interior, warm natural light, plants and neutral furniture, architectural photography, no people, high resolution, 16:9",
  },
  {
    id: "estudio",
    label: "Estúdio",
    prompt:
      "photorealistic photography studio background, seamless dark grey backdrop with soft rim light and subtle gradient, no people, high resolution, 16:9",
  },
];

export interface ProjectKindPreset {
  id: ProjectKind;
  label: string;
  description: string;
  format: FormatPresetId;
  scenes: SceneTemplateId[];
  exportHint: string;
}

/** What the studio can produce: lessons, posts, carousels, blog covers and live announcements. */
export const PROJECT_KINDS: ProjectKindPreset[] = [
  {
    id: "aula",
    label: "Aula em vídeo",
    description: "Cenas narradas com avatar e legendas, para Hotmart e YouTube.",
    format: "hotmart",
    scenes: ["capa", "pontos", "cta"],
    exportHint: "Vídeo MP4 com narração",
  },
  {
    id: "post",
    label: "Post de feed",
    description: "Arte única para Instagram, Facebook ou LinkedIn.",
    format: "feed",
    scenes: ["feed"],
    exportHint: "Imagem PNG",
  },
  {
    id: "carrossel",
    label: "Carrossel",
    description: "Vários slides em sequência, exportados como imagens.",
    format: "feed",
    scenes: ["feed", "pontos", "checklist", "cta"],
    exportHint: "Imagens PNG de cada slide",
  },
  {
    id: "blog",
    label: "Capa de blog",
    description: "Imagem de capa e prévia de link para artigos.",
    format: "blog",
    scenes: ["blog"],
    exportHint: "Imagem PNG 1200×630",
  },
  {
    id: "live",
    label: "Chamada de live",
    description: "Thumbnail com selo AO VIVO, data e apresentador.",
    format: "youtube",
    scenes: ["live"],
    exportHint: "Imagem PNG ou vídeo curto",
  },
  {
    id: "anuncio",
    label: "Anúncio / Stories",
    description: "Vertical com oferta, benefício e botão de ação.",
    format: "stories",
    scenes: ["promo"],
    exportHint: "Vídeo ou imagem vertical",
  },
];

export function projectKindPreset(kind: ProjectKind | undefined): ProjectKindPreset {
  return PROJECT_KINDS.find(item => item.id === kind) ?? PROJECT_KINDS[0];
}

export function createProject(kind: ProjectKind = "aula", name?: string): Project {
  if (kind === "aula") return createStarterProject(name ?? "Minha primeira aula");

  const preset = projectKindPreset(kind);
  const format = formatPreset(preset.format);
  const now = Date.now();
  const scenes = preset.scenes.map((templateId, index) => {
    const template = SCENE_TEMPLATES.find(item => item.id === templateId);
    const label = template?.label ?? "Cena";
    return newScene({
      name: preset.scenes.length > 1 ? `${index + 1}. ${label}` : label,
      duration: 5,
      background: {
        type: "gradient",
        color: "#0B0B10",
        color2: "#241206",
        angle: 140,
        dim: 0,
        blur: 0,
      },
      layers: buildTemplateLayers(templateId, format.width, format.height, DEFAULT_THEME.accent),
    });
  });

  return {
    id: uid("project"),
    kind,
    name: name ?? preset.label,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    format: format.id,
    width: format.width,
    height: format.height,
    scenes,
    media: [],
    captions: { ...DEFAULT_CAPTIONS },
    theme: { ...DEFAULT_THEME },
    createdAt: now,
    updatedAt: now,
  };
}

export type SceneTemplateId =
  | "capa"
  | "pontos"
  | "checklist"
  | "citacao"
  | "cta"
  | "topico"
  | "feed"
  | "blog"
  | "live"
  | "promo";

export const SCENE_TEMPLATES: Array<{ id: SceneTemplateId; label: string; hint: string }> = [
  { id: "capa", label: "Capa", hint: "Título grande com linha de destaque e subtítulo" },
  { id: "topico", label: "Tópico", hint: "Título curto e uma ideia por cena" },
  { id: "pontos", label: "3 pontos", hint: "Lista numerada para explicar um passo a passo" },
  { id: "checklist", label: "Checklist", hint: "Lista com marcadores, estilo radar de notícias" },
  { id: "citacao", label: "Citação", hint: "Frase centralizada para dar ênfase" },
  { id: "cta", label: "Chamada final", hint: "Convite para comentar, curtir ou continuar" },
  { id: "feed", label: "Post de feed", hint: "Arte quadrada/4:5 com frase de impacto e assinatura" },
  { id: "blog", label: "Capa de blog", hint: "Título, linha de apoio e bloco de cor para o post" },
  { id: "live", label: "Chamada de live", hint: "Selo AO VIVO, título, data e apresentador" },
  { id: "promo", label: "Oferta / anúncio", hint: "Etiqueta, oferta, benefício e botão de ação" },
];

/** Layout presets that adapt to any canvas size (16:9, 9:16, 4:5, 1:1). */
export function buildTemplateLayers(
  templateId: SceneTemplateId,
  width: number,
  height: number,
  accent: string,
): Layer[] {
  const unit = Math.min(width, height);
  const left = Math.round(width * 0.075);
  const contentWidth = Math.round(width * 0.85);
  const titleSize = Math.round(unit * 0.095);
  const bodySize = Math.round(unit * 0.046);
  const top = Math.round(height * 0.16);

  const bar = (y: number, w = 0.14) =>
    newShapeLayer({
      name: "Destaque",
      x: left,
      y,
      w: Math.round(width * w),
      h: Math.max(6, Math.round(unit * 0.008)),
      fill: accent,
      radius: 999,
      anim: "fade",
    });

  if (templateId === "capa") {
    return [
      bar(Math.round(height * 0.26)),
      newTextLayer({
        name: "Título",
        x: left,
        y: Math.round(height * 0.3),
        w: contentWidth,
        h: Math.round(height * 0.3),
        text: "Título da sua aula",
        fontSize: titleSize,
      }),
      newTextLayer({
        name: "Subtítulo",
        x: left,
        y: Math.round(height * 0.62),
        w: Math.round(width * 0.78),
        h: Math.round(height * 0.16),
        text: "Uma frase que explica o que a pessoa vai levar desta cena.",
        fontSize: Math.round(unit * 0.038),
        fontWeight: 400,
        color: "#CFCADD",
        animDelay: 0.15,
      }),
    ];
  }

  if (templateId === "topico") {
    return [
      bar(Math.round(height * 0.14)),
      newTextLayer({
        name: "Título",
        x: left,
        y: top,
        w: contentWidth,
        h: Math.round(height * 0.22),
        text: "O ponto principal desta cena",
        fontSize: Math.round(titleSize * 0.82),
      }),
      newTextLayer({
        name: "Explicação",
        x: left,
        y: Math.round(height * 0.44),
        w: Math.round(width * 0.8),
        h: Math.round(height * 0.26),
        text: "Explique em uma ou duas frases. Use exemplos concretos e evite rodeios.",
        fontSize: bodySize,
        fontWeight: 400,
        color: "#E7E2F2",
        lineHeight: 1.4,
        animDelay: 0.15,
      }),
    ];
  }

  if (templateId === "pontos") {
    const items = [
      "1. Primeiro passo do processo",
      "2. Segundo passo, sem pressa",
      "3. Terceiro passo para fechar",
    ];
    return [
      newTextLayer({
        name: "Título",
        x: left,
        y: Math.round(height * 0.12),
        w: contentWidth,
        h: Math.round(height * 0.14),
        text: "Os 3 pontos de hoje",
        fontSize: Math.round(titleSize * 0.78),
      }),
      ...items.map((text, index) =>
        newTextLayer({
          name: `Ponto ${index + 1}`,
          x: left,
          y: Math.round(height * (0.3 + index * 0.13)),
          w: contentWidth,
          h: Math.round(height * 0.1),
          text,
          fontSize: bodySize,
          fontWeight: 500,
          color: "#F1EEF8",
          animDelay: 0.1 + index * 0.12,
        }),
      ),
    ];
  }

  if (templateId === "checklist") {
    const items = [
      "✓ Confira o primeiro item",
      "✓ Documente o segundo item",
      "✓ Revise o terceiro item",
      "✓ Feche o quarto item",
    ];
    return [
      newTextLayer({
        name: "Título",
        x: left,
        y: Math.round(height * 0.1),
        w: contentWidth,
        h: Math.round(height * 0.14),
        text: "Checklist rápido",
        fontSize: Math.round(titleSize * 0.74),
      }),
      ...items.map((text, index) =>
        newTextLayer({
          name: `Item ${index + 1}`,
          x: left,
          y: Math.round(height * (0.28 + index * 0.105)),
          w: contentWidth,
          h: Math.round(height * 0.085),
          text,
          fontSize: Math.round(bodySize * 0.95),
          fontWeight: 500,
          color: index === 0 ? accent : "#EFEAF7",
          animDelay: 0.08 + index * 0.1,
        }),
      ),
    ];
  }

  if (templateId === "citacao") {
    return [
      newTextLayer({
        name: "Citação",
        x: left,
        y: Math.round(height * 0.34),
        w: contentWidth,
        h: Math.round(height * 0.3),
        text: "“A frase que resume a sua ideia.”",
        fontSize: Math.round(titleSize * 0.72),
        align: "center",
        lineHeight: 1.25,
      }),
      bar(Math.round(height * 0.66), 0.08),
    ];
  }

  if (templateId === "feed") {
    return [
      bar(Math.round(height * 0.2)),
      newTextLayer({
        name: "Título",
        x: left,
        y: Math.round(height * 0.25),
        w: contentWidth,
        h: Math.round(height * 0.26),
        text: "A frase que para o dedo no feed",
        fontSize: Math.round(unit * 0.105),
        lineHeight: 1.15,
      }),
      newTextLayer({
        name: "Apoio",
        x: left,
        y: Math.round(height * 0.56),
        w: Math.round(width * 0.8),
        h: Math.round(height * 0.18),
        text: "Um complemento curto com a promessa principal do post.",
        fontSize: Math.round(unit * 0.04),
        fontWeight: 400,
        color: "#CFCADD",
        animDelay: 0.15,
      }),
      newTextLayer({
        name: "Assinatura",
        x: left,
        y: Math.round(height * 0.85),
        w: contentWidth,
        h: Math.round(height * 0.06),
        text: "@seuperfil",
        fontSize: Math.round(unit * 0.034),
        fontWeight: 600,
        color: accent,
        animDelay: 0.25,
      }),
    ];
  }

  if (templateId === "blog") {
    const size = Math.round(Math.min(width * 0.072, height * 0.15));
    return [
      bar(Math.round(height * 0.2)),
      newTextLayer({
        name: "Título",
        x: left,
        y: Math.round(height * 0.27),
        w: Math.round(width * 0.62),
        h: Math.round(height * 0.42),
        text: "O título que faz a pessoa clicar",
        fontSize: size,
        lineHeight: 1.12,
      }),
      newTextLayer({
        name: "Linha de apoio",
        x: left,
        y: Math.round(height * 0.72),
        w: Math.round(width * 0.55),
        h: Math.round(height * 0.16),
        text: "Uma frase curta com o benefício principal do artigo.",
        fontSize: Math.round(size * 0.4),
        fontWeight: 400,
        color: "#CFCADD",
        animDelay: 0.15,
      }),
      newShapeLayer({
        name: "Moldura",
        x: Math.round(width * 0.75),
        y: Math.round(height * 0.16),
        w: Math.round(width * 0.19),
        h: Math.round(height * 0.68),
        radius: Math.round(width * 0.02),
        fill: "rgba(0,0,0,0)",
        stroke: accent,
        strokeWidth: Math.max(3, Math.round(width * 0.003)),
        anim: "fade",
        animDelay: 0.1,
      }),
      newShapeLayer({
        name: "Selo",
        shape: "ellipse",
        x: Math.round(width * 0.795),
        y: Math.round(height * 0.6),
        w: Math.round(width * 0.1),
        h: Math.round(width * 0.1),
        fill: accent,
        anim: "pop",
        animDelay: 0.25,
      }),
      newTextLayer({
        name: "Selo texto",
        x: Math.round(width * 0.795),
        y: Math.round(height * 0.6 + width * 0.035),
        w: Math.round(width * 0.1),
        h: Math.round(width * 0.035),
        text: "LEIA",
        fontSize: Math.round(width * 0.016),
        fontWeight: 800,
        align: "center",
        color: "#170B03",
        animDelay: 0.3,
      }),
    ];
  }

  if (templateId === "live") {
    const badgeW = Math.round(width * 0.14);
    const badgeH = Math.round(height * 0.075);
    return [
      newShapeLayer({
        name: "Selo",
        x: left,
        y: Math.round(height * 0.15),
        w: badgeW,
        h: badgeH,
        radius: 999,
        fill: accent,
        anim: "pop",
      }),
      newTextLayer({
        name: "Selo texto",
        x: left,
        y: Math.round(height * 0.15 + badgeH * 0.2),
        w: badgeW,
        h: Math.round(badgeH * 0.62),
        text: "AO VIVO",
        fontSize: Math.round(badgeH * 0.44),
        fontWeight: 800,
        align: "center",
        color: "#170B03",
      }),
      newTextLayer({
        name: "Título",
        x: left,
        y: Math.round(height * 0.3),
        w: Math.round(width * 0.6),
        h: Math.round(height * 0.34),
        text: "Título da sua live",
        fontSize: Math.round(unit * 0.105),
        lineHeight: 1.1,
      }),
      newTextLayer({
        name: "Data",
        x: left,
        y: Math.round(height * 0.72),
        w: Math.round(width * 0.5),
        h: Math.round(height * 0.1),
        text: "Quinta, 20h · com seu nome",
        fontSize: Math.round(unit * 0.042),
        fontWeight: 500,
        color: "#E7E2F2",
        animDelay: 0.15,
      }),
      newAvatarLayer({
        x: Math.round(width * 0.73),
        y: Math.round(height * 0.26),
        w: Math.round(unit * 0.44),
        h: Math.round(unit * 0.44),
        animDelay: 0.2,
      }),
    ];
  }

  if (templateId === "promo") {
    return [
      newTextLayer({
        name: "Etiqueta",
        x: left,
        y: Math.round(height * 0.15),
        w: contentWidth,
        h: Math.round(height * 0.05),
        text: "OFERTA DE LANÇAMENTO",
        fontSize: Math.round(unit * 0.03),
        fontWeight: 700,
        uppercase: true,
        color: accent,
      }),
      newTextLayer({
        name: "Título",
        x: left,
        y: Math.round(height * 0.22),
        w: contentWidth,
        h: Math.round(height * 0.22),
        text: "Sua oferta em uma frase clara",
        fontSize: Math.round(unit * 0.085),
        lineHeight: 1.12,
      }),
      newTextLayer({
        name: "Benefício",
        x: left,
        y: Math.round(height * 0.47),
        w: contentWidth,
        h: Math.round(height * 0.16),
        text: "Explique o resultado que a pessoa leva em poucas palavras.",
        fontSize: Math.round(unit * 0.04),
        fontWeight: 400,
        color: "#E7E2F2",
        animDelay: 0.15,
      }),
      newShapeLayer({
        name: "Botão",
        x: left,
        y: Math.round(height * 0.72),
        w: Math.round(width * 0.62),
        h: Math.round(height * 0.075),
        radius: 999,
        fill: accent,
        anim: "pop",
        animDelay: 0.2,
      }),
      newTextLayer({
        name: "Botão texto",
        x: left,
        y: Math.round(height * 0.72 + height * 0.019),
        w: Math.round(width * 0.62),
        h: Math.round(height * 0.045),
        text: "Quero garantir minha vaga",
        fontSize: Math.round(unit * 0.036),
        fontWeight: 700,
        align: "center",
        color: "#170B03",
        animDelay: 0.25,
      }),
    ];
  }

  // cta
  return [
    newTextLayer({
      name: "Chamada",
      x: left,
      y: Math.round(height * 0.34),
      w: contentWidth,
      h: Math.round(height * 0.22),
      text: "Qual é o seu próximo passo?",
      fontSize: Math.round(titleSize * 0.76),
      align: "center",
    }),
    newShapeLayer({
      name: "Botão",
      x: Math.round(width / 2 - width * 0.21),
      y: Math.round(height * 0.62),
      w: Math.round(width * 0.42),
      h: Math.round(unit * 0.085),
      radius: 999,
      fill: accent,
      anim: "pop",
      animDelay: 0.15,
    }),
    newTextLayer({
      name: "Botão texto",
      x: Math.round(width / 2 - width * 0.21),
      y: Math.round(height * 0.62 + unit * 0.022),
      w: Math.round(width * 0.42),
      h: Math.round(unit * 0.05),
      text: "Responder na aula",
      fontSize: Math.round(unit * 0.034),
      fontWeight: 600,
      align: "center",
      color: "#0B0B10",
      animDelay: 0.2,
    }),
  ];
}

export function sceneStartTimes(project: Project): number[] {
  const starts: number[] = [];
  let acc = 0;
  for (const scene of project.scenes) {
    starts.push(acc);
    acc += scene.duration;
  }
  return starts;
}
