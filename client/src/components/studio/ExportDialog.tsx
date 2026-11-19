import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Download, Loader2, X } from "lucide-react";
import { downloadBlob, exportSceneImage, exportSupport, exportVideo, safeFileName } from "@/engine/export";
import { formatClock } from "@/lib/format";
import { useEditorContext } from "@/store/editor";
import { Segmented } from "./ui";

type Resolution = "1080" | "720" | "540";
type Quality = "alta" | "media" | "leve";

const QUALITY_BITRATE: Record<Quality, number> = {
  alta: 8_000_000,
  media: 5_000_000,
  leve: 2_600_000,
};

export default function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const api = useEditorContext();
  const project = api.project;
  const [resolution, setResolution] = useState<Resolution>("1080");
  const [quality, setQuality] = useState<Quality>("alta");
  const [fps, setFps] = useState<"30" | "24">("30");
  const [mode, setMode] = useState<"video" | "image">("video");
  const [scope, setScope] = useState<"scene" | "all">("scene");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ url: string; size: number; extension: string; blob: Blob } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const support = useMemo(() => exportSupport(), []);

  useEffect(() => {
    if (!open) {
      setProgress(0);
      setMessage("");
      setError(null);
    }
  }, [open]);

  if (!open || !project) return null;

  const targetHeight = Number(resolution);
  // "1080p" means the short side is 1080, so vertical videos export at 1080×1920.
  const scale = targetHeight / Math.min(project.width, project.height);
  const width = Math.round((project.width * scale) / 2) * 2;
  const height = Math.round((project.height * scale) / 2) * 2;

  const start = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress(0);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const output = await exportVideo(project, {
        width,
        height,
        fps: Number(fps),
        videoBitsPerSecond: QUALITY_BITRATE[quality],
        signal: controller.signal,
        onProgress: (value, label) => {
          setProgress(value);
          setMessage(label);
        },
      });
      const url = URL.createObjectURL(output.blob);
      setResult({ url, size: output.blob.size, extension: output.extension, blob: output.blob });
      setMessage("Vídeo pronto para baixar.");
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const exportImages = async () => {
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      const indexes =
        scope === "all" ? project.scenes.map((_, index) => index) : [api.sceneIndex];
      for (let step = 0; step < indexes.length; step += 1) {
        const index = indexes[step];
        setMessage(`Gerando imagem ${step + 1} de ${indexes.length}…`);
        const blob = await exportSceneImage(project, index, { scale: 2 });
        const suffix = indexes.length > 1 ? `-${String(index + 1).padStart(2, "0")}` : "";
        downloadBlob(blob, `${safeFileName(project.name)}${suffix}.png`);
        setProgress((step + 1) / indexes.length);
        await new Promise(resolve => setTimeout(resolve, 350));
      }
      setMessage(
        indexes.length > 1
          ? `${indexes.length} imagens baixadas (PNG em ${project.width * 2}×${project.height * 2}).`
          : "Imagem pronta para baixar.",
      );
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-3 backdrop-blur-sm">
      <div className="panel w-full max-w-lg overflow-hidden">
        <header className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
          <div>
          <h2 className="wordmark text-[15px]">Exportar</h2>
          <p className="text-[11px] text-muted-foreground">
              {mode === "video"
                ? `${formatClock(api.totalDuration)} · ${width}×${height} · ${fps}fps`
                : `${project.width * 2}×${project.height * 2} PNG · ${project.scenes.length} cena(s)`}
          </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} disabled={busy}>
            <X size={16} />
          </button>
        </header>

        <div className="space-y-4 px-4 py-4">
          <Segmented
            value={mode}
            onChange={value => {
              setMode(value);
              setError(null);
            }}
            options={[
              { value: "video", label: "Vídeo" },
              { value: "image", label: "Imagem PNG" },
            ]}
          />

          {mode === "image" ? (
            <>
              <div className="space-y-2">
                <span className="label">O que exportar</span>
                <Segmented
                  value={scope}
                  onChange={setScope}
                  options={[
                    { value: "scene", label: `Cena ${api.sceneIndex + 1}` },
                    { value: "all", label: `Todas as ${project.scenes.length} cenas` },
                  ]}
                />
              </div>
              <p className="rounded-lg bg-white/[0.04] px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                Ideal para post de feed, carrossel, capa de blog e thumbnail de live. O PNG sai em{" "}
                {project.width * 2}×{project.height * 2} pixels, pronto para publicar.
              </p>
              {progress > 0 ? (
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  {busy ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} className="text-[var(--studio-teal)]" />}
                  {message}
                </p>
              ) : null}
              {error ? (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-[11.5px] text-red-200">{error}</p>
              ) : null}
            </>
          ) : null}

          {mode === "video" ? (
          <>
          {!support.canExport ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-[12px] text-red-200">
              Este navegador não suporta gravação de vídeo. Use o Chrome ou o Edge atualizado.
            </p>
          ) : null}

          <div className="space-y-2">
            <span className="label">Resolução</span>
            <Segmented
              value={resolution}
              onChange={setResolution}
              options={[
                { value: "1080", label: "1080p" },
                { value: "720", label: "720p" },
                { value: "540", label: "540p" },
              ]}
            />
          </div>

          <div className="space-y-2">
            <span className="label">Qualidade</span>
            <Segmented
              value={quality}
              onChange={setQuality}
              options={[
                { value: "alta", label: "Alta" },
                { value: "media", label: "Média" },
                { value: "leve", label: "Leve" },
              ]}
            />
          </div>

          <div className="space-y-2">
            <span className="label">Quadros por segundo</span>
            <Segmented
              value={fps}
              onChange={setFps}
              options={[
                { value: "30", label: "30 fps" },
                { value: "24", label: "24 fps" },
              ]}
            />
          </div>

          <p className="rounded-lg bg-white/[0.04] px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            A gravação acontece em tempo real: leva cerca de {formatClock(api.totalDuration)}. Mantenha esta aba aberta
            até terminar. Formato do arquivo: <strong>{support.extension.toUpperCase()}</strong>.
          </p>

          {busy || progress > 0 ? (
            <div className="space-y-1.5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[var(--studio-accent)] transition-[width] duration-200"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {busy ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} className="text-[var(--studio-teal)]" />}
                {message} {Math.round(progress * 100)}%
              </p>
            </div>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-[11.5px] text-red-200">{error}</p>
          ) : null}

          {result ? (
            <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
              <video src={result.url} controls className="max-h-44 w-full rounded-lg bg-black" />
              <button
                type="button"
                className="btn-primary w-full"
                onClick={() => downloadBlob(result.blob, `${safeFileName(project.name)}.${result.extension}`)}
              >
                <Download size={14} /> Baixar vídeo ({(result.size / (1024 * 1024)).toFixed(1)} MB)
              </button>
            </div>
          ) : null}
          </>
          ) : null}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-white/[0.07] px-4 py-3">
          {busy ? (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                abortRef.current?.abort();
                setBusy(false);
              }}
            >
              Cancelar
            </button>
          ) : (
            <button type="button" className="btn-ghost" onClick={onClose}>
              Fechar
            </button>
          )}
          {mode === "image" ? (
            <button type="button" className="btn-primary" onClick={() => void exportImages()} disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {busy ? "Gerando…" : scope === "all" ? "Baixar imagens" : "Baixar PNG"}
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={() => void start()} disabled={busy || !support.canExport}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {busy ? "Gravando…" : result ? "Exportar de novo" : "Começar gravação"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
