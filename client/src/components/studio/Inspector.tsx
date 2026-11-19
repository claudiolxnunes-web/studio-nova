import { useEffect, useState } from "react";
import {
  Captions,
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
  Mic,
  Settings2,
  Shapes,
  SlidersHorizontal,
  Type,
  UserRound,
} from "lucide-react";
import { useEditorContext } from "@/store/editor";
import CaptionsTab from "./tabs/CaptionsTab";
import LayerTab from "./tabs/LayerTab";
import LayersTab from "./tabs/LayersTab";
import MediaTab from "./tabs/MediaTab";
import ProjectTab from "./tabs/ProjectTab";
import SceneTab from "./tabs/SceneTab";
import VoiceTab from "./tabs/VoiceTab";

type TabId = "scene" | "layers" | "layer" | "voice" | "captions" | "media" | "project";

const TABS: Array<{ id: TabId; label: string; icon: typeof Layers }> = [
  { id: "scene", label: "Cena", icon: LayoutTemplate },
  { id: "layers", label: "Camadas", icon: Layers },
  { id: "layer", label: "Elemento", icon: SlidersHorizontal },
  { id: "voice", label: "Voz", icon: Mic },
  { id: "captions", label: "Legenda", icon: Captions },
  { id: "media", label: "Mídia", icon: ImageIcon },
  { id: "project", label: "Ajustes", icon: Settings2 },
];

export default function Inspector() {
  const api = useEditorContext();
  const [tab, setTab] = useState<TabId>("scene");

  useEffect(() => {
    if (api.selectedLayerId) setTab("layer");
  }, [api.selectedLayerId]);

  return (
    <aside className="flex max-h-[46vh] w-full shrink-0 flex-col border-t border-white/[0.07] bg-[#0d0d12] lg:max-h-none lg:w-[336px] lg:border-l lg:border-t-0">
      <div className="flex flex-wrap items-center gap-1 border-b border-white/[0.07] px-2 py-1.5">
        <span className="mr-1 hidden text-[10px] uppercase tracking-wider text-muted-foreground sm:block">Adicionar</span>
        <button type="button" className="btn-ghost !px-2 !py-1 text-[11px]" onClick={() => api.addLayer("text")}>
          <Type size={12} /> Texto
        </button>
        <button type="button" className="btn-ghost !px-2 !py-1 text-[11px]" onClick={() => api.addLayer("shape")}>
          <Shapes size={12} /> Forma
        </button>
        <button type="button" className="btn-ghost !px-2 !py-1 text-[11px]" onClick={() => api.addLayer("image")}>
          <ImageIcon size={12} /> Imagem
        </button>
        <button type="button" className="btn-ghost !px-2 !py-1 text-[11px]" onClick={() => api.addLayer("video")}>
          <Layers size={12} /> Vídeo
        </button>
        <button type="button" className="btn-ghost !px-2 !py-1 text-[11px]" onClick={() => api.addLayer("avatar")}>
          <UserRound size={12} /> Avatar
        </button>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-white/[0.07] px-2 py-1.5">
        {TABS.map(item => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium transition ${
                active
                  ? "bg-[var(--studio-accent)]/15 text-[#ffc59b]"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              }`}
            >
              <Icon size={12.5} />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto px-3 py-3">
        {tab === "scene" ? <SceneTab /> : null}
        {tab === "layers" ? <LayersTab /> : null}
        {tab === "layer" ? <LayerTab /> : null}
        {tab === "voice" ? <VoiceTab /> : null}
        {tab === "captions" ? <CaptionsTab /> : null}
        {tab === "media" ? <MediaTab /> : null}
        {tab === "project" ? <ProjectTab /> : null}
      </div>
    </aside>
  );
}
