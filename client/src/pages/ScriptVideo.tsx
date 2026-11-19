import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Film,
  Loader2,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  FORMAT_PRESETS,
  PT_VOICES,
  formatPreset,
  type FormatPresetId,
} from "@shared/editor";
import {
  estimateSeconds,
  generateVideoFromScript,
  splitScript,
} from "@/lib/scriptVideo";
import { formatClock } from "@/lib/format";
import { Segmented, Select, Slider, Toggle } from "@/components/studio/ui";

const FORMAT_OPTIONS: FormatPresetId[] = [
  "hotmart",
  "reels",
  "stories",
  "feed",
];

export default function ScriptVideo() {
  const [, navigate] = useLocation();
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [voiceId, setVoiceId] = useState(PT_VOICES[0].id);
  const [rate, setRate] = useState(1);
  const [format, setFormat] = useState<FormatPresetId>("hotmart");
  const [withAvatar, setWithAvatar] = useState(true);
  const [withCaptions, setWithCaptions] = useState(true);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const chunks = useMemo(() => splitScript(script), [script]);
  const estimated = useMemo(
    () => chunks.reduce((sum, chunk) => sum + estimateSeconds(chunk), 0),
    [chunks]
  );

  const run = async () => {
    if (chunks.length === 0) {
      setError("Cole o roteiro antes de gerar.");
      return;
    }
    setBusy(true);
    setError(null);
    setDone(0);
    setTotal(chunks.length);
    setStep("Preparando as cenas…");
    try {
      const project = await generateVideoFromScript({
        script,
        title,
        voiceId,
        rate,
        pitch: 1,
        format,
        withAvatar,
        withCaptions,
        onProgress: info => {
          setStep(info.step);
          setTotal(info.total);
          setDone(info.index + 1);
        },
      });
      setStep("Vídeo montado. Abrindo o editor…");
      navigate(`/aula/${project.id}`);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const progress = total > 0 ? Math.min(1, done / total) : 0;

  return (
    <div className="studio-shell min-h-screen">
      <header className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4">
        <Link href="/" className="icon-btn" title="Voltar">
          <ArrowLeft size={16} />
        </Link>
        <div className="min-w-0">
          <p className="wordmark text-[15px] leading-tight">
            Vídeo a partir do roteiro
          </p>
          <p className="text-[10.5px] text-muted-foreground">
            Cole o texto e o Studio Nova monta cenas, narração e legendas
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-4xl gap-4 px-4 pb-16 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="panel space-y-3 p-4">
          <label className="block space-y-1.5">
            <span className="label">Nome do vídeo</span>
            <input
              className="studio-input"
              placeholder="Ex.: Aula 03 — Como organizar a rotina"
              value={title}
              onChange={event => setTitle(event.target.value)}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="label">Roteiro</span>
            <textarea
              className="studio-input min-h-[260px] resize-y text-[12.5px] leading-relaxed"
              placeholder={`Cole aqui o texto que você vai falar. Separe parágrafos com uma linha em branco para controlar as cenas.

Exemplo:
Olá! Hoje eu vou te mostrar como organizar a rotina de estudos em três passos simples.

O primeiro passo é escolher um único objetivo por semana. Pare de tentar aprender tudo ao mesmo tempo.

O segundo passo é reservar blocos curtos de foco, de 25 a 40 minutos, sempre no mesmo horário.

E o terceiro passo é revisar no dia seguinte, em voz alta, o que você aprendeu.`}
              value={script}
              onChange={event => setScript(event.target.value)}
            />
          </label>

          <div className="flex flex-wrap items-center gap-3 text-[10.5px] text-muted-foreground">
            <span>{script.trim().length} caracteres</span>
            <span>{chunks.length} cena(s)</span>
            <span>≈ {formatClock(estimated)} de narração</span>
          </div>

          {error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-[11.5px] text-red-200">
              {error}
            </p>
          ) : null}

          {busy || progress > 0 ? (
            <div className="space-y-1.5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[var(--studio-accent)] transition-[width] duration-300"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {busy ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <CheckCircle2
                    size={11}
                    className="text-[var(--studio-teal)]"
                  />
                )}
                {step} {total > 0 ? `· ${Math.min(done, total)}/${total}` : ""}
              </p>
            </div>
          ) : null}

          <button
            type="button"
            className="btn-primary w-full"
            onClick={() => void run()}
            disabled={busy}
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Wand2 size={14} />
            )}
            {busy ? "Gerando o vídeo…" : "Gerar vídeo completo"}
          </button>
          <p className="text-[10.5px] leading-relaxed text-muted-foreground">
            Cada parágrafo vira uma cena. O estúdio narra, ajusta a duração ao
            áudio e sincroniza as legendas — depois é só revisar e exportar.
          </p>
        </section>

        <aside className="space-y-3">
          <div className="panel space-y-3 p-3">
            <span className="label">Voz</span>
            <Select
              value={voiceId}
              onChange={setVoiceId}
              options={PT_VOICES.map(voice => ({
                value: voice.id,
                label: `${voice.name} — ${voice.gender}`,
              }))}
            />
            <Slider
              label="Velocidade"
              min={0.8}
              max={1.3}
              step={0.05}
              value={rate}
              onChange={setRate}
              format={value => `${value.toFixed(2)}×`}
            />
          </div>

          <div className="panel space-y-3 p-3">
            <span className="label">Formato</span>
            <Segmented
              value={format}
              onChange={setFormat}
              options={FORMAT_OPTIONS.map(id => ({
                value: id,
                label: formatPreset(id).ratio,
              }))}
            />
            <p className="text-[10px] text-muted-foreground">
              {formatPreset(format).label} · {formatPreset(format).channel}
            </p>
            <Toggle
              label="Incluir avatar"
              checked={withAvatar}
              onChange={setWithAvatar}
            />
            <Toggle
              label="Gerar legendas"
              checked={withCaptions}
              onChange={setWithCaptions}
            />
          </div>

          <div className="panel-quiet space-y-1.5 p-3 text-[10.5px] leading-relaxed text-muted-foreground">
            <p className="flex items-center gap-1.5 text-foreground/80">
              <Sparkles size={11} className="text-[var(--studio-accent)]" />{" "}
              Dica
            </p>
            <p>
              Frases curtas narram melhor. Um parágrafo por ideia mantém as
              cenas com 6 a 12 segundos e o vídeo no ritmo certo para aula e
              para Reels.
            </p>
          </div>

          <div className="panel-quiet space-y-1 p-3 text-[10.5px] text-muted-foreground">
            <p className="flex items-center gap-1.5 text-foreground/80">
              <Film size={11} /> Formatos disponíveis
            </p>
            {FORMAT_PRESETS.filter(preset =>
              FORMAT_OPTIONS.includes(preset.id)
            ).map(preset => (
              <p key={preset.id}>
                {preset.label} — {preset.width}×{preset.height}
              </p>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}
