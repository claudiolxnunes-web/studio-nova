import { useEffect, useMemo, useRef, useState } from "react";
import { Captions, CheckCircle2, Download, Loader2, X } from "lucide-react";
import { FORMAT_PRESETS, type FormatPresetId } from "@shared/editor";
import { captionsToSrt, captionsToVtt } from "@/engine/captions";
import {
  downloadBlob,
  exportSceneImage,
  exportSupport,
  exportVideo,
  safeFileName,
} from "@/engine/export";
import { exportVideoFast, fastExportSupport } from "@/engine/exportFast";
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
  const [mode, setMode] = useState<"video" | "image" | "package">("video");
  const [scope, setScope] = useState<"scene" | "all">("scene");
  const [packageFormats, setPackageFormats] = useState<FormatPresetId[]>([
    "hotmart",
    "reels",
    "square",
  ]);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    url: string;
    size: number;
    extension: string;
    blob: Blob;
    audioCodec?: "aac" | "opus" | "none";
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const support = useMemo(() => {
    const legacy = exportSupport();
    const fast = fastExportSupport();
    return { ...legacy, fast, canExport: legacy.canExport || fast };
  }, []);

  useEffect(() => {
    if (!open) {
      setProgress(0);
      setMessage("");
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !project) return;
    setPackageFormats(
      Array.from(new Set([project.format, "reels", "square"])) as FormatPresetId[],
    );
  }, [open, project?.format]);

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
    const options = {
      width,
      height,
      fps: Number(fps),
      videoBitsPerSecond: QUALITY_BITRATE[quality],
      signal: controller.signal,
      onProgress: (value: number, label: string) => {
        setProgress(value);
        setMessage(label);
      },
    };
    try {
      let output;
      if (support.fast) {
        setMessage("Renderizando com WebCodecs (mais rápido que o tempo real)…");
        try {
          output = await exportVideoFast(project, options);
        } catch (fastError) {
          if (controller.signal.aborted) throw fastError;
          console.warn("[export] modo rápido indisponível", fastError);
          setMessage(
            "Modo rápido indisponível; voltando para a gravação em tempo real…",
          );
          output = await exportVideo(project, options);
        }
      } else {
        output = await exportVideo(project, options);
      }
      const url = URL.createObjectURL(output.blob);
      setResult({
        url,
        size: output.blob.size,
        extension: output.extension,
        blob: output.blob,
        audioCodec:
          "audioCodec" in output
            ? (output as { audioCodec?: "aac" | "opus" | "none" }).audioCodec
            : undefined,
      });
      setMessage("Vídeo pronto para baixar.");
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const downloadCaptions = (kind: "srt" | "vtt") => {
    const content =
      kind === "srt" ? captionsToSrt(project) : captionsToVtt(project);
    const mime = kind === "srt" ? "application/x-subrip" : "text/vtt";
    downloadBlob(
      new Blob([content], { type: `${mime};charset=utf-8` }),
      `${safeFileName(project.name)}.${kind}`,
    );
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

  const exportPackage = async () => {
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      const { exportImagePackage, imagePackageFileName } = await import(
        "@/engine/package"
      );
      const blob = await exportImagePackage(project, {
        formats: packageFormats,
        onProgress: (value, label) => {
          setProgress(value);
          setMessage(label);
        },
      });
      downloadBlob(blob, imagePackageFileName(project));
      setProgress(1);
      setMessage(
        `Pacote com ${packageFormats.length} formato(s) baixado: imagens, SRT e VTT.`,
      );
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const togglePackageFormat = (id: FormatPresetId) => {
    setPackageFormats(current =>
      current.includes(id)
        ? current.filter(item => item !== id)
        : [...current, id],
    );
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
              { value: "package", label: "Pacote" },
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
            {support.fast
              ? "Renderização acelerada com WebCodecs: os quadros são codificados em um worker, sem esperar o tempo real."
              : `A gravação acontece em tempo real: leva cerca de ${formatClock(
                  api.totalDuration,
                )}. Mantenha esta aba aberta até terminar.`}{" "}
            Formato do arquivo:{" "}
            <strong>{support.fast ? "MP4" : support.extension.toUpperCase()}</strong>.
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
              {result.audioCodec === "opus" ? (
                <p className="text-[10px] leading-relaxed text-amber-200/80">
                  Este navegador não oferece codificação AAC; o MP4 saiu com
                  áudio Opus. Para máxima compatibilidade com editores antigos,
                  use a exportação em tempo real.
                </p>
              ) : null}
            </div>
          ) : null}
          </>
          ) : null}

          {mode === "package" ? (
            <>
              <div className="space-y-2">
                <span className="label">Formatos no pacote</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {FORMAT_PRESETS.map(preset => {
                    const active = packageFormats.includes(preset.id);
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => togglePackageFormat(preset.id)}
                        className={`flex items-center justify-between rounded-lg border px-2 py-1.5 text-left text-[11px] transition ${
                          active
                            ? "border-[var(--studio-accent)]/70 bg-[var(--studio-accent)]/10 text-[#ffc59b]"
                            : "border-white/10 bg-white/[0.02] text-muted-foreground hover:border-white/25"
                        }`}
                      >
                        <span className="truncate">{preset.label}</span>
                        <span className="ml-1 font-mono text-[9.5px] opacity-70">
                          {preset.ratio}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="rounded-lg bg-white/[0.04] px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                Cada cena vira um PNG no tamanho de cada formato selecionado. O ZIP
                também inclui <strong>legendas.srt</strong> e{" "}
                <strong>legendas.vtt</strong>, pronto para carrossel, feed,
                thumbnail e blog. Para o vídeo, use a aba Vídeo.
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
                    {busy ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <CheckCircle2
                        size={11}
                        className="text-[var(--studio-teal)]"
                      />
                    )}
                    {message} {Math.round(progress * 100)}%
                  </p>
                </div>
              ) : null}
              {error ? (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-[11.5px] text-red-200">
                  {error}
                </p>
              ) : null}
            </>
          ) : null}

          <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
            <div className="flex items-center gap-1.5">
              <Captions size={13} className="text-[var(--studio-teal)]" />
              <span className="label">Legendas para publicar</span>
            </div>
            <p className="text-[10.5px] leading-relaxed text-muted-foreground">
              Arquivos com o tempo absoluto da timeline, prontos para YouTube,
              Hotmart, players e redes sociais.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="btn-ghost !py-1.5 text-[11px]"
                onClick={() => downloadCaptions("srt")}
              >
                <Download size={12} /> Baixar .srt
              </button>
              <button
                type="button"
                className="btn-ghost !py-1.5 text-[11px]"
                onClick={() => downloadCaptions("vtt")}
              >
                <Download size={12} /> Baixar .vtt
              </button>
            </div>
          </div>
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
          {mode === "package" ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => void exportPackage()}
              disabled={busy || packageFormats.length === 0}
            >
              {busy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              {busy ? "Gerando pacote…" : "Baixar pacote (.zip)"}
            </button>
          ) : mode === "image" ? (
            <button type="button" className="btn-primary" onClick={() => void exportImages()} disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {busy ? "Gerando…" : scope === "all" ? "Baixar imagens" : "Baixar PNG"}
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={() => void start()} disabled={busy || !support.canExport}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {busy ? "Renderizando…" : result ? "Exportar de novo" : "Começar exportação"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
