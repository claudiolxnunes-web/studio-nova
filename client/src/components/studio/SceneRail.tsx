import { Copy, GripVertical, Mic, Plus, Scissors, Trash2 } from "lucide-react";
import { useEditorContext } from "@/store/editor";
import { formatClock } from "@/lib/format";

export default function SceneRail() {
  const api = useEditorContext();
  const project = api.project;
  if (!project) return null;

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-white/[0.07] lg:w-[220px] lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between px-3 py-2">
        <h2 className="label">Cenas · {project.scenes.length}</h2>
        <div className="flex items-center gap-1">
          <button type="button" className="icon-btn" onClick={api.addScene} title="Nova cena">
            <Plus size={15} />
          </button>
          <button type="button" className="icon-btn" onClick={api.duplicateScene} title="Duplicar cena">
            <Copy size={14} />
          </button>
          <button type="button" className="icon-btn" onClick={api.splitScene} title="Dividir no tempo atual">
            <Scissors size={14} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={api.deleteScene}
            disabled={project.scenes.length <= 1}
            title="Excluir cena"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="scroll-thin flex gap-2 overflow-x-auto px-2 pb-2 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">
        {project.scenes.map((scene, index) => {
          const active = index === api.sceneIndex;
          const hasVoice = Boolean(scene.narration.assetId);
          return (
            <button
              key={scene.id}
              type="button"
              draggable
              onDragStart={event => event.dataTransfer.setData("text/scene-index", String(index))}
              onDragOver={event => event.preventDefault()}
              onDrop={event => {
                event.preventDefault();
                const from = Number(event.dataTransfer.getData("text/scene-index"));
                if (!Number.isNaN(from)) api.moveScene(from, index);
              }}
              onClick={() => api.setSceneIndex(index)}
              className={`group relative flex w-[150px] shrink-0 items-stretch gap-2 rounded-xl border p-1.5 text-left transition lg:w-full ${
                active
                  ? "border-[var(--studio-accent)]/60 bg-[var(--studio-accent)]/10"
                  : "border-white/[0.07] bg-white/[0.02] hover:border-white/20"
              }`}
            >
              <span
                className="relative grid h-11 w-16 shrink-0 place-items-center overflow-hidden rounded-lg"
                style={{
                  background:
                    scene.background.type === "gradient"
                      ? `linear-gradient(${scene.background.angle}deg, ${scene.background.color}, ${scene.background.color2})`
                      : scene.background.color,
                }}
              >
                <span className="font-mono text-[10px] font-semibold text-white/85">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </span>
              <span className="min-w-0 flex-1 py-0.5">
                <span className="block truncate text-[12px] font-medium text-foreground/90">{scene.name}</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                  {formatClock(scene.duration)}
                  {hasVoice ? <Mic size={9} className="text-[var(--studio-teal)]" /> : null}
                  <span className="opacity-60">{scene.layers.length} el.</span>
                </span>
              </span>
              <GripVertical
                size={12}
                className="absolute right-1 top-1 text-white/20 opacity-0 transition group-hover:opacity-100"
              />
            </button>
          );
        })}
        <button
          type="button"
          onClick={api.addScene}
          className="flex h-[58px] w-[150px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-white/15 text-[11px] text-muted-foreground transition hover:border-[var(--studio-accent)]/50 hover:text-[#ffb37a] lg:w-full"
        >
          <Plus size={14} /> Nova cena
        </button>
      </div>
    </aside>
  );
}
