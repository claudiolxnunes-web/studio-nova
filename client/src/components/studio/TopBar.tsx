import { useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  Cloud,
  Download,
  Loader2,
  Redo2,
  Undo2,
  Wand2,
} from "lucide-react";
import { Link } from "wouter";
import { FORMAT_PRESETS } from "@shared/editor";
import { useEditorContext } from "@/store/editor";

export default function TopBar({ onExport }: { onExport: () => void }) {
  const api = useEditorContext();
  const [editingName, setEditingName] = useState(false);
  const project = api.project;
  if (!project) return null;

  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-white/[0.07] bg-[#0b0b10]/80 px-3 py-2 backdrop-blur">
      <Link
        href="/"
        className="icon-btn shrink-0"
        title="Voltar para os projetos"
      >
        <ArrowLeft size={16} />
      </Link>
      <div className="flex min-w-0 items-center gap-2">
        <span className="hidden h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#ff8c3a] to-[#e35f06] text-[13px] font-black text-[#170b03] sm:grid">
          ▶
        </span>
        {editingName ? (
          <input
            autoFocus
            defaultValue={project.name}
            onBlur={event => {
              api.renameProject(event.target.value.trim() || "Aula sem título");
              setEditingName(false);
            }}
            onKeyDown={event => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            className="studio-input max-w-[240px] py-1 text-[13px] font-semibold"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingName(true)}
            className="max-w-[38vw] truncate text-left font-[var(--font-display)] text-[13.5px] font-semibold tracking-tight hover:text-[#ffb37a] sm:max-w-[280px]"
            title="Renomear aula"
          >
            {project.name}
          </button>
        )}
        <span className="hidden items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-muted-foreground sm:flex">
          {api.saveState === "saving" ? (
            <>
              <Loader2 size={9} className="animate-spin" /> salvando
            </>
          ) : api.saveState === "error" ? (
            <>
              <Cloud size={9} /> erro ao salvar
            </>
          ) : (
            <>
              <Check size={9} className="text-[var(--studio-teal)]" /> salvo
            </>
          )}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <div className="hidden items-center gap-1 lg:flex">
          {FORMAT_PRESETS.slice(0, 6).map(preset => (
            <button
              key={preset.id}
              type="button"
              className="chip"
              data-active={project.format === preset.id}
              onClick={() => api.setFormat(preset.id)}
              title={preset.hint}
            >
              {preset.label}
              <span className="font-mono text-[9.5px] opacity-70">
                {preset.ratio}
              </span>
            </button>
          ))}
        </div>
        <div className="mx-1 hidden h-5 w-px bg-white/10 lg:block" />
        <Link
          href="/roteiro"
          className="icon-btn"
          title="Vídeo a partir do roteiro"
        >
          <Wand2 size={15} />
        </Link>
        <Link href="/ajuda" className="icon-btn" title="Tutorial de uso">
          <BookOpen size={15} />
        </Link>
        <button
          type="button"
          className="icon-btn"
          onClick={api.undo}
          disabled={!api.canUndo}
          title="Desfazer"
        >
          <Undo2 size={15} />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={api.redo}
          disabled={!api.canRedo}
          title="Refazer"
        >
          <Redo2 size={15} />
        </button>
        <button type="button" onClick={onExport} className="btn-primary ml-1">
          <Download size={14} />
          <span className="hidden sm:inline">Exportar</span>
          <span className="sm:hidden">Exportar</span>
        </button>
      </div>
    </header>
  );
}
