import { Captions } from "lucide-react";
import { useEditorContext } from "@/store/editor";
import {
  ColorField,
  EmptyHint,
  Section,
  Segmented,
  Slider,
  Toggle,
} from "../ui";

export default function CaptionsTab() {
  const api = useEditorContext();
  const project = api.project;
  const scene = api.scene;
  if (!project || !scene) return null;
  const captions = project.captions;
  const missing = project.scenes.filter(
    item => !item.narration.words?.length
  ).length;

  return (
    <div className="space-y-5">
      <Section title="Legendas automáticas">
        <Toggle
          label="Mostrar legendas no vídeo"
          checked={captions.enabled}
          onChange={value => api.updateCaptions({ enabled: value })}
        />
        <button
          type="button"
          className="btn-primary w-full"
          disabled={api.voiceBusy || !scene.narration.assetId}
          onClick={() => void api.transcribeScene()}
        >
          <Captions size={14} /> Legendas desta cena
        </button>
        <button
          type="button"
          className="btn-ghost w-full"
          disabled={api.voiceBusy}
          onClick={() => api.applyEstimatedCaptions()}
          title="Distribui as palavras do roteiro pelo tempo do áudio, sem chamar nenhum serviço"
        >
          Sincronizar por tempo (grátis)
        </button>
        <EmptyHint>
          {missing === 0
            ? "Todas as cenas já têm legendas sincronizadas."
            : `${missing} cena(s) ainda sem legendas. Gere o áudio e toque em legendas em cada cena.`}
        </EmptyHint>
      </Section>

      <Section title="Estilo">
        <Segmented
          value={captions.position}
          onChange={value => api.updateCaptions({ position: value })}
          size="sm"
          options={[
            { value: "bottom", label: "Embaixo" },
            { value: "top", label: "Em cima" },
          ]}
        />
        <Slider
          label="Tamanho da fonte"
          min={28}
          max={96}
          step={2}
          value={captions.fontSize}
          onChange={value => api.updateCaptions({ fontSize: value })}
          format={value => `${value}px`}
        />
        <ColorField
          label="Cor do texto"
          value={captions.color}
          onChange={value => api.updateCaptions({ color: value })}
        />
        <ColorField
          label="Cor da palavra falada"
          value={captions.highlightColor}
          onChange={value => api.updateCaptions({ highlightColor: value })}
        />
        <ColorField
          label="Cor do fundo"
          value={captions.bgColor}
          onChange={value => api.updateCaptions({ bgColor: value })}
        />
        <Slider
          label="Opacidade do fundo"
          min={0}
          max={0.95}
          step={0.05}
          value={captions.bgOpacity}
          onChange={value => api.updateCaptions({ bgOpacity: value })}
          format={value => `${Math.round(value * 100)}%`}
        />
        <Slider
          label="Palavras por linha"
          min={2}
          max={12}
          step={1}
          value={captions.maxWordsPerLine}
          onChange={value => api.updateCaptions({ maxWordsPerLine: value })}
        />
        <Slider
          label="Distância da borda"
          min={24}
          max={260}
          step={4}
          value={captions.margin}
          onChange={value => api.updateCaptions({ margin: value })}
          format={value => `${value}px`}
        />
        <Toggle
          label="Legenda em caixa alta"
          checked={captions.uppercase}
          onChange={value => api.updateCaptions({ uppercase: value })}
        />
      </Section>
    </div>
  );
}
