import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Lock, LockOpen, Trash2 } from "lucide-react";
import type { Layer } from "@shared/editor";
import { useEditorContext } from "@/store/editor";
import { EmptyHint } from "../ui";

function layerIcon(layer: Layer): string {
  if (layer.kind === "text") return "T";
  if (layer.kind === "image") return "▣";
  if (layer.kind === "video") return "▶";
  if (layer.kind === "shape") return "◼";
  return "☺";
}

export default function LayersTab() {
  const api = useEditorContext();
  const scene = api.scene;
  if (!scene) return null;

  const layers = [...scene.layers].reverse();

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        A lista mostra a ordem de empilhamento: o primeiro item fica na frente. Use as setas para reorganizar,
        clique para selecionar e edite as propriedades na aba <strong>Elemento</strong>.
      </p>

      {scene.layers.length === 0 ? (
        <EmptyHint>Esta cena ainda não tem elementos. Adicione texto, imagem, vídeo, forma ou avatar.</EmptyHint>
      ) : (
        <div className="space-y-1.5">
          {layers.map(layer => {
            const active = api.selectedLayerId === layer.id;
            return (
              <div
                key={layer.id}
                onClick={() => api.selectLayer(layer.id)}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 transition ${
                  active
                    ? "border-[var(--studio-accent)]/60 bg-[var(--studio-accent)]/10"
                    : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"
                }`}
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/8 text-[11px] text-foreground/80">
                  {layerIcon(layer)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11.5px] font-medium">
                    {layer.kind === "text" ? layer.text.slice(0, 34) || layer.name : layer.name}
                  </span>
                  <span className="text-[9.5px] text-muted-foreground">
                    {Math.round(layer.x)},{Math.round(layer.y)} · {Math.round(layer.w)}×{Math.round(layer.h)}
                  </span>
                </span>
                <button
                  type="button"
                  className="icon-btn !h-6 !w-6"
                  onClick={event => {
                    event.stopPropagation();
                    api.moveLayerOrder(layer.id, 1);
                  }}
                  title="Subir"
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  type="button"
                  className="icon-btn !h-6 !w-6"
                  onClick={event => {
                    event.stopPropagation();
                    api.moveLayerOrder(layer.id, -1);
                  }}
                  title="Descer"
                >
                  <ArrowDown size={12} />
                </button>
                <button
                  type="button"
                  className="icon-btn !h-6 !w-6"
                  onClick={event => {
                    event.stopPropagation();
                    api.updateLayer(layer.id, { hidden: !layer.hidden });
                  }}
                  title={layer.hidden ? "Mostrar" : "Ocultar"}
                >
                  {layer.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
                <button
                  type="button"
                  className="icon-btn !h-6 !w-6"
                  onClick={event => {
                    event.stopPropagation();
                    api.updateLayer(layer.id, { locked: !layer.locked });
                  }}
                  title={layer.locked ? "Destravar" : "Travar"}
                >
                  {layer.locked ? <Lock size={12} /> : <LockOpen size={12} />}
                </button>
                <button
                  type="button"
                  className="icon-btn !h-6 !w-6"
                  onClick={event => {
                    event.stopPropagation();
                    api.duplicateLayer(layer.id);
                  }}
                  title="Duplicar"
                >
                  <Copy size={12} />
                </button>
                <button
                  type="button"
                  className="icon-btn !h-6 !w-6 hover:!text-red-300"
                  onClick={event => {
                    event.stopPropagation();
                    api.deleteLayer(layer.id);
                  }}
                  title="Excluir"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
