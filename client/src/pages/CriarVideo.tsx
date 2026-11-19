/**
 * Criar vídeo — o mais simples possível.
 *
 * Escolha um apresentador, cole o roteiro e clique em Gerar vídeo.
 * A narração em português é criada automaticamente e o retrato fala sozinho,
 * tudo no seu navegador, sem servidor externo, sem créditos.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Check,
  Clapperboard,
  Download,
  Loader2,
  Play,
  Settings2,
  Sparkles,
  Volume2,
} from "lucide-react";
import { PT_VOICES } from "@shared/editor";
import { generateNarration } from "@/lib/api";
import { detectFaceAnchors, type FaceAnchors } from "@/engine/faceAnchors";
import { renderTalkingVideo } from "@/engine/talkingVideo";
import { estimateNarrationDuration } from "@/lib/format";

interface Presenter {
  id: string;
  name: string;
  role: string;
  src: string;
  accent: string;
}

const PRESENTERS: Presenter[] = [
  { id: "ana", name: "Ana", role: "Apresentadora", src: "/avatars/ana.jpg", accent: "#FF7A1A" },
  { id: "bruno", name: "Bruno", role: "Consultor", src: "/avatars/bruno.jpg", accent: "#2C6E6B" },
  { id: "carla", name: "Carla", role: "Social media", src: "/avatars/carla.jpg", accent: "#6C5CE7" },
  { id: "diego", name: "Diego", role: "Professor", src: "/avatars/diego.jpg", accent: "#2E86DE" },
  { id: "elisa", name: "Elisa", role: "Executiva", src: "/avatars/elisa.jpg", accent: "#C0563F" },
  { id: "fabio", name: "Fábio", role: "Criador", src: "/avatars/fabio.jpg", accent: "#1F9D74" },
];

const VOICES = PT_VOICES.slice(0, 3);

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

export default function CriarVideo() {
  const [selected, setSelected] = useState<string>("ana");
  const [script, setScript] = useState(
    "Olá! Eu sou a sua apresentadora no Studio Nova. Criei este vídeo só colando este texto.",
  );
  const [voiceId, setVoiceId] = useState(VOICES[0].id);
  const [busy, setBusy] = useState<{ label: string; progress: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    url: string;
    blob: Blob;
    duration: number;
    extension: "mp4" | "webm";
  } | null>(null);

  const activePresenter = useMemo(
    () => PRESENTERS.find(item => item.id === selected) ?? PRESENTERS[0],
    [selected],
  );

  const handleGenerate = async () => {
    setError(null);
    setResult(null);

    const text = script.trim();
    if (!text) {
      setError("Escreva o roteiro antes de gerar.");
      return;
    }
    if (text.length > 1200) {
      setError("O roteiro está muito longo (máximo 1200 caracteres).");
      return;
    }

    try {
      // 1. Gera a narração em português (voz neural, grátis).
      setBusy({ label: "Criando a narração em português…", progress: 0.25 });
      const narration = await generateNarration({ text, voiceId, rate: 1, pitch: 1 });

      // 2. Detecta os pontos do rosto (boca e olhos) para o retrato falar certo.
      setBusy({ label: "Ajustando o rosto do apresentador…", progress: 0.45 });
      const image = new Image();
      image.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Não consegui carregar o retrato."));
        image.src = activePresenter.src;
      });
      const anchors = await detectFaceAnchors(image).catch(() => null);

      // 3. Renderiza o vídeo no navegador (retrato falante + áudio).
      setBusy({ label: "Renderizando o vídeo… isso leva alguns segundos", progress: 0.6 });
      const rendered = await renderTalkingVideo({
        imageUrl: activePresenter.src,
        anchors,
        audio: narration,
        aspect: "9:16",
        fps: 30,
        accent: activePresenter.accent,
        onProgress: (progress, message) =>
          setBusy({ label: message, progress: 0.6 + progress * 0.35 }),
      });

      setBusy(null);
      setResult({
        url: URL.createObjectURL(rendered.blob),
        blob: rendered.blob,
        duration: rendered.duration,
        extension: rendered.extension,
      });
    } catch (problem) {
      setBusy(null);
      setError((problem as Error).message || "Não consegui gerar o vídeo.");
    }
  };

  const handleDownload = () => {
    if (!result) return;
    downloadBlob(result.blob, `studio-nova-${activePresenter.id}.${result.extension}`);
  };

  const words = script.trim().split(/\s+/).filter(Boolean).length;
  const estimate = estimateNarrationDuration(script);

  return (
    <div className="studio-shell min-h-screen flex flex-col">
      <header className="border-b border-white/8 bg-[#0A0A0F]/85 backdrop-blur z-20">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-4">
          <Link href="/" className="btn-ghost h-8 w-8 p-0" aria-label="Voltar">
            <ArrowLeft size={15} />
          </Link>
          <div>
            <p className="wordmark text-[14px] leading-none">Criar vídeo</p>
            <p className="mt-1 text-[10.5px] text-muted-foreground">
              Um clique: cole o texto e receba o vídeo pronto
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/ajustes" className="btn-ghost text-[11.5px]">
              <Settings2 size={14} /> Ajustes
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] gap-6 px-4 py-6 flex-1">
        {/* Passo 1: apresentador ------------------------------------------------- */}
        <section className="panel p-4">
          <div className="mb-3 flex items-center gap-2">
            <Clapperboard size={16} className="text-[var(--studio-accent)]" />
            <h2 className="text-[13px] font-semibold">1. Escolha o apresentador</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PRESENTERS.map(presenter => {
              const active = presenter.id === selected;
              return (
                <button
                  key={presenter.id}
                  type="button"
                  onClick={() => setSelected(presenter.id)}
                  className={`group relative overflow-hidden rounded-2xl border p-2 text-left transition ${
                    active
                      ? "border-[var(--studio-accent)]/80 ring-2 ring-[var(--studio-accent)]/25 bg-white/5"
                      : "border-white/10 hover:border-white/30 hover:bg-white/3"
                  }`}
                >
                  <div className="aspect-[4/5] w-full overflow-hidden rounded-xl bg-white/5">
                    <img
                      src={presenter.src}
                      alt={presenter.name}
                      className="h-full w-full object-cover object-center transition group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                  <div className="mt-2 px-1">
                    <p className="text-[11.5px] font-bold group-hover:text-[var(--studio-accent)] transition-colors">
                      {presenter.name}
                    </p>
                    <p className="text-[9.5px] text-muted-foreground">{presenter.role}</p>
                  </div>
                  {active && (
                    <div className="absolute right-2 top-2">
                      <Check size={14} className="text-[var(--studio-accent)]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Passo 2: roteiro ----------------------------------------------------- */}
        <section className="panel p-4">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles size={16} className="text-[var(--studio-accent)]" />
            <h2 className="text-[13px] font-semibold">2. Cole o roteiro</h2>
          </div>
          <textarea
            className="studio-input min-h-[150px] resize-y text-[13px] leading-relaxed"
            placeholder="Ex.: Olá, seja bem-vindo ao meu curso. Hoje vamos aprender a criar vídeos com inteligência artificial, de forma simples e direta."
            value={script}
            onChange={event => setScript(event.target.value)}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
            <span>
              {words} palavra{words !== 1 ? "s" : ""} · cerca de{" "}
              <span className="text-[var(--studio-accent)] font-medium">
                {Math.round(estimate)}s
              </span>{" "}
              de vídeo
            </span>
            <span className="ml-auto">
              Voz:
              <select
                value={voiceId}
                onChange={event => setVoiceId(event.target.value)}
                className="bg-transparent border-none text-xs text-[var(--studio-muted)] font-medium cursor-pointer focus:ring-0"
              >
                {VOICES.map(voice => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name}
                  </option>
                ))}
              </select>
            </span>
          </div>
          {error ? (
            <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11.5px] text-red-200">
              {error}
            </p>
          ) : null}
        </section>

        {/* Passo 3: gerar -------------------------------------------------------- */}
        <section className="panel p-4 flex flex-col items-center justify-center min-h-[320px]">
          {result ? (
            <div className="text-center space-y-4">
              <div className="grid h-24 w-24 place-items-center rounded-full bg-white/5 border border-white/10 mb-2">
                <Check size={20} className="text-emerald-400" />
              </div>
              <h2 className="text-[15px] font-bold">Vídeo pronto!</h2>
              <p className="text-[11px] text-muted-foreground">
                {Math.round(result.duration)}s · {activePresenter.name} fala o seu roteiro
              </p>
              <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="btn-3d flex-1 py-3 text-[13px] font-bold"
                >
                  <Download size={16} /> Baixar vídeo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    setScript("");
                  }}
                  className="btn-ghost px-4 py-3 text-[12px]"
                >
                  Fazer outro
                </button>
              </div>
            </div>
          ) : busy ? (
            <div className="text-center space-y-3">
              <Loader2 className="animate-spin text-[var(--studio-accent)]" size={24} />
              <p className="text-[12px] font-medium">{busy.label}</p>
              <div className="w-full max-w-xs bg-white/5 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[var(--studio-accent)] to-rose-500"
                  style={{ width: `${Math.round(busy.progress * 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="text-center space-y-3">
              <Clapperboard size={32} className="text-[var(--studio-muted)] mb-2" />
              <h2 className="text-[15px] font-bold">Gerar o vídeo</h2>
              <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                Escolha o apresentador, cole o roteiro e clique abaixo. A narração e o vídeo
                são criados automaticamente, tudo grátis e no seu navegador.
              </p>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={busy !== null || !script.trim()}
                className="btn-3d py-3 px-8 text-[14px] font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? (
                  <>
                    <Loader2 size={16} className="animate-spin mr-2" />
                    Gerando…
                  </>
                ) : (
                  <>
                    <Play size={16} className="mr-2" />
                    Gerar vídeo pronto
                  </>
                )}
              </button>
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-white/8 bg-[#0A0A0F]/85 backdrop-blur py-3">
        <div className="mx-auto max-w-[1200px] px-4 text-center text-[10px] text-muted-foreground">
          Retrato Falante · grátis e offline · nada é enviado para a nuvem
        </div>
      </footer>
    </div>
  );
}
