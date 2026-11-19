import { useCallback, useEffect, useRef, useState } from "react";
import {
  Archive,
  ArrowUpRight,
  BookOpen,
  Copy,
  Film,
  ImageIcon,
  Layers,
  Mic,
  Play,
  Plus,
  Radio,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  Wand2,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  createProject,
  formatPreset,
  projectKindPreset,
  totalDuration,
  type Project,
  type ProjectKind,
} from "@shared/editor";
import { formatClock } from "@/lib/format";
import {
  deleteProject,
  garbageCollectMedia,
  listProjects,
  requestPersistentStorage,
  saveProject,
} from "@/lib/storage";

const KIND_ICONS: Record<ProjectKind, typeof Film> = {
  aula: Film,
  post: ImageIcon,
  carrossel: Layers,
  blog: Sparkles,
  live: Radio,
  anuncio: Sparkles,
};

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [, navigate] = useLocation();

  const refresh = useCallback(async () => {
    const items = await listProjects();
    setProjects(items);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    // Local-first only works if the browser is asked to keep the data and if
    // blobs left behind by old versions are cleaned up.
    void requestPersistentStorage();
    void garbageCollectMedia().catch(error => {
      console.warn("[storage] limpeza adiada", error);
    });
  }, [refresh]);

  const create = async (kind: ProjectKind, title?: string) => {
    const preset = projectKindPreset(kind);
    const project = createProject(kind, title?.trim() || preset.label);
    await saveProject(project);
    navigate(`/aula/${project.id}`);
  };

  const duplicate = async (project: Project) => {
    const copy: Project = {
      ...structuredClone(project),
      id: `project_${Date.now().toString(36)}`,
      name: `${project.name} (cópia)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveProject(copy);
    await refresh();
  };

  const remove = async (project: Project) => {
    const ok = window.confirm(
      `Excluir "${project.name}"? As mídias usadas só por este projeto também serão removidas.`,
    );
    if (!ok) return;
    await deleteProject(project.id);
    await refresh();
  };

  const exportArchive = async (project: Project) => {
    try {
      const { exportProjectArchive, projectArchiveFileName } = await import(
        "@/lib/projectArchive"
      );
      const blob = await exportProjectArchive(project);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = projectArchiveFileName(project);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (error) {
      window.alert(
        `Não foi possível exportar o projeto: ${(error as Error).message}`,
      );
    }
  };

  const importArchive = async (file: File) => {
    setImporting(true);
    try {
      const { importProjectArchive } = await import("@/lib/projectArchive");
      const project = await importProjectArchive(file);
      await refresh();
      navigate(`/aula/${project.id}`);
    } catch (error) {
      window.alert(
        `Não foi possível importar o projeto: ${(error as Error).message}`,
      );
    } finally {
      setImporting(false);
    }
  };

  const kinds: ProjectKind[] = [
    "aula",
    "post",
    "carrossel",
    "blog",
    "live",
    "anuncio",
  ];

  return (
    <div className="studio-shell min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-[#ff8c3a] to-[#e35f06] text-[13px] font-black text-[#170b03]">
            ▶
          </span>
          <span className="wordmark whitespace-nowrap text-[14.5px] tracking-tight sm:text-[16px]">
            Studio Nova
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            href="/avatar"
            className="btn-ghost !px-2 !py-1.5 text-[11.5px]"
            title="Estúdio de avatares falantes"
          >
            <Sparkles size={13} />{" "}
            <span className="hidden sm:inline">Avatar Studio</span>
          </Link>
          <Link
            href="/ajuda"
            className="btn-ghost !px-2 !py-1.5 text-[11.5px]"
            title="Tutorial de uso"
          >
            <BookOpen size={13} />{" "}
            <span className="hidden sm:inline">Tutorial</span>
          </Link>
          <button
            type="button"
            className="btn-ghost whitespace-nowrap !px-2 !py-1.5 text-[11.5px]"
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            title="Importar projeto .nova.zip"
          >
            <Upload size={13} />{" "}
            <span className="hidden sm:inline">
              {importing ? "Importando…" : "Importar"}
            </span>
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".zip,.nova.zip,application/zip"
            className="hidden"
            onChange={event => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void importArchive(file);
            }}
          />
          <button
            type="button"
            className="btn-primary whitespace-nowrap !px-2.5 !py-1.5 text-[11.5px] sm:!px-3.5 sm:!py-2 sm:text-[12.5px]"
            onClick={() => void create("aula", name)}
          >
            <Plus size={14} />{" "}
            <span className="hidden sm:inline">Novo projeto</span>
            <span className="sm:hidden">Novo</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16">
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,122,26,0.14),rgba(10,10,13,0.4)_45%,rgba(79,209,197,0.08))] px-5 py-8 sm:px-9 sm:py-10">
          <div className="max-w-2xl">
            <span className="chip" data-active="true">
              <Sparkles size={11} /> Aulas, lives, blogs e redes sociais
            </span>
            <h1 className="wordmark mt-3 text-[30px] leading-[1.05] sm:text-[42px]">
              Um estúdio para tudo que você publica.
            </h1>
            <p className="mt-3 max-w-xl text-[13.5px] leading-relaxed text-muted-foreground">
              O mesmo editor faz aula em vídeo para a Hotmart, carrossel para o
              Instagram, capa de blog, thumbnail de live e anúncio vertical —
              com narração em português brasileiro, avatar e legendas quando
              fizer sentido.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <input
                className="studio-input max-w-[260px]"
                placeholder="Nome do projeto (opcional)"
                value={name}
                onChange={event => setName(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter") void create("aula", name);
                }}
              />
              <button
                type="button"
                className="btn-primary"
                onClick={() => void create("aula", name)}
              >
                <Plus size={14} /> Criar aula em vídeo
              </button>
              <Link href="/roteiro" className="btn-ghost !py-2 text-[12px]">
                <Wand2 size={14} /> Colar roteiro e gerar vídeo
              </Link>
              <Link href="/postagem" className="btn-ghost !py-2 text-[12px]">
                <ImageIcon size={14} /> Colar roteiro e gerar post
              </Link>
              <Link href="/criar-video" className="btn-3d !py-2 text-[12px]">
                <Play size={14} /> Avatar fala o texto
              </Link>
            </div>
            <div className="mt-5 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Mic size={12} className="text-[var(--studio-teal)]" /> 3 vozes
                neurais pt-BR
              </span>
              <span className="flex items-center gap-1.5">
                <UserRound size={12} className="text-[var(--studio-teal)]" />{" "}
                avatar com sua foto
              </span>
              <span className="flex items-center gap-1.5">
                <Film size={12} className="text-[var(--studio-teal)]" /> vídeo,
                PNG e carrossel
              </span>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="wordmark text-[15px]">Começar um projeto</h2>
            <span className="text-[11px] text-muted-foreground">
              escolha o que você vai publicar
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {kinds.map((kind, idx) => {
              const preset = projectKindPreset(kind);
              const format = formatPreset(preset.format);
              const Icon = KIND_ICONS[kind];
              const cores: string[] = [
                "card-vivo-roxo",
                "card-vivo-azul",
                "card-vivo-rosa",
                "card-vivo-laranja",
                "card-vivo-teal",
                "card-vivo-esmeralda",
              ];
              const cor = cores[idx % cores.length];
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => void create(kind, name)}
                  className={`card-3d ${cor} group flex flex-col items-start gap-2 p-5 text-left`}
                >
                  <div className="flex items-center gap-2">
                    <div className="icon-vivo">
                      <Icon size={18} />
                    </div>
                    <div className="card-glow" />
                    <span
                      className={`badge-degrade text-[9px] font-black`}
                    >
                      {format.ratio}
                    </span>
                  </div>
                  <span className="texto-degrade font-bold text-[13px] leading-none group-hover:opacity-90 transition-opacity">
                    {preset.label}
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-relaxed text-white/75 line-clamp-2">
                    {preset.description}
                  </span>
                  <div className="mt-auto flex items-center gap-1.5 pt-3 border-t border-white/6">
                    <span className="text-[9.5px] text-white/65">
                      {preset.exportHint}
                    </span>
                    <span className="ml-auto text-[10px] text-white/80 font-bold tracking-wide">
                      Abrir →
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-9">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="wordmark text-[15px]">Seus projetos</h2>
            <span className="text-[11px] text-muted-foreground">
              {projects.length === 0
                ? "nenhum ainda"
                : `${projects.length} salvo(s) neste navegador`}
            </span>
          </div>

          {loading ? (
            <div className="panel p-6 text-[12px] text-muted-foreground">
              Carregando seus projetos…
            </div>
          ) : projects.length === 0 ? (
            <div className="panel flex flex-col items-center gap-3 p-8 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.03]">
                <Film size={20} className="text-[var(--studio-accent)]" />
              </span>
              <div>
                <p className="text-[13.5px] font-medium">
                  Escolha um tipo de projeto acima
                </p>
                <p className="mt-1 max-w-md text-[11.5px] leading-relaxed text-muted-foreground">
                  A aula já vem com abertura, conteúdo e encerramento. O
                  carrossel vem com quatro slides prontos, a capa de blog em
                  1200×630 e a chamada de live em 16:9.
                </p>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void create("aula", "Aula 01 — Boas-vindas")}
              >
                <Plus size={14} /> Criar minha primeira aula
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map(project => {
                const preset = formatPreset(project.format);
                const kind = projectKindPreset(project.kind);
                const duration = totalDuration(project);
                const narrated = project.scenes.filter(
                  scene => scene.narration.assetId
                ).length;
                return (
                  <article
                    key={project.id}
                    className="group panel flex flex-col gap-3 p-3 transition hover:border-white/20"
                  >
                    <div
                      className="relative grid place-items-center overflow-hidden rounded-xl border border-white/10"
                      style={{
                        aspectRatio: `${project.width} / ${project.height}`,
                        maxHeight: 180,
                        background:
                          project.scenes[0]?.background.type === "gradient"
                            ? `linear-gradient(${project.scenes[0].background.angle}deg, ${project.scenes[0].background.color}, ${project.scenes[0].background.color2})`
                            : (project.scenes[0]?.background.color ??
                              "#14141b"),
                      }}
                    >
                      <span className="font-mono text-[10px] uppercase tracking-widest text-white/60">
                        {preset.ratio} · {formatClock(duration)}
                      </span>
                      <span className="absolute right-1.5 top-1.5 rounded-md bg-black/50 px-1.5 py-0.5 text-[9.5px] text-white/80 backdrop-blur">
                        {kind.label}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-[13px] font-semibold">
                        {project.name}
                      </h3>
                      <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                        {project.scenes.length} cenas · {narrated} com narração
                        ·{" "}
                        {new Date(project.updatedAt).toLocaleDateString(
                          "pt-BR",
                          {
                            day: "2-digit",
                            month: "short",
                          }
                        )}
                      </p>
                    </div>
                    <div className="mt-auto flex items-center gap-1.5">
                      <Link
                        href={`/aula/${project.id}`}
                        className="btn-primary flex-1 !py-1.5 !text-[12px]"
                      >
                        Abrir <ArrowUpRight size={12} />
                      </Link>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => void duplicate(project)}
                        title="Duplicar"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => void exportArchive(project)}
                        title="Exportar projeto (.nova.zip) com mídias e legendas"
                      >
                        <Archive size={13} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn hover:!text-red-300"
                        onClick={() => void remove(project)}
                        title="Excluir"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-10 grid gap-3 sm:grid-cols-3">
          {[
            {
              title: "1. Monte as cenas",
              text: "Textos, imagens, vídeos de apoio, formas e avatares com transições e efeitos.",
            },
            {
              title: "2. Escreva e narre",
              text: "Roteiro por cena, voz neural em pt-BR e legendas palavra por palavra.",
            },
            {
              title: "3. Exporte para cada canal",
              text: "Vídeo MP4 com áudio, imagem PNG da cena ou todas as cenas do carrossel.",
            },
          ].map(item => (
            <div key={item.title} className="panel-quiet p-3">
              <p className="text-[12px] font-semibold">{item.title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {item.text}
              </p>
            </div>
          ))}
        </section>

        <p className="mt-8 text-center text-[10.5px] text-muted-foreground/70">
          Seus projetos ficam salvos neste navegador (IndexedDB). Use{" "}
          <strong>Exportar projeto</strong> para baixar um arquivo{" "}
          <code>.nova.zip</code> com todas as mídias e legendas — é o seu backup
          portátil. Nada é enviado para servidores de terceiros, exceto o texto
          enviado para gerar a narração e a imagem gerada por IA.
        </p>
      </main>
    </div>
  );
}
