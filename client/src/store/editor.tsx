import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  CaptionSettings,
  FormatPresetId,
  Layer,
  LayerKind,
  MediaAsset,
  Narration,
  Project,
  ProjectKind,
  Scene,
  SceneBackground,
  SceneTransition,
} from "@shared/editor";
import {
  buildTemplateLayers,
  createProject,
  createStarterProject,
  formatPreset,
  newAvatarLayer,
  newImageLayer,
  newScene,
  newShapeLayer,
  newTextLayer,
  newVideoLayer,
  narrationLength,
  SCENE_TEMPLATES,
  SCENARIOS,
  totalDuration,
  uid,
  type SceneTemplateId,
  type ScenarioId,
} from "@shared/editor";
import { generateAiImage, generateNarration, transcribe } from "@/lib/api";
import { estimateWordTimings } from "@/lib/timing";
import { importFiles } from "@/lib/mediaImport";
import { deleteProject, getProject, saveProject } from "@/lib/storage";
import { TimelinePlayer, decodeNarration } from "@/engine/audio";
import { mediaRegistry } from "@/engine/media";

export type SaveState = "saved" | "saving" | "error";

export interface EditorApi {
  project: Project | null;
  loading: boolean;
  saveState: SaveState;
  sceneIndex: number;
  scene: Scene | null;
  selectedLayerId: string | null;
  selectedLayer: Layer | null;
  playing: boolean;
  canUndo: boolean;
  canRedo: boolean;
  setSceneIndex: (index: number) => void;
  selectLayer: (id: string | null) => void;
  apply: (
    mutator: (draft: Project) => void,
    options?: { history?: boolean; coalesceKey?: string }
  ) => void;
  undo: () => void;
  redo: () => void;
  getTime: () => number;
  seek: (time: number) => void;
  play: () => Promise<void>;
  pause: () => void;
  togglePlay: () => void;
  totalDuration: number;
  setFormat: (id: FormatPresetId) => void;
  updateScene: (patch: Partial<Scene>) => void;
  applyTemplate: (templateId: SceneTemplateId) => void;
  updateBackground: (patch: Partial<SceneBackground>) => void;
  updateTransition: (patch: Partial<SceneTransition>) => void;
  updateCaptions: (patch: Partial<CaptionSettings>) => void;
  addLayer: (kind: LayerKind, mediaId?: string) => void;
  updateLayer: (
    id: string,
    patch: Partial<Layer>,
    options?: { history?: boolean; coalesceKey?: string }
  ) => void;
  deleteLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  moveLayerOrder: (id: string, direction: -1 | 1) => void;
  addScene: () => void;
  duplicateScene: () => void;
  splitScene: () => void;
  deleteScene: () => void;
  moveScene: (from: number, to: number) => void;
  updateNarration: (
    patch: Partial<Narration>,
    options?: { coalesceKey?: string }
  ) => void;
  generateVoice: () => Promise<void>;
  attachNarrationAudio: (blob: Blob, source: "mic" | "upload") => Promise<void>;
  transcribeScene: () => Promise<void>;
  applyEstimatedCaptions: () => void;
  importMediaFiles: (files: File[]) => Promise<MediaAsset[]>;
  generateImage: (prompt: string) => Promise<void>;
  addRecordedVideo: (
    blob: Blob,
    mode?: "layer" | "background"
  ) => Promise<void>;
  applyScenario: (scenarioId: ScenarioId) => Promise<void>;
  generatePortrait: (description: string) => Promise<void>;
  removeMedia: (id: string) => Promise<void>;
  voiceBusy: boolean;
  voiceStatus: string | null;
  renameProject: (name: string) => void;
  deleteCurrentProject: () => Promise<void>;
}

const EditorContext = createContext<EditorApi | null>(null);

export function useEditorContext(): EditorApi {
  const value = useContext(EditorContext);
  if (!value)
    throw new Error("useEditorContext deve ser usado dentro do EditorProvider");
  return value;
}

export function EditorProvider({
  value,
  children,
}: {
  value: EditorApi;
  children: ReactNode;
}) {
  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
}

