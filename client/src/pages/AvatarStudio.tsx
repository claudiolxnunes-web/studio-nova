import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Check,
  Clapperboard,
  Download,
  ImagePlus,
  Loader2,
  Play,
  Settings2,
  Sparkles,
  Square,
  Upload,
  Volume2,
  Wand2,
} from "lucide-react";
import { PT_VOICES } from "@shared/editor";
import {
  blobToDataUrl,
  createAvatarJob,
  fetchEngines,
  fetchHeygenLibrary,
  waitForAvatarJob,
  type AvatarConfigView,
  type EngineId,
  type EngineInfo,
} from "@/lib/avatarApi";
import { generateNarration } from "@/lib/api";
import { detectFaceBox } from "@/engine/media";
import { detectFaceAnchors, type FaceAnchors } from "@/engine/faceAnchors";
import { drawTalkingPortrait, type FaceBox } from "@/engine/portrait";
import { renderTalkingVideo } from "@/engine/talkingVideo";
import { estimateNarrationDuration, formatClock } from "@/lib/format";

interface Presenter {
  id: string;
  name: string;
  role: string;
  src: string;
  accent: string;
}

const PRESENTERS: Presenter[] = [
  { id: "ana", name: "Ana", role: "Apresentadora · próxima", src: "/avatars/ana.jpg", accent: "#FF7A1A" },
  { id: "bruno", name: "Bruno", role: "Consultor · firme", src: "/avatars/bruno.jpg", accent: "#2C6E6B" },
  { id: "carla", name: "Carla", role: "Social media · leve", src: "/avatars/carla.jpg", accent: "#6C5CE7" },
  { id: "diego", name: "Diego", role: "Professor · sênior", src: "/avatars/diego.jpg", accent: "#2E86DE" },
  { id: "elisa", name: "Elisa", role: "Executiva · sóbria", src: "/avatars/elisa.jpg", accent: "#C0563F" },
  { id: "fabio", name: "Fábio", role: "Criador · jovem", src: "/avatars/fabio.jpg", accent: "#1F9D74" },
];

const ASPECTS = [
  { id: "1:1", label: "Quadrado", hint: "Feed e avatar" },
  { id: "9:16", label: "Vertical", hint: "Reels e Stories" },
  { id: "16:9", label: "Horizontal", hint: "Aulas e YouTube" },
] as const;

const DEFAULT_SCRIPT =
  "Olá! Eu sou a sua apresentadora no Studio Nova. A partir de hoje, você pode criar aulas, anúncios e posts com um apresentador de verdade — sem estúdio, sem câmera e sem gastar com gravação.";

