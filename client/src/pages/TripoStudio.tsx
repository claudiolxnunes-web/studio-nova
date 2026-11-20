/**
 * Tripo 3D lab: prompt -> GLB -> interactive preview -> download.
 */
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Box,
  Download,
  ExternalLink,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Link } from "wouter";
import {
  fetchTripoStatus,
  startTripoModel,
  waitForTripoTask,
  type TripoStatus,
  type TripoTask,
} from "@/lib/tripoApi";

const ModelViewer = "model-viewer" as unknown as React.FC<
  Record<string, unknown>
>;

const EXAMPLES = [
  "válvula industrial de aço inox, com volante laranja, vista explodida",
  "bomba centrífuga de processo, corpo azul, base metálica, alta fidelidade",
  "EPI completo: capacete branco, óculos, luvas e protetor auricular",
  "linha de produção de alimentos em miniatura, esteira e tanques de inox",
];

export default function TripoStudio() {
  const [status, setStatus] = useState<TripoStatus | null>(null);
  const [prompt, setPrompt] = useState(EXAMPLES[0]);
  const [model, setModel] = useState("v3.1-20260211");
  const [textureQuality, setTextureQuality] = useState<
    "fast" | "standard" | "detailed"
  >("standard");
  const [geometryQuality, setGeometryQuality] = useState<
    "standard" | "detailed"
  >("standard");
  const [faceLimit, setFaceLimit] = useState("");
  const [busy, setBusy] = useState(false);
  const [task, setTask] = useState<TripoTask | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void import("@google/model-viewer");
    void fetchTripoStatus()
      .then(next => {
        setStatus(next);
        if (next.model) setModel(next.model);
      })
      .catch(() => undefined);
  }, []);

  const generate = async () => {
    if (!prompt.trim()) {
      setError("Descreva o objeto 3D.");
      return;
    }
    setBusy(true);
    setError(null);
    setTask(null);
    try {
      const started = await startTripoModel({
        prompt: prompt.trim(),
        model,
        textureQuality,
        geometryQuality,
        faceLimit: faceLimit ? Number(faceLimit) : undefined,
      });
      const final = await waitForTripoTask(started.taskId, setTask);
      setTask(final);
      if (final.error) setError(final.error);
    } catch (caught) {
      setError((caught as Error).message || "Não foi possível gerar o modelo.");
    } finally {
      setBusy(false);
    }
  };

  const progress = task?.progress ?? 0;
  const modelUrl = task?.modelUrl ?? task?.remoteModelUrl;

  return (
    <div className="studio-shell min-h-screen">
      <header className="border-b border-white/8 bg-[#0A0A0F]/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-4">
          <Link href="/" className="btn-ghost h-8 w-8 p-0" aria-label="Voltar">
            <ArrowLeft size={15} />
          </Link>
          <div>
            <p className="wordmark flex items-center gap-2 text-[14px] leading-none">
              <Box size={15} className="text-violet-300" /> Tripo 3D
            </p>
            <p className="mt-1 text-[10.5px] text-muted-foreground">
              Texto → modelo 3D → preview → GLB
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/ajustes" className="btn-ghost text-[11.5px]">
              Chave da Tripo
            </Link>
            <a
              href="https://developers.tripo3d.ai/en/docs/quick-start"
              target="_blank"
              rel="noreferrer"
              className="btn-ghost text-[11.5px]"
            >
              Docs <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1200px] gap-4 px-4 py-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <section className="panel space-y-4 p-4">
          <label className="block space-y-1.5">
            <span className="label">Objeto 3D</span>
            <textarea
              className="studio-input min-h-[140px] resize-y text-[12.5px] leading-relaxed"
              value={prompt}
              onChange={event => setPrompt(event.target.value)}
              placeholder="Descreva forma, material, estilo e escala."
            />
          </label>

          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map(example => (
              <button
                key={example}
                type="button"
                onClick={() => setPrompt(example)}
                className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[9.5px] text-muted-foreground transition hover:border-violet-400/40 hover:text-violet-200"
              >
                {example.split(",")[0]}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="label">Modelo Tripo</span>
              <select
                className="studio-input mt-1 w-full"
                value={model}
                onChange={event => setModel(event.target.value)}
              >
                <option value="v3.1-20260211">H3.1 — máxima qualidade</option>
                <option value="P2-20260801">P2 — game-ready / low poly</option>
                <option value="v3.0-20250812">v3.0 — estável</option>
              </select>
            </label>
            <label className="block">
              <span className="label">Textura</span>
              <select
                className="studio-input mt-1 w-full"
                value={textureQuality}
                onChange={event =>
                  setTextureQuality(
                    event.target.value as "fast" | "standard" | "detailed",
                  )
                }
              >
                <option value="fast">Rápida</option>
                <option value="standard">Padrão</option>
                <option value="detailed">Detalhada</option>
              </select>
            </label>
            <label className="block">
              <span className="label">Geometria</span>
              <select
                className="studio-input mt-1 w-full"
                value={geometryQuality}
                onChange={event =>
                  setGeometryQuality(
                    event.target.value as "standard" | "detailed",
                  )
                }
              >
                <option value="standard">Padrão</option>
                <option value="detailed">Detalhada</option>
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="label">Limite de faces (opcional)</span>
              <input
                className="studio-input mt-1 w-full font-mono text-[11.5px]"
                inputMode="numeric"
                placeholder="Ex.: 50000 para web/mobile"
                value={faceLimit}
                onChange={event => setFaceLimit(event.target.value.replace(/\D/g, ""))}
              />
            </label>
          </div>

          <p className="text-[10.5px] leading-relaxed text-muted-foreground">
            {status?.message ??
              "Cada modelo consome créditos da Tripo. O download local é feito antes de a URL assinada expirar."}
          </p>

          {error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-[11.5px] text-red-200">
              {error}
            </p>
          ) : null}

          {busy || task ? (
            <div className="space-y-1.5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-violet-400 transition-[width] duration-300"
                  style={{ width: `${Math.max(3, Math.round(progress))}%` }}
                />
              </div>
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {busy ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Sparkles size={11} className="text-violet-300" />
                )}
                {task?.status ?? "enviando"} · {Math.round(progress)}%
              </p>
            </div>
          ) : null}

          <button
            type="button"
            className="btn-primary w-full"
            onClick={() => void generate()}
            disabled={busy || !prompt.trim()}
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Box size={14} />
            )}
            {busy ? "Gerando modelo 3D…" : "Gerar modelo 3D"}
          </button>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            O Tripo gera o objeto 3D, não o apresentador falando. Use o GLB em
            cenas de produto, equipamentos, EPI ou diagramas técnicos.
          </p>
        </section>

        <section className="panel flex min-h-[520px] flex-col p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-[13px] font-semibold">Preview 3D</h2>
              <p className="text-[10.5px] text-muted-foreground">
                Arraste para girar · scroll para zoom
              </p>
            </div>
            {modelUrl ? (
              <a
                href={modelUrl}
                download
                className="btn-primary !py-1.5 text-[11px]"
              >
                <Download size={13} /> Baixar GLB
              </a>
            ) : null}
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#08080c]">
            {modelUrl ? (
              <ModelViewer
                key={modelUrl}
                src={modelUrl}
                alt="Modelo 3D gerado pelo Tripo"
                camera-controls
                auto-rotate
                shadow-intensity="1"
                exposure="1"
                style={{
                  width: "100%",
                  height: "100%",
                  minHeight: 480,
                  background: "#08080c",
                }}
              />
            ) : task?.previewUrl ? (
              <img
                src={task.previewUrl}
                alt="Preview do modelo 3D"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <div className="p-8 text-center">
                <Box size={34} className="mx-auto text-white/20" />
                <p className="mt-3 text-[12px] text-muted-foreground">
                  O modelo aparece aqui quando a Tripo terminar.
                </p>
                <p className="mt-1 text-[10.5px] text-muted-foreground/70">
                  Normalmente leva de 10 a 120 segundos.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