export function useEditor(projectId: string | null): EditorApi {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [sceneIndex, setSceneIndexState] = useState(0);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);

  const projectRef = useRef<Project | null>(null);
  const timeRef = useRef(0);
  const playingRef = useRef(false);
  const playerRef = useRef<TimelinePlayer | null>(null);
  const deletingRef = useRef<string | null>(null);
  const historyRef = useRef<{ past: Project[]; future: Project[] }>({
    past: [],
    future: [],
  });
  const lastHistoryRef = useRef<{ key: string; at: number } | null>(null);

  projectRef.current = project;

  const getPlayer = useCallback((): TimelinePlayer => {
    if (!playerRef.current) playerRef.current = new TimelinePlayer();
    return playerRef.current;
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    // Never let an undo/redo from the previous project leak into this one.
    historyRef.current = { past: [], future: [] };
    lastHistoryRef.current = null;
    deletingRef.current = null;
    setHistoryVersion(version => version + 1);
    setProject(null);
    setSceneIndexState(0);
    setSelectedLayerId(null);
    timeRef.current = 0;
    playingRef.current = false;
    playerRef.current?.stop();
    setPlaying(false);

    (async () => {
      if (!projectId) {
        setLoading(false);
        return;
      }
      const found = await getProject(projectId);
      if (!alive) return;
      setProject(found ?? null);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [projectId]);

  // Keep media elements ready for the canvas. Face landmarks are expensive, so
  // they are only loaded for assets actually used by a photo avatar.
  useEffect(() => {
    if (!project) return;
    void mediaRegistry.ensureAll(project.media);
    const avatarPhotoIds = new Set<string>();
    project.scenes.forEach(scene => {
      scene.layers.forEach(layer => {
        if (
          layer.kind === "avatar" &&
          layer.mode === "photo" &&
          layer.photoMediaId
        ) {
          avatarPhotoIds.add(layer.photoMediaId);
        }
      });
    });
    avatarPhotoIds.forEach(id => {
      const asset = project.media.find(item => item.id === id);
      if (asset) void mediaRegistry.ensure(asset, { face: true });
    });
  }, [project]);

  // Debounced autosave.
  useEffect(() => {
    if (!project) return;
    setSaveState("saving");
    const timer = window.setTimeout(async () => {
      if (deletingRef.current === project.id) return;
      try {
        await saveProject(project);
        setSaveState("saved");
      } catch (error) {
        console.error("[save]", error);
        setSaveState("error");
      }
    }, 550);
    return () => window.clearTimeout(timer);
  }, [project]);

  // Flush the pending debounce when the tab is hidden or closed. IndexedDB may
  // finish the write in the background; this avoids losing the last keystroke.
  useEffect(() => {
    const flush = () => {
      const current = projectRef.current;
      if (!current || deletingRef.current === current.id) return;
      void saveProject(current).catch(error => {
        console.error("[save:flush]", error);
      });
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const apply = useCallback(
    (
      mutator: (draft: Project) => void,
      options?: { history?: boolean; coalesceKey?: string },
    ) => {
      setProject(previous => {
        if (!previous) return previous;
        const draft = structuredClone(previous) as Project;
        mutator(draft);
        draft.updatedAt = Date.now();
        if (options?.history !== false) {
          const now = Date.now();
          const key = options?.coalesceKey;
          const canCoalesce =
            Boolean(key) &&
            lastHistoryRef.current?.key === key &&
            now - (lastHistoryRef.current?.at ?? 0) < 800;

          if (!canCoalesce) {
            historyRef.current.past.push(previous);
            if (historyRef.current.past.length > 40) {
              historyRef.current.past.shift();
            }
          }
          historyRef.current.future = [];
          lastHistoryRef.current = key ? { key, at: now } : null;
          setHistoryVersion(version => version + 1);
        }
        return draft;
      });
    },
    [],
  );

  const undo = useCallback(() => {
    const previous = historyRef.current.past.pop();
    if (!previous) return;
    lastHistoryRef.current = null;
    setProject(current => {
      if (current) historyRef.current.future.push(current);
      return previous;
    });
    setHistoryVersion(version => version + 1);
  }, []);

  const redo = useCallback(() => {
    const next = historyRef.current.future.pop();
    if (!next) return;
    lastHistoryRef.current = null;
    setProject(current => {
      if (current) historyRef.current.past.push(current);
      return next;
    });
    setHistoryVersion(version => version + 1);
  }, []);

  const scene = project?.scenes[sceneIndex] ?? null;
  const selectedLayer =
    scene?.layers.find(layer => layer.id === selectedLayerId) ?? null;

  const setSceneIndex = useCallback((index: number) => {
    setSceneIndexState(index);
    setSelectedLayerId(null);
  }, []);

  const getTime = useCallback(() => {
    if (playingRef.current && playerRef.current) return playerRef.current.time;
    return timeRef.current;
  }, []);

  const seek = useCallback((time: number) => {
    const total = projectRef.current ? totalDuration(projectRef.current) : 0;
    const clamped = Math.max(0, Math.min(total, time));
    if (playingRef.current) {
      playerRef.current?.stop();
      playingRef.current = false;
      setPlaying(false);
    }
    timeRef.current = clamped;
  }, []);

  const play = useCallback(async () => {
    const current = projectRef.current;
    if (!current) return;
    const player = getPlayer();
    const total = totalDuration(current);
    let from = timeRef.current;
    if (from >= total - 0.08) from = 0;
    await player.prepare(current);
    playingRef.current = true;
    setPlaying(true);
    await player.play(current, {
      from,
      onEnded: () => {
        playingRef.current = false;
        setPlaying(false);
        timeRef.current = total;
      },
    });
  }, [getPlayer]);

  const pause = useCallback(() => {
    if (playerRef.current && playingRef.current) {
      timeRef.current = playerRef.current.time;
      playerRef.current.stop();
    }
    playingRef.current = false;
    setPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (playingRef.current) pause();
    else void play();
  }, [pause, play]);

  const updateScene = useCallback(
    (patch: Partial<Scene>) => {
      apply(draft => {
        const target = draft.scenes[sceneIndex];
        if (target) Object.assign(target, patch);
      });
    },
    [apply, sceneIndex]
  );

  const updateBackground = useCallback(
    (patch: Partial<SceneBackground>) => {
      apply(draft => {
        const target = draft.scenes[sceneIndex];
        if (target) Object.assign(target.background, patch);
      });
    },
    [apply, sceneIndex]
  );

  const updateTransition = useCallback(
    (patch: Partial<SceneTransition>) => {
      apply(draft => {
        const target = draft.scenes[sceneIndex];
        if (target) Object.assign(target.transition, patch);
      });
    },
    [apply, sceneIndex]
  );

  const applyTemplate = useCallback(
    (templateId: SceneTemplateId) => {
      const current = projectRef.current;
      if (!current) return;
      const layers = buildTemplateLayers(
        templateId,
        current.width,
        current.height,
        current.theme.accent
      );
      const template = SCENE_TEMPLATES.find(item => item.id === templateId);
      apply(draft => {
        const target = draft.scenes[sceneIndex];
        if (!target) return;
        target.layers = layers;
        if (template) target.name = template.label;
      });
      setSelectedLayerId(null);
    },
    [apply, sceneIndex]
  );

  const updateCaptions = useCallback(
    (patch: Partial<CaptionSettings>) => {
      apply(draft => {
        Object.assign(draft.captions, patch);
      });
    },
    [apply]
  );

  const addLayer = useCallback(
    (kind: LayerKind, mediaId?: string) => {
      const current = projectRef.current;
      const activeScene = current?.scenes[sceneIndex];
      if (!current || !activeScene) return;
      const cx = current.width / 2;
      const cy = current.height / 2;
      let layer: Layer | null = null;

      if (kind === "text") {
        layer = newTextLayer({
          x: Math.round(cx - current.width * 0.34),
          y: Math.round(cy - 110),
          w: Math.round(current.width * 0.68),
          h: 220,
          fontSize: Math.round(current.width * 0.05),
          text: "Novo texto",
        });
      } else if (kind === "shape") {
        layer = newShapeLayer({
          x: Math.round(cx - 160),
          y: Math.round(cy - 6),
          w: 320,
          h: 12,
        });
      } else if (kind === "avatar") {
        layer = newAvatarLayer({
          x: Math.round(current.width - current.width * 0.26),
          y: Math.round(current.height - current.height * 0.46),
          w: Math.round(current.width * 0.22),
          h: Math.round(current.width * 0.22),
        });
      } else if (kind === "image" || kind === "video") {
        const asset =
          current.media.find(item => item.id === mediaId) ??
          current.media.find(item => item.kind === kind);
        if (!asset) return;
        const targetW = Math.round(current.width * 0.4);
        const ratio =
          asset.width && asset.height ? asset.height / asset.width : 0.66;
        layer =
          kind === "image"
            ? newImageLayer(asset.id, {
                x: Math.round(current.width - targetW - current.width * 0.06),
                y: Math.round(cy - (targetW * ratio) / 2),
                w: targetW,
                h: Math.round(targetW * ratio),
              })
            : newVideoLayer(asset.id, {
                x: Math.round(cx - targetW / 2),
                y: Math.round(cy - (targetW * ratio) / 2),
                w: targetW,
                h: Math.round(targetW * ratio),
              });
      }

      if (!layer) return;
      apply(draft => {
        draft.scenes[sceneIndex]?.layers.push(layer as Layer);
      });
      setSelectedLayerId(layer.id);
    },
    [apply, sceneIndex]
  );

  const updateLayer = useCallback(
    (
      id: string,
      patch: Partial<Layer>,
      options?: { history?: boolean; coalesceKey?: string },
    ) => {
      const coalesceKey =
        options?.coalesceKey ??
        ("text" in patch && Object.keys(patch).length === 1
          ? `layer:${sceneIndex}:${id}:text`
          : undefined);
      apply(
        draft => {
          const target = draft.scenes[sceneIndex]?.layers.find(
            layer => layer.id === id,
          );
          if (target) Object.assign(target, patch);
        },
        { ...options, coalesceKey },
      );
    },
    [apply, sceneIndex],
  );

  const deleteLayer = useCallback(
    (id: string) => {
      apply(draft => {
        const target = draft.scenes[sceneIndex];
        if (!target) return;
        target.layers = target.layers.filter(layer => layer.id !== id);
      });
      setSelectedLayerId(null);
    },
    [apply, sceneIndex]
  );

  const duplicateLayer = useCallback(
    (id: string) => {
      const layer = projectRef.current?.scenes[sceneIndex]?.layers.find(
        item => item.id === id
      );
      if (!layer) return;
      const copy = {
        ...structuredClone(layer),
        id: uid("layer"),
        x: layer.x + 32,
        y: layer.y + 32,
      };
      apply(draft => {
        draft.scenes[sceneIndex]?.layers.push(copy);
      });
      setSelectedLayerId(copy.id);
    },
    [apply, sceneIndex]
  );

  const moveLayerOrder = useCallback(
    (id: string, direction: -1 | 1) => {
      apply(draft => {
        const layers = draft.scenes[sceneIndex]?.layers;
        if (!layers) return;
        const index = layers.findIndex(layer => layer.id === id);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= layers.length) return;
        const [item] = layers.splice(index, 1);
        layers.splice(target, 0, item);
      });
    },
    [apply, sceneIndex]
  );

  const addScene = useCallback(() => {
    const created = newScene({
      name: `Cena ${(projectRef.current?.scenes.length ?? 0) + 1}`,
    });
    apply(draft => {
      draft.scenes.splice(sceneIndex + 1, 0, created);
    });
    setSceneIndexState(sceneIndex + 1);
    setSelectedLayerId(null);
  }, [apply, sceneIndex]);

  const duplicateScene = useCallback(() => {
    const source = projectRef.current?.scenes[sceneIndex];
    if (!source) return;
    const copy = structuredClone(source);
    copy.id = uid("scene");
    copy.name = `${source.name} (cópia)`;
    copy.layers = copy.layers.map(layer => ({ ...layer, id: uid("layer") }));
    apply(draft => {
      draft.scenes.splice(sceneIndex + 1, 0, copy);
    });
    setSceneIndexState(sceneIndex + 1);
  }, [apply, sceneIndex]);

  const splitScene = useCallback(() => {
    const current = projectRef.current;
    const source = current?.scenes[sceneIndex];
    if (!current || !source) return;
    const starts = current.scenes
      .slice(0, sceneIndex)
      .reduce((sum, item) => sum + item.duration, 0);
    const cut = Math.max(
      0.5,
      Math.min(source.duration - 0.5, getTime() - starts),
    );
    if (cut <= 0.5 || cut >= source.duration - 0.5) return;

    const sourceOffset = Math.max(0, source.narration.offset ?? 0);
    const sourceAudioDuration =
      source.narration.duration ?? Math.max(0, source.duration - sourceOffset);
    const firstAudioDuration = Math.max(
      0,
      Math.min(cut, sourceAudioDuration - sourceOffset),
    );
    const secondOffset = sourceOffset + cut;
    const secondAudioDuration = Math.max(
      0,
      sourceAudioDuration - secondOffset,
    );

    const words = source.narration.words;
    const firstWords = words?.filter(word => word.start < cut);
    const secondWords = words?.filter(word => word.end > cut);

    const first = structuredClone(source);
    first.duration = Number(cut.toFixed(2));
    first.narration.offset = sourceOffset;
    if (words) {
      first.narration.words = firstWords?.map(word => ({
        ...word,
        end: Math.min(cut, word.end),
      }));
      if (firstWords && firstWords.length > 0) {
        first.narration.text = firstWords.map(word => word.word).join(" ");
      }
    }
    if (firstAudioDuration <= 0) {
      first.narration.assetId = undefined;
      first.narration.words = undefined;
      first.narration.source = undefined;
    }

    const second = structuredClone(source);
    second.id = uid("scene");
    second.name = `${source.name} (parte 2)`;
    second.duration = Number((source.duration - cut).toFixed(2));
    second.layers = second.layers.map(layer => {
      const copy = { ...layer, id: uid("layer") };
      if (copy.kind === "video") {
        copy.startAt = Math.max(0, copy.startAt + cut);
      }
      return copy;
    });
    if (second.background.type === "video") {
      second.background = {
        ...second.background,
        startAt: (second.background.startAt ?? 0) + cut,
      };
    }
    second.narration.offset = secondOffset;
    if (words) {
      second.narration.words = secondWords?.map(word => ({
        ...word,
        start: Math.max(0, word.start - cut),
        end: Math.max(0, word.end - cut),
      }));
      if (secondWords && secondWords.length > 0) {
        second.narration.text = secondWords.map(word => word.word).join(" ");
      }
    }
    if (secondAudioDuration <= 0) {
      second.narration.assetId = undefined;
      second.narration.words = undefined;
      second.narration.source = undefined;
    }

    apply(draft => {
      draft.scenes.splice(sceneIndex, 1, first, second);
    });
  }, [apply, getTime, sceneIndex]);

  const deleteScene = useCallback(() => {
    if ((projectRef.current?.scenes.length ?? 0) <= 1) return;
    apply(draft => {
      draft.scenes.splice(sceneIndex, 1);
    });
    setSceneIndexState(Math.max(0, sceneIndex - 1));
    setSelectedLayerId(null);
  }, [apply, sceneIndex]);

  const moveScene = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      apply(draft => {
        if (from < 0 || from >= draft.scenes.length) return;
        const [item] = draft.scenes.splice(from, 1);
        draft.scenes.splice(
          Math.max(0, Math.min(draft.scenes.length, to)),
          0,
          item
        );
      });
      setSceneIndexState(
        Math.max(0, Math.min((projectRef.current?.scenes.length ?? 1) - 1, to))
      );
    },
    [apply]
  );

  const updateNarration = useCallback(
    (patch: Partial<Narration>, options?: { coalesceKey?: string }) => {
      const coalesceKey =
        options?.coalesceKey ??
        (Object.keys(patch).length === 1 && "text" in patch
          ? `narration:${sceneIndex}:text`
          : undefined);
      apply(
        draft => {
          const target = draft.scenes[sceneIndex];
          if (target) Object.assign(target.narration, patch);
        },
        { coalesceKey },
      );
    },
    [apply, sceneIndex],
  );

  const attachAudio = useCallback(
    async (blob: Blob, name: string) => {
      const current = projectRef.current;
      if (!current) return;
      const file = new File([blob], name, { type: blob.type || "audio/mpeg" });
      const [asset] = await importFiles([file]);
      if (!asset)
        throw new Error("Não foi possível salvar o áudio da narração.");
      const buffer = await decodeNarration(asset.id);
      const duration = buffer?.duration ?? 0;

      apply(draft => {
        draft.media.push(asset);
        const target = draft.scenes[sceneIndex];
        if (!target) return;
        target.narration.assetId = asset.id;
        target.narration.offset = 0;
        target.narration.duration = duration;
        target.narration.words = undefined;
        if (duration > target.duration - 0.1) {
          target.duration = Number((duration + 0.6).toFixed(2));
        }
      });
    },
    [apply, sceneIndex]
  );

  const generateVoice = useCallback(async () => {
    const current = projectRef.current;
    const target = current?.scenes[sceneIndex];
    if (!current || !target) return;
    if (!target.narration.text.trim()) {
      setVoiceStatus("Escreva o roteiro da cena antes de gerar a narração.");
      return;
    }
    setVoiceBusy(true);
    setVoiceStatus("Gerando narração…");
    try {
      const blob = await generateNarration({
        text: target.narration.text,
        voiceId: target.narration.voiceId,
        rate: target.narration.rate,
        pitch: target.narration.pitch,
      });
      await attachAudio(blob, `narracao-${Date.now()}.mp3`);
      apply(
        draft => {
          const sceneTarget = draft.scenes[sceneIndex];
          if (sceneTarget) sceneTarget.narration.source = "tts";
        },
        { history: false }
      );
      setVoiceStatus("Narração pronta. Dá para ouvir na prévia.");
    } catch (error) {
      setVoiceStatus((error as Error).message);
    } finally {
      setVoiceBusy(false);
    }
  }, [apply, attachAudio, sceneIndex]);

  const attachNarrationAudio = useCallback(
    async (blob: Blob, source: "mic" | "upload") => {
      setVoiceBusy(true);
      setVoiceStatus(
        source === "mic" ? "Salvando gravação…" : "Importando áudio…"
      );
      try {
        const extension = blob.type.includes("wav")
          ? "wav"
          : blob.type.includes("webm")
            ? "webm"
            : "mp3";
        await attachAudio(
          blob,
          `narracao-${source}-${Date.now()}.${extension}`
        );
        apply(
          draft => {
            const sceneTarget = draft.scenes[sceneIndex];
            if (sceneTarget) sceneTarget.narration.source = source;
          },
          { history: false }
        );
        setVoiceStatus("Áudio da cena atualizado.");
      } catch (error) {
        setVoiceStatus((error as Error).message);
      } finally {
        setVoiceBusy(false);
      }
    },
    [apply, attachAudio, sceneIndex]
  );

  const transcribeScene = useCallback(async () => {
    const target = projectRef.current?.scenes[sceneIndex];
    const assetId = target?.narration.assetId;
    if (!assetId) {
      setVoiceStatus("Gere ou grave a narração desta cena antes das legendas.");
      return;
    }
    setVoiceBusy(true);
    setVoiceStatus("Ouvindo a narração para montar as legendas…");
    try {
      const blob = await mediaRegistry.blob(assetId);
      if (!blob) throw new Error("Áudio da cena não encontrado.");
      const result = await transcribe(blob);
      apply(draft => {
        const sceneTarget = draft.scenes[sceneIndex];
        if (!sceneTarget) return;
        sceneTarget.narration.words = result.words;
        if (!sceneTarget.narration.text.trim() && result.text) {
          sceneTarget.narration.text = result.text;
        }
        draft.captions.enabled = true;
      });
      setVoiceStatus(
        result.words.length > 0
          ? `Legendas criadas com ${result.words.length} palavras sincronizadas.`
          : "Transcrição concluída, mas sem marcação de tempo por palavra."
      );
    } catch (error) {
      setVoiceStatus((error as Error).message);
    } finally {
      setVoiceBusy(false);
    }
  }, [apply, sceneIndex]);

  const applyEstimatedCaptions = useCallback(() => {
    const target = projectRef.current?.scenes[sceneIndex];
    if (!target) return;
    const text = target.narration.text.trim();
    const duration =
      narrationLength(target.narration) || target.duration;
    if (!text || duration <= 0) {
      setVoiceStatus(
        "Escreva o roteiro ou gere a narração antes das legendas."
      );
      return;
    }
    const words = estimateWordTimings(text, duration);
    apply(draft => {
      const sceneTarget = draft.scenes[sceneIndex];
      if (!sceneTarget) return;
      sceneTarget.narration.words = words;
      draft.captions.enabled = true;
    });
    setVoiceStatus(
      `Legendas sincronizadas por tempo, sem custo (${words.length} palavras).`
    );
  }, [apply, sceneIndex]);

  const importMediaFiles = useCallback(
    async (files: File[]) => {
      const assets = await importFiles(files);
      if (assets.length > 0) {
        apply(draft => {
          draft.media.push(...assets);
        });
        await mediaRegistry.ensureAll(assets);
      }
      return assets;
    },
    [apply]
  );

  const generateImage = useCallback(
    async (prompt: string) => {
      setVoiceBusy(true);
      setVoiceStatus("Gerando imagem com IA…");
      try {
        const { blob, mime } = await generateAiImage(prompt);
        const extension = mime.includes("jpeg") ? "jpg" : "png";
        const file = new File([blob], `ia-${Date.now()}.${extension}`, {
          type: mime,
        });
        const [asset] = await importFiles([file]);
        if (!asset) throw new Error("Imagem gerada não pôde ser importada.");
        apply(draft => {
          draft.media.push(asset);
        });
        await mediaRegistry.ensure(asset);
        setVoiceStatus("Imagem gerada e adicionada à biblioteca.");
      } catch (error) {
        setVoiceStatus((error as Error).message);
      } finally {
        setVoiceBusy(false);
      }
    },
    [apply]
  );

  const addRecordedVideo = useCallback(
    async (blob: Blob, mode: "layer" | "background" = "layer") => {
      setVoiceBusy(true);
      setVoiceStatus("Salvando gravação…");
      try {
        const extension = blob.type.includes("mp4") ? "mp4" : "webm";
        const file = new File([blob], `gravacao-${Date.now()}.${extension}`, {
          type: blob.type || "video/webm",
        });
        const [asset] = await importFiles([file]);
        if (!asset) throw new Error("A gravação não pôde ser importada.");
        apply(draft => {
          draft.media.push(asset);
          const target = draft.scenes[sceneIndex];
          if (!target) return;
          if (mode === "background") {
            target.background = {
              type: "video",
              color: "#0B0B10",
              color2: "#14141B",
              angle: 0,
              mediaId: asset.id,
              dim: 0,
              blur: 0,
              kenBurns: "none",
            };
          } else {
            target.layers.push(
              newVideoLayer(asset.id, {
                name: "Gravação",
                x: 0,
                y: 0,
                w: draft.width,
                h: draft.height,
                fit: "cover",
                radius: 0,
              })
            );
          }
        });
        await mediaRegistry.ensure(asset);
        setVoiceStatus(
          mode === "background"
            ? "Gravação aplicada como fundo da cena."
            : "Gravação inserida na cena."
        );
      } catch (error) {
        setVoiceStatus((error as Error).message);
      } finally {
        setVoiceBusy(false);
      }
    },
    [apply, sceneIndex]
  );

  const applyScenario = useCallback(
    async (scenarioId: ScenarioId) => {
      const scenario = SCENARIOS.find(item => item.id === scenarioId);
      if (!scenario) return;
      setVoiceBusy(true);
      setVoiceStatus(`Gerando cenário ${scenario.label}…`);
      try {
        const { blob, mime } = await generateAiImage(scenario.prompt);
        const extension = mime.includes("jpeg") ? "jpg" : "png";
        const file = new File(
          [blob],
          `cenario-${scenario.id}-${Date.now()}.${extension}`,
          {
            type: mime || "image/png",
          }
        );
        const [asset] = await importFiles([file]);
        if (!asset) throw new Error("O cenário gerado não pôde ser importado.");
        apply(draft => {
          draft.media.push(asset);
          const target = draft.scenes[sceneIndex];
          if (!target) return;
          target.background = {
            type: "image",
            color: "#0B0B10",
            color2: "#14141B",
            angle: 0,
            mediaId: asset.id,
            dim: 0.3,
            blur: 0,
            kenBurns: "in",
          };
        });
        await mediaRegistry.ensure(asset);
        setVoiceStatus(`Cenário ${scenario.label} aplicado com movimento.`);
      } catch (error) {
        setVoiceStatus((error as Error).message);
      } finally {
        setVoiceBusy(false);
      }
    },
    [apply, sceneIndex]
  );

  const generatePortrait = useCallback(
    async (description: string) => {
      setVoiceBusy(true);
      setVoiceStatus("Gerando retrato realista…");
      try {
        const subject =
          description.trim() || "a friendly Brazilian presenter, 35 years old";
        const prompt = `photorealistic professional headshot portrait of ${subject}, head and shoulders, looking at the camera, neutral soft studio background, natural skin texture, 50mm lens, soft key light, high detail`;
        const { blob, mime } = await generateAiImage(prompt);
        const extension = mime.includes("jpeg") ? "jpg" : "png";
        const file = new File([blob], `retrato-${Date.now()}.${extension}`, {
          type: mime || "image/png",
        });
        const [asset] = await importFiles([file]);
        if (!asset) throw new Error("O retrato gerado não pôde ser importado.");
        apply(draft => {
          draft.media.push(asset);
          const target = draft.scenes[sceneIndex];
          if (!target) return;
          const avatar = target.layers.find(
            layer =>
              layer.kind === "avatar" &&
              (!selectedLayerId || layer.id === selectedLayerId)
          );
          if (avatar && avatar.kind === "avatar") {
            avatar.mode = "photo";
            avatar.photoMediaId = asset.id;
          } else {
            target.layers.push(
              newAvatarLayer({
                x: Math.round(draft.width - draft.width * 0.26),
                y: Math.round(draft.height - draft.height * 0.46),
                w: Math.round(draft.width * 0.22),
                h: Math.round(draft.width * 0.22),
                mode: "photo",
                photoMediaId: asset.id,
              })
            );
          }
        });
        await mediaRegistry.ensure(asset, { face: true });
        setVoiceStatus("Retrato realista aplicado ao avatar.");
      } catch (error) {
        setVoiceStatus((error as Error).message);
      } finally {
        setVoiceBusy(false);
      }
    },
    [apply, sceneIndex, selectedLayerId]
  );

  const removeMedia = useCallback(
    async (id: string) => {
      apply(draft => {
        draft.media = draft.media.filter(asset => asset.id !== id);
        draft.scenes.forEach(sceneItem => {
          sceneItem.layers = sceneItem.layers.filter(
            layer =>
              !("mediaId" in layer && layer.mediaId === id) &&
              !(layer.kind === "avatar" && layer.photoMediaId === id)
          );
          if (sceneItem.background.mediaId === id) {
            sceneItem.background.mediaId = undefined;
            sceneItem.background.type = "gradient";
          }
          if (sceneItem.narration.assetId === id) {
            sceneItem.narration.assetId = undefined;
            sceneItem.narration.words = undefined;
          }
        });
      });
      // Keep the blob for now: removing an asset is undoable, and another
      // duplicated project may still reference it. Orphan blobs are collected
      // at startup and when a project is deleted.
      mediaRegistry.forget(id);
    },
    [apply],
  );

  const setFormat = useCallback(
    (id: FormatPresetId) => {
      const preset = formatPreset(id);
      apply(draft => {
        const oldWidth = draft.width;
        const oldHeight = draft.height;
        const scaleX = preset.width / oldWidth;
        const scaleY = preset.height / oldHeight;
        draft.scenes.forEach(sceneItem => {
          sceneItem.layers = sceneItem.layers.map(layer => ({
            ...layer,
            x: Math.round(layer.x * scaleX),
            y: Math.round(layer.y * scaleY),
            w: Math.round(layer.w * scaleX),
            h: Math.round(layer.h * scaleY),
          }));
        });
        draft.captions.fontSize = Math.round(draft.captions.fontSize * scaleY);
        draft.captions.margin = Math.round(draft.captions.margin * scaleY);
        draft.format = preset.id;
        draft.width = preset.width;
        draft.height = preset.height;
      });
    },
    [apply]
  );

  const renameProject = useCallback(
    (name: string) => {
      apply(
        draft => {
          draft.name = name;
        },
        { coalesceKey: "project:name" },
      );
    },
    [apply],
  );

  const deleteCurrentProject = useCallback(async () => {
    const current = projectRef.current;
    if (!current) return;
    deletingRef.current = current.id;
    await deleteProject(current.id);
  }, []);

  return useMemo<EditorApi>(
    () => ({
      project,
      loading,
      saveState,
      sceneIndex,
      scene,
      selectedLayerId,
      selectedLayer,
      playing,
      canUndo: historyRef.current.past.length > 0,
      canRedo: historyRef.current.future.length > 0,
      setSceneIndex,
      selectLayer: setSelectedLayerId,
      apply,
      undo,
      redo,
      getTime,
      seek,
      play,
      pause,
      togglePlay,
      totalDuration: project ? totalDuration(project) : 0,
      setFormat,
      updateScene,
      applyTemplate,
      updateBackground,
      updateTransition,
      updateCaptions,
      addLayer,
      updateLayer,
      deleteLayer,
      duplicateLayer,
      moveLayerOrder,
      addScene,
      duplicateScene,
      splitScene,
      deleteScene,
      moveScene,
      updateNarration,
      generateVoice,
      attachNarrationAudio,
      transcribeScene,
      applyEstimatedCaptions,
      importMediaFiles,
      generateImage,
      addRecordedVideo,
      applyScenario,
      generatePortrait,
      removeMedia,
      voiceBusy,
      voiceStatus,
      renameProject,
      deleteCurrentProject,
    }),
    [
      project,
      loading,
      saveState,
      sceneIndex,
      scene,
      selectedLayerId,
      selectedLayer,
      playing,
      historyVersion,
      setSceneIndex,
      apply,
      undo,
      redo,
      getTime,
      seek,
      play,
      pause,
      togglePlay,
      setFormat,
      updateScene,
      applyTemplate,
      updateBackground,
      updateTransition,
      updateCaptions,
      addLayer,
      updateLayer,
      deleteLayer,
      duplicateLayer,
      moveLayerOrder,
      addScene,
      duplicateScene,
      splitScene,
      deleteScene,
      moveScene,
      updateNarration,
      generateVoice,
      attachNarrationAudio,
      transcribeScene,
      applyEstimatedCaptions,
      importMediaFiles,
      generateImage,
      addRecordedVideo,
      applyScenario,
      generatePortrait,
      removeMedia,
      voiceBusy,
      voiceStatus,
      renameProject,
      deleteCurrentProject,
    ]
  );
}

export function createProjectDraft(
  name: string,
  kind: ProjectKind = "aula"
): Project {
  return createProject(kind, name);
}