type Busy = { label: string; progress: number } | null;

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Live preview: idles with a gentle mouth movement and follows the audio. */
function usePortraitPreview(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  imageUrl: string | null,
  face: FaceBox | null,
  anchors: FaceAnchors | null,
  audioUrl: string | null,
  accent: string,
) {
  const stateRef = useRef({ amplitude: 0 });

  useEffect(() => {
    if (!imageUrl) return;
    let raf = 0;
    let cancelled = false;
    let image: HTMLImageElement | null = null;
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let samples: Uint8Array<ArrayBuffer> | null = null;
    let startedAt = 0;

    const load = async () => {
      image = await new Promise<HTMLImageElement | null>(resolve => {
        const element = new Image();
        element.crossOrigin = "anonymous";
        element.onload = () => resolve(element);
        element.onerror = () => resolve(null);
        element.src = imageUrl;
      });
      if (!image || cancelled) return;

      if (audioUrl) {
        try {
          audioContext = new AudioContext();
          const buffer = await fetch(audioUrl)
            .then(response => response.arrayBuffer())
            .then(data => audioContext!.decodeAudioData(data));
          const source = audioContext.createBufferSource();
          source.buffer = buffer;
          analyser = audioContext.createAnalyser();
          analyser.fftSize = 1024;
          analyser.smoothingTimeConstant = 0.7;
          source.connect(analyser);
          analyser.connect(audioContext.destination);
          samples = new Uint8Array(new ArrayBuffer(analyser.fftSize));
          source.start();
          startedAt = audioContext.currentTime;
          source.onended = () => {
            stateRef.current.amplitude = 0;
          };
        } catch {
          analyser = null;
        }
      }

      const tick = () => {
        if (cancelled || !image || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const parent = canvas.parentElement;
        const size = Math.min(parent?.clientWidth ?? 360, parent?.clientHeight ?? 360);
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        if (canvas.width !== Math.round(size * dpr)) {
          canvas.width = Math.round(size * dpr);
          canvas.height = Math.round(size * dpr);
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const t = audioContext ? audioContext.currentTime - startedAt : performance.now() / 1000;

        if (analyser && samples) {
          analyser.getByteTimeDomainData(samples);
          let sum = 0;
          for (let index = 0; index < samples.length; index += 1) {
            const value = (samples[index] - 128) / 128;
            sum += value * value;
          }
          const target = Math.min(1, Math.pow(Math.sqrt(sum / samples.length) * 3.4, 0.8));
          stateRef.current.amplitude +=
            (target - stateRef.current.amplitude) * (target > stateRef.current.amplitude ? 0.5 : 0.15);
        } else {
          const idle = Math.max(0, Math.sin(t * 1.7) * 0.5 + Math.sin(t * 0.9) * 0.5 - 0.7) * 0.4;
          stateRef.current.amplitude = idle;
        }

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, size, size);
        drawTalkingPortrait(ctx, image, face ?? undefined, {
          x: 0,
          y: 0,
          width: size,
          height: size,
          radius: size / 2,
          time: t,
          amplitude: stateRef.current.amplitude,
          backdrop: true,
          anchors,
        });
        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = Math.max(2, size * 0.008);
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - ctx.lineWidth, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    void load();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      void audioContext?.close();
    };
  }, [imageUrl, face, anchors, audioUrl, accent, canvasRef]);
}

export default function AvatarStudio() {
  const [engines, setEngines] = useState<EngineInfo[]>([]);
  const [config, setConfig] = useState<AvatarConfigView | null>(null);
  const [engine, setEngine] = useState<EngineId>("portrait");
  const [selected, setSelected] = useState<string>(PRESENTERS[0].id);
  const [custom, setCustom] = useState<{ url: string; name: string } | null>(null);
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [voiceId, setVoiceId] = useState(PT_VOICES[0].id);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [aspect, setAspect] = useState<"16:9" | "9:16" | "1:1">("1:1");
  const [audio, setAudio] = useState<{ blob: Blob; url: string } | null>(null);
  const [face, setFace] = useState<FaceBox | null>(null);
  const [anchors, setAnchors] = useState<FaceAnchors | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; url: string; extension: string } | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);


  const activePresenter = useMemo(
    () => PRESENTERS.find(item => item.id === selected) ?? PRESENTERS[0],
    [selected],
  );
  const imageUrl = custom?.url ?? activePresenter.src;
  const accent = activePresenter.accent;

  useEffect(() => {
    void fetchEngines()
      .then(payload => {
        setEngines(payload.engines);
        setConfig(payload.config);
        setEngine(payload.config.defaultEngine ?? "portrait");
      })
      .catch(() => undefined);
  }, []);

  // Detect the face once per portrait so the mouth and eyes land in the right place.
  useEffect(() => {
    let alive = true;
    setFace(null);
    setAnchors(null);
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = async () => {
      const found = await detectFaceAnchors(image).catch(() => null);
      if (!alive) return;
      if (found) {
        setAnchors(found);
        setFace(found.face);
        return;
      }
      const box = await detectFaceBox(image);
      if (alive) setFace(box);
    };
    image.src = imageUrl;
    return () => {
      alive = false;
    };
  }, [imageUrl]);

  usePortraitPreview(
    canvasRef,
    imageUrl,
    face,
    anchors,
    audioPlaying ? audio?.url ?? null : null,
    accent,
  );

  const words = script.trim().split(/\s+/).filter(Boolean).length;
  const estimate = estimateNarrationDuration(script);

  const handleUpload = (file: File) => {
    const url = URL.createObjectURL(file);
    setCustom({ url, name: file.name.replace(/\.[^.]+$/, "") });
    setResult(null);
  };

  const ensureAudio = useCallback(async (): Promise<{ blob: Blob; url: string }> => {
    if (audio) return audio;
    if (!script.trim()) throw new Error("Escreva o roteiro antes de gerar a narração.");
    setBusy({ label: "Gerando a narração em português…", progress: 0.15 });
    const blob = await generateNarration({ text: script.trim(), voiceId, rate, pitch });
    const url = URL.createObjectURL(blob);
    const next = { blob, url };
    setAudio(next);
    return next;
  }, [audio, script, voiceId, rate, pitch]);

  const handleGenerateAudio = async () => {
    setError(null);
    setAudio(null);
    try {
      await ensureAudio();
      setBusy(null);
    } catch (problem) {
      setBusy(null);
      setError((problem as Error).message);
    }
  };

  const handleRender = async () => {
    setError(null);
    setResult(null);
    try {
      const narration = await ensureAudio();
      if (engine === "portrait") {
        setBusy({ label: "Renderizando no seu navegador…", progress: 0.05 });
        const rendered = await renderTalkingVideo({
          imageUrl,
          face: face ?? undefined,
          anchors,
          audio: narration.blob,
          aspect,
          fps: 30,
          accent,
          onProgress: (progress, message) => setBusy({ label: message, progress }),
        });
        setResult({
          blob: rendered.blob,
          url: URL.createObjectURL(rendered.blob),
          extension: rendered.extension,
        });
        setBusy(null);
        return;
      }

      // Paid engines: send the narration we already generated so the voice is
      // the same Brazilian voice the rest of the studio uses.
      setBusy({ label: "Enviando para o provedor…", progress: 0.05 });
      const audioDataUrl = await blobToDataUrl(narration.blob);
      let imageDataUrl: string | undefined;
      if (engine === "did") {
        const response = await fetch(imageUrl);
        imageDataUrl = await blobToDataUrl(await response.blob());
      }
      const job = await createAvatarJob({
        engine,
        script,
        audioDataUrl,
        imageDataUrl,
        aspect,
        name: `Studio Nova · ${activePresenter.name}`,
      });
      const finished = await waitForAvatarJob(job.id, update =>
        setBusy({ label: update.message, progress: Math.max(0.05, update.progress / 100) }),
      );
      if (finished.status === "error") throw new Error(finished.error ?? "O provedor falhou.");
      if (!finished.resultUrl) throw new Error("O provedor não devolveu o vídeo.");
      const blob = await fetch(finished.resultUrl).then(response => response.blob());
      setResult({ blob, url: URL.createObjectURL(blob), extension: "mp4" });
      setBusy(null);
    } catch (problem) {
      setBusy(null);
      setError((problem as Error).message);
    }
  };

  const toggleAudio = () => {
    if (!audio) return;
    // The preview hook owns playback: it needs the same AudioContext that feeds
    // the analyser, otherwise the sound would play twice.
    setAudioPlaying(current => !current);
  };

  const selectedEngine = engines.find(item => item.id === engine);
  const providerReady = engine === "portrait" || Boolean(selectedEngine?.ready);

  return (
    <div className="studio-shell min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/8 bg-[#0A0A0F]/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="btn-ghost h-8 w-8 p-0" aria-label="Voltar">
              <ArrowLeft size={15} />
            </Link>
            <div>
              <p className="wordmark text-[14px] leading-none">Avatar Studio</p>
              <p className="mt-1 text-[10.5px] text-muted-foreground">
                Apresentadores que falam o seu roteiro
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/ajustes" className="btn-ghost text-[11.5px]">
              <Settings2 size={14} /> Chaves de API
            </Link>
            <Link href="/roteiro" className="btn-ghost text-[11.5px]">
              <Wand2 size={14} /> Roteiro → vídeo
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1400px] gap-4 px-4 py-5 lg:grid-cols-[300px_minmax(0,1fr)_340px]">
        {/* Presenters ------------------------------------------------------ */}
        <section className="panel h-fit p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="label">Apresentadores</h2>
            <span className="text-[10px] text-muted-foreground">IA · livres de direitos</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {PRESENTERS.map(presenter => {
              const active = !custom && presenter.id === selected;
              return (
                <button
                  key={presenter.id}
                  type="button"
                  onClick={() => {
                    setSelected(presenter.id);
                    setCustom(null);
                    setResult(null);
                  }}
                  className={`group relative overflow-hidden rounded-xl border text-left transition ${
                    active
                      ? "border-[var(--studio-accent)]/80 ring-2 ring-[var(--studio-accent)]/25"
                      : "border-white/10 hover:border-white/30"
                  }`}
                >
                  <div className="aspect-[4/5] w-full bg-white/5">
                    <img
                      src={presenter.src}
                      alt={presenter.name}
                      className="h-full w-full object-cover"
                      onError={event => {
                        (event.currentTarget.parentElement as HTMLElement).style.display = "none";
                      }}
                    />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 pb-1.5 pt-5">
                    <p className="text-[11.5px] font-medium leading-tight">{presenter.name}</p>
                    <p className="truncate text-[9.5px] text-white/55">{presenter.role}</p>
                  </div>
                  {active ? (
                    <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--studio-accent)] text-black">
                      <Check size={12} />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-2 flex w-full items-center gap-2 rounded-xl border border-dashed border-white/15 px-2.5 py-2.5 text-left transition hover:border-white/35"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/6">
              <ImagePlus size={15} />
            </span>
            <span className="min-w-0">
              <span className="block text-[11.5px] font-medium">Usar uma foto minha</span>
              <span className="block truncate text-[9.5px] text-muted-foreground">
                {custom ? custom.name : "JPG ou PNG, rosto de frente"}
              </span>
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={event => {
              const file = event.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
        </section>

        {/* Preview + script ------------------------------------------------ */}
        <section className="space-y-4">
          <div className="panel overflow-hidden">
            <div className="relative grid place-items-center bg-[radial-gradient(circle_at_50%_30%,#1b1b28,#08080c)] px-4 py-6">
              <div className="relative aspect-square w-full max-w-[330px]">
                <canvas ref={canvasRef} className="h-full w-full" />
                {!face ? (
                  <div className="absolute inset-0 grid place-items-center rounded-full bg-black/50 text-[11px] text-white/60">
                    <Loader2 className="animate-spin" size={18} />
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={toggleAudio}
                  disabled={!audio}
                  className={`absolute bottom-2 right-2 grid h-9 w-9 place-items-center rounded-full border backdrop-blur transition ${
                    audio
                      ? "border-white/25 bg-black/50 hover:bg-black/70"
                      : "cursor-not-allowed border-white/10 bg-black/30 text-white/30"
                  }`}
                  title={audio ? "Ouvir a narração" : "Gere a narração primeiro"}
                >
                  {audioPlaying ? <Square size={13} /> : <Play size={14} />}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                {ASPECTS.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAspect(item.id)}
                    className={`rounded-lg border px-2.5 py-1 text-[10.5px] transition ${
                      aspect === item.id
                        ? "border-[var(--studio-accent)]/70 bg-[var(--studio-accent)]/12 text-foreground"
                        : "border-white/10 text-muted-foreground hover:border-white/25"
                    }`}
                    title={item.hint}
                  >
                    {item.label} · {item.id}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="panel p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="label">Roteiro</h2>
              <span className="font-mono text-[10px] text-muted-foreground">
                {words} palavras · ~{formatClock(estimate)}
              </span>
            </div>
            <textarea
              value={script}
              onChange={event => {
                setScript(event.target.value);
                setAudio(null);
                setResult(null);
              }}
              className="studio-input min-h-[132px] w-full resize-y leading-relaxed"
              placeholder="Escreva exatamente o que o apresentador deve falar…"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleGenerateAudio}
                className="btn-ghost text-[11.5px]"
                disabled={Boolean(busy)}
              >
                <Volume2 size={14} /> Gerar narração grátis
              </button>
              <button
                type="button"
                onClick={handleRender}
                disabled={Boolean(busy) || !providerReady}
                className="btn-primary ml-auto text-[12px]"
              >
                {busy ? <Loader2 className="animate-spin" size={14} /> : <Clapperboard size={14} />}
                {busy ? "Renderizando…" : "Gerar vídeo"}
              </button>
            </div>
            {busy ? (
              <div className="mt-2 space-y-1">
                <div className="h-1 overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full bg-[var(--studio-accent)] transition-all"
                    style={{ width: `${Math.round(busy.progress * 100)}%` }}
                  />
                </div>
                <p className="text-[10.5px] text-muted-foreground">{busy.label}</p>
              </div>
            ) : null}
            {error ? (
              <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-200">
                {error}
              </p>
            ) : null}
          </div>

          {result ? (
            <div className="panel p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="label">Seu vídeo</h2>
                <button
                  type="button"
                  onClick={() => downloadBlob(result.blob, `avatar-${Date.now()}.${result.extension}`)}
                  className="btn-primary text-[11.5px]"
                >
                  <Download size={14} /> Baixar
                </button>
              </div>
              <video
                src={result.url}
                controls
                playsInline
                className="w-full rounded-xl border border-white/10 bg-black"
              />
            </div>
          ) : null}
        </section>

        {/* Engine + voice -------------------------------------------------- */}
        <section className="space-y-4">
          <div className="panel p-3">
            <h2 className="label mb-2">Motor do avatar</h2>
            <div className="space-y-1.5">
              {engines.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setEngine(item.id)}
                  className={`w-full rounded-xl border p-2.5 text-left transition ${
                    engine === item.id
                      ? "border-[var(--studio-accent)]/70 bg-[var(--studio-accent)]/10"
                      : "border-white/10 hover:border-white/25"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-medium">{item.name}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] ${
                        item.id === "portrait"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : item.ready
                            ? "bg-sky-500/15 text-sky-300"
                            : "bg-white/8 text-white/45"
                      }`}
                    >
                      {item.tag}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{item.description}</p>
                  <div className="mt-1 flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map(step => (
                      <span
                        key={step}
                        className={`h-1 w-4 rounded-full ${
                          step <= item.quality ? "bg-[var(--studio-accent)]" : "bg-white/12"
                        }`}
                      />
                    ))}
                  </div>
                  {item.id !== "portrait" && !item.ready ? (
                    <p className="mt-1 text-[9.5px] text-amber-300/80">
                      Falta a chave — configure em “Chaves de API”.
                    </p>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <div className="panel p-3">
            <h2 className="label mb-2">Voz</h2>
            <div className="space-y-1.5">
              {PT_VOICES.map(voice => (
                <button
                  key={voice.id}
                  type="button"
                  onClick={() => {
                    setVoiceId(voice.id);
                    setAudio(null);
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition ${
                    voiceId === voice.id
                      ? "border-[var(--studio-accent)]/70 bg-[var(--studio-accent)]/10"
                      : "border-white/10 hover:border-white/25"
                  }`}
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/8 text-[10.5px] font-semibold">
                    {voice.name.slice(0, 1)}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11.5px] font-medium">{voice.name}</span>
                    <span className="block truncate text-[9.5px] text-muted-foreground">
                      {voice.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              <label className="block">
                <span className="flex items-center justify-between text-[10.5px] text-muted-foreground">
                  Velocidade <span className="font-mono">{rate.toFixed(2)}×</span>
                </span>
                <input
                  type="range"
                  min={0.7}
                  max={1.3}
                  step={0.05}
                  value={rate}
                  onChange={event => {
                    setRate(Number(event.target.value));
                    setAudio(null);
                  }}
                  className="w-full"
                />
              </label>
              <label className="block">
                <span className="flex items-center justify-between text-[10.5px] text-muted-foreground">
                  Tom <span className="font-mono">{pitch.toFixed(2)}</span>
                </span>
                <input
                  type="range"
                  min={0.8}
                  max={1.2}
                  step={0.02}
                  value={pitch}
                  onChange={event => {
                    setPitch(Number(event.target.value));
                    setAudio(null);
                  }}
                  className="w-full"
                />
              </label>
            </div>
          </div>

          <div className="panel p-3">
            <h2 className="label mb-1.5 flex items-center gap-1.5">
              <Sparkles size={12} /> Dica
            </h2>
            <p className="text-[10.5px] leading-relaxed text-muted-foreground">
              O motor <strong className="text-foreground/80">Retrato Falante</strong> roda 100% na sua
              máquina: nenhuma imagem sai daqui e não existe limite de minutos. Para clonar o seu corpo,
              conecte o HeyGen ou o D-ID em “Chaves de API”.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
