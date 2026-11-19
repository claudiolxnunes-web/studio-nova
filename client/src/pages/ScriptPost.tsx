/**
 * Script → ready post.
 *
 * Paste a script, choose post/carousel/story, and receive the slides as PNG,
 * the caption, hashtags and alt text — ready to publish without opening the
 * timeline editor.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Copy,
  Download,
  ImageIcon,
  Loader2,
  Package,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Link } from "wouter";
import {
  formatPreset,
  type FormatPresetId,
  type Project,
} from "@shared/editor";
import { Segmented, Select, Toggle } from "@/components/studio/ui";
import { exportSceneImage, downloadBlob } from "@/engine/export";
import { formatClock } from "@/lib/format";
import {
  generatePostFromScript,
  type PostKind,
  type PostProgress,
} from "@/lib/scriptPost";
import { splitScript } from "@/lib/scriptVideo";

const FORMAT_OPTIONS: Array<{ value: FormatPresetId; label: string }> = [
  { value: "feed", label: "Feed 4:5 · 1080×1350" },
  { value: "square", label: "Quadrado 1:1 · 1080×1080" },
  { value: "stories", label: "Stories 9:16 · 1080×1920" },
  { value: "pinterest", label: "Pinterest 2:3 · 1000×1500" },
  { value: "blog", label: "Capa de blog · 1200×630" },
];

const KIND_OPTIONS = [
  { value: "post" as const, label: "Post único" },
  { value: "carrossel" as const, label: "Carrossel" },
  { value: "story" as const, label: "Story" },
];

interface ResultView {
  project: Project;
  caption: string;
  hashtags: string;
  altTexts: string[];
  previews: string[];
}

function defaultFormat(kind: PostKind): FormatPresetId {
  if (kind === "story") return "stories";
  return "feed";
}

function downloadText(text: string, filename: string, mime = "text/plain") {
  downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename);
}

export default function ScriptPost() {
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [kind, setKind] = useState<PostKind>("carrossel");
  const [format, setFormat] = useState<FormatPresetId>("feed");
  const [theme, setTheme] = useState("");
  const [withImages, setWithImages] = useState(true);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultView | null>(null);
  const [packageBusy, setPackageBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const previewUrls = useRef<string[]>([]);

  const chunks = useMemo(() => splitScript(script), [script]);
  const estimatedSlides =
    kind === "post"
      ? 1
      : Math.min(
          kind === "story" ? 4 : 8,
          chunks.length > 1 ? chunks.length + 1 : 3,
        );

  useEffect(() => {
    return () => {
      previewUrls.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const chooseKind = (next: PostKind) => {
    setKind(next);
    setFormat(defaultFormat(next));
  };

  const generate = async () => {
    if (!script.trim()) {
      setError("Cole o roteiro antes de gerar a postagem.");
      return;
    }
    setBusy(true);
    setError(null);
    setProgress(0);
    setStep("Montando os slides…");
    previewUrls.current.forEach(url => URL.revokeObjectURL(url));
    previewUrls.current = [];
    setResult(null);

    try {
      const generated = await generatePostFromScript({
        script,
        title,
        kind,
        format,
        theme,
        withImages,
        onProgress: (info: PostProgress) => {
          setStep(info.step);
          setProgress(
            info.total > 0 ? Math.min(0.9, (info.index + 1) / info.total) : 0.1,
          );
        },
      });

      setStep("Gerando as prévias…");
      const previews: string[] = [];
      for (let index = 0; index < generated.project.scenes.length; index += 1) {
        const blob = await exportSceneImage(generated.project, index, {
          scale: 0.42,
        });
        previews.push(URL.createObjectURL(blob));
      }
      previewUrls.current = previews;
      setResult({ ...generated, previews });
      setProgress(1);
      setStep("Postagem pronta");
    } catch (caught) {
      setError((caught as Error).message || "Não consegui gerar a postagem.");
    } finally {
      setBusy(false);
    }
  };

  const downloadPackage = async () => {
    if (!result) return;
    setPackageBusy(true);
    setError(null);
    setProgress(0);
    try {
      const { exportPostPackage, postPackageFileName } = await import(
        "@/engine/package"
      );
      const blob = await exportPostPackage(result.project, {
        meta: {
          caption: result.caption,
          hashtags: result.hashtags,
          altTexts: result.altTexts,
        },
        onProgress: (value, message) => {
          setProgress(value);
          setStep(message);
        },
      });
      downloadBlob(blob, postPackageFileName(result.project));
      setStep("Pacote baixado");
      setProgress(1);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setPackageBusy(false);
    }
  };

  const copyCaption = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(
        `${result.caption}\n\n${result.hashtags}`,
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Não foi possível copiar. Selecione o texto manualmente.");
    }
  };

  const reset = () => {
    previewUrls.current.forEach(url => URL.revokeObjectURL(url));
    previewUrls.current = [];
    setResult(null);
    setError(null);
    setProgress(0);
    setStep("");
  };

  if (result) {
    return (
      <div className="studio-shell min-h-screen">
        <header className="border-b border-white/8 bg-[#0A0A0F]/85 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-4">
            <button
              type="button"
              className="btn-ghost h-8 w-8 p-0"
              onClick={reset}
              aria-label="Gerar outra postagem"
            >
              <ArrowLeft size={15} />
            </button>
            <div>
              <p className="wordmark text-[14px] leading-none">
                Postagem pronta
              </p>
              <p className="mt-1 text-[10.5px] text-muted-foreground">
                {result.project.width}×{result.project.height} ·{" "}
                {result.project.scenes.length} slide(s) ·{" "}
                {formatPreset(result.project.format).label}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Link href="/" className="btn-ghost text-[11.5px]">
                Início
              </Link>
              <Link
                href={`/aula/${result.project.id}`}
                className="btn-ghost text-[11.5px]"
              >
                Abrir no editor <ArrowUpRight size={12} />
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto grid max-w-[1200px] gap-5 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="panel p-4">
            <div className="mb-3 flex items-center gap-2">
              <ImageIcon size={15} className="text-[var(--studio-accent)]" />
              <h2 className="text-[13px] font-semibold">Slides prontos</h2>
              <span className="ml-auto text-[10.5px] text-muted-foreground">
                Toque em baixar para publicar
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {result.previews.map((url, index) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="group overflow-hidden rounded-xl border border-white/10 bg-black/30"
                  title="Abrir imagem em tamanho real"
                >
                  <img
                    src={url}
                    alt={result.altTexts[index] ?? `Slide ${index + 1}`}
                    className="w-full object-cover transition group-hover:opacity-90"
                  />
                  <div className="flex items-center justify-between px-2 py-1.5 text-[10.5px] text-muted-foreground">
                    <span>Slide {index + 1}</span>
                    <Download size={11} />
                  </div>
                </a>
              ))}
            </div>
          </section>

          <aside className="space-y-3">
            <section className="panel p-4">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-[var(--studio-teal)]" />
                <h2 className="text-[13px] font-semibold">Legenda pronta</h2>
              </div>
              <textarea
                readOnly
                value={`${result.caption}\n\n${result.hashtags}`}
                className="studio-input mt-3 min-h-[240px] resize-y text-[12px] leading-relaxed"
              />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="btn-ghost !py-1.5 text-[11px]"
                  onClick={() => void copyCaption()}
                >
                  {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                  {copied ? "Copiado" : "Copiar legenda"}
                </button>
                <button
                  type="button"
                  className="btn-ghost !py-1.5 text-[11px]"
                  onClick={() =>
                    downloadText(
                      `${result.caption}\n\n${result.hashtags}`,
                      "legenda.txt",
                    )
                  }
                >
                  <Download size={12} /> .txt
                </button>
                <button
                  type="button"
                  className="btn-ghost !py-1.5 text-[11px]"
                  onClick={() =>
                    downloadText(result.hashtags, "hashtags.txt")
                  }
                >
                  <Download size={12} /> Hashtags
                </button>
                <button
                  type="button"
                  className="btn-ghost !py-1.5 text-[11px]"
                  onClick={() =>
                    downloadText(
                      result.altTexts.join("\n"),
                      "textos-alternativos.txt",
                    )
                  }
                >
                  <Download size={12} /> Alt text
                </button>
              </div>
            </section>

            <section className="panel space-y-3 p-4">
              <div className="flex items-center gap-2">
                <Package size={15} className="text-[var(--studio-accent)]" />
                <h2 className="text-[13px] font-semibold">
                  Pacote de publicação
                </h2>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                ZIP com todos os slides em PNG, legenda, hashtags e textos
                alternativos. Se houver narração, SRT e VTT também entram. É só
                descompactar e publicar.
              </p>
              <button
                type="button"
                className="btn-primary w-full"
                onClick={() => void downloadPackage()}
                disabled={packageBusy}
              >
                {packageBusy ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                {packageBusy ? "Gerando pacote…" : "Baixar pacote (.zip)"}
              </button>
              {packageBusy ? (
                <div className="space-y-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[var(--studio-accent)]"
                      style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                  </div>
                  <p className="text-[10.5px] text-muted-foreground">
                    {step} {Math.round(progress * 100)}%
                  </p>
                </div>
              ) : null}
            </section>

            <button
              type="button"
              className="btn-ghost w-full !py-2 text-[11.5px]"
              onClick={reset}
            >
              <Wand2 size={13} /> Gerar outra postagem
            </button>

            {error ? (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-[11.5px] text-red-200">
                {error}
              </p>
            ) : null}
          </aside>
        </main>
      </div>
    );
  }

  return (
    <div className="studio-shell min-h-screen">
      <header className="border-b border-white/8 bg-[#0A0A0F]/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1100px] items-center gap-3 px-4">
          <Link href="/" className="btn-ghost h-8 w-8 p-0" aria-label="Voltar">
            <ArrowLeft size={15} />
          </Link>
          <div>
            <p className="wordmark text-[14px] leading-none">
              Postagem a partir do roteiro
            </p>
            <p className="mt-1 text-[10.5px] text-muted-foreground">
              Cole o texto e receba os slides, a legenda e as hashtags prontos
            </p>
          </div>
          <span className="ml-auto hidden items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[10px] text-muted-foreground sm:flex">
            <Sparkles size={10} /> slides + legenda + imagens grátis
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1100px] gap-4 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="panel space-y-4 p-4">
          <label className="block space-y-1.5">
            <span className="label">Nome da postagem (opcional)</span>
            <input
              className="studio-input"
              placeholder="Ex.: 3 passos para organizar a rotina"
              value={title}
              onChange={event => setTitle(event.target.value)}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="label">Roteiro</span>
            <textarea
              className="studio-input min-h-[280px] resize-y text-[12.5px] leading-relaxed"
              placeholder={`Cole o texto que você quer publicar.

Exemplo:
Você não precisa de mais tempo, precisa de menos decisões.
O primeiro passo é escolher uma única prioridade por dia.
O segundo é reservar um bloco de 30 minutos sem notificações.
O terceiro é revisar no fim do dia e ajustar amanhã.`}
              value={script}
              onChange={event => setScript(event.target.value)}
            />
          </label>

          <div className="flex flex-wrap items-center gap-3 text-[10.5px] text-muted-foreground">
            <span>{script.trim().length} caracteres</span>
            <span>{chunks.length} bloco(s) de texto</span>
            <span>≈ {estimatedSlides} slide(s)</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <span className="label">Tipo de postagem</span>
              <Segmented
                value={kind}
                onChange={value => chooseKind(value)}
                options={KIND_OPTIONS}
              />
            </div>
            <label className="block space-y-1.5">
              <span className="label">Formato</span>
              <Select
                value={format}
                onChange={setFormat}
                options={FORMAT_OPTIONS}
              />
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="label">Tema das imagens (opcional)</span>
            <input
              className="studio-input"
              placeholder="Ex.: produtividade, estudos, finanças, rotina"
              value={theme}
              onChange={event => setTheme(event.target.value)}
            />
            <span className="block text-[10px] leading-relaxed text-muted-foreground">
              Ajuda a buscar fotos mais coerentes no Openverse (grátis) e nos
              bancos configurados em Ajustes.
            </span>
          </label>

          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div>
              <p className="text-[12px] font-medium">Buscar imagens grátis</p>
              <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                Openverse sempre; Pexels/Pixabay se estiverem configurados.
              </p>
            </div>
            <Toggle
              label="Ativar busca"
              checked={withImages}
              onChange={setWithImages}
            />
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
                {step} {Math.round(progress * 100)}%
              </p>
            </div>
          ) : null}

          <button
            type="button"
            className="btn-primary w-full"
            onClick={() => void generate()}
            disabled={busy}
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Wand2 size={14} />
            )}
            {busy ? "Montando a postagem…" : "Gerar postagem pronta"}
          </button>
          <p className="text-[10.5px] leading-relaxed text-muted-foreground">
            O texto vira capa + slides + chamada final. O estúdio busca imagens
            gratuitas, monta os slides, gera a legenda e as hashtags e salva o
            projeto para você editar depois se quiser.
          </p>
        </section>

        <aside className="space-y-3">
          <section className="panel p-4">
            <h2 className="text-[13px] font-semibold">O que sai pronto</h2>
            <ul className="mt-3 space-y-2 text-[11px] leading-relaxed text-muted-foreground">
              <li>✓ Slides em PNG no formato escolhido</li>
              <li>✓ Legenda completa para colar na rede</li>
              <li>✓ Hashtags sugeridas</li>
              <li>✓ Textos alternativos para acessibilidade</li>
              <li>✓ SRT/VTT quando houver narração</li>
              <li>✓ ZIP pronto para download</li>
              <li>✓ Projeto salvo no editor</li>
            </ul>
          </section>
          <section className="panel p-4">
            <h2 className="text-[13px] font-semibold">Ideal para</h2>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Carrossel educativo, post de dica, capa de blog, story de
              lançamento e reaproveitamento de uma aula em conteúdo social.
            </p>
            <p className="mt-3 text-[10.5px] text-muted-foreground">
              Tempo estimado: {formatClock(Math.max(8, chunks.length * 3))} para
              gerar os slides e as imagens.
            </p>
          </section>
        </aside>
      </main>
    </div>
  );
}
