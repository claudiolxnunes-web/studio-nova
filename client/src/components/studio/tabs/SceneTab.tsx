import { Wand2 } from "lucide-react";
import type { SceneBackground, TransitionType } from "@shared/editor";
import { narrationLength, SCENE_TEMPLATES } from "@shared/editor";
import { useEditorContext } from "@/store/editor";
import {
  ColorField,
  EmptyHint,
  Field,
  Section,
  Segmented,
  Select,
  Slider,
  Toggle,
} from "../ui";

export default function SceneTab() {
  const api = useEditorContext();
  const scene = api.scene;
  const project = api.project;
  if (!scene || !project) return null;

  const images = project.media.filter(asset => asset.kind === "image");
  const videos = project.media.filter(asset => asset.kind === "video");

  const setBackground = (patch: Partial<SceneBackground>) =>
    api.updateBackground(patch);

  return (
    <div className="space-y-5">
      <Section
        title="Modelos de cena"
        description="Substituem os elementos atuais por um layout pronto, já ajustado ao formato do projeto."
      >
        <div className="grid grid-cols-2 gap-1.5">
          {SCENE_TEMPLATES.map(template => (
            <button
              key={template.id}
              type="button"
              onClick={() => api.applyTemplate(template.id)}
              title={template.hint}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[11px] font-medium text-foreground/85 transition hover:border-[var(--studio-accent)]/50 hover:text-[#ffc59b]"
            >
              {template.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Cena">
        <Field label="Nome da cena">
          <input
            className="studio-input"
            value={scene.name}
            onChange={event => api.updateScene({ name: event.target.value })}
          />
        </Field>
        <Slider
          label="Duração"
          min={1}
          max={40}
          step={0.5}
          value={scene.duration}
          onChange={value => api.updateScene({ duration: value })}
          format={value => `${value.toFixed(1)}s`}
        />
        {narrationLength(scene.narration) ? (
          <button
            type="button"
            className="btn-ghost w-full"
            onClick={() =>
              api.updateScene({
                duration: Number(
                  (narrationLength(scene.narration) + 0.7).toFixed(2)
                ),
              })
            }
          >
            <Wand2 size={13} /> Ajustar duração à narração (
            {narrationLength(scene.narration).toFixed(1)}s)
          </button>
        ) : null}
      </Section>

      <Section title="Transição de entrada">
        <Segmented<TransitionType>
          value={scene.transition.type}
          onChange={value => api.updateTransition({ type: value })}
          options={[
            { value: "none", label: "Corte" },
            { value: "fade", label: "Fade" },
            { value: "slide", label: "Deslizar" },
            { value: "zoom", label: "Zoom" },
          ]}
        />
        {scene.transition.type !== "none" ? (
          <Slider
            label="Velocidade da transição"
            min={0.15}
            max={1.5}
            step={0.05}
            value={scene.transition.duration}
            onChange={value => api.updateTransition({ duration: value })}
            format={value => `${value.toFixed(2)}s`}
          />
        ) : null}
      </Section>

      <Section title="Fundo">
        <Segmented
          value={scene.background.type}
          onChange={value => setBackground({ type: value })}
          options={[
            { value: "gradient", label: "Gradiente" },
            { value: "solid", label: "Cor" },
            { value: "image", label: "Imagem" },
            { value: "video", label: "Vídeo" },
          ]}
          size="sm"
        />
        {scene.background.type === "solid" ? (
          <ColorField
            label="Cor de fundo"
            value={scene.background.color}
            onChange={value => setBackground({ color: value })}
          />
        ) : null}
        {scene.background.type === "gradient" ? (
          <>
            <ColorField
              label="Cor inicial"
              value={scene.background.color}
              onChange={value => setBackground({ color: value })}
            />
            <ColorField
              label="Cor final"
              value={scene.background.color2}
              onChange={value => setBackground({ color2: value })}
            />
            <Slider
              label="Ângulo"
              min={0}
              max={360}
              step={5}
              value={scene.background.angle}
              onChange={value => setBackground({ angle: value })}
              format={value => `${value}°`}
            />
          </>
        ) : null}
        {scene.background.type === "image" ||
        scene.background.type === "video" ? (
          <>
            <Field
              label={
                scene.background.type === "image"
                  ? "Imagem de fundo"
                  : "Vídeo de fundo"
              }
            >
              <Select
                value={scene.background.mediaId ?? ""}
                onChange={value =>
                  setBackground({ mediaId: value || undefined })
                }
                options={[
                  { value: "", label: "Selecione…" },
                  ...(scene.background.type === "image" ? images : videos).map(
                    asset => ({
                      value: asset.id,
                      label: asset.name,
                    })
                  ),
                ]}
              />
            </Field>
            <Slider
              label="Desfoque"
              min={0}
              max={40}
              step={1}
              value={scene.background.blur}
              onChange={value => setBackground({ blur: value })}
              format={value => `${value}px`}
            />
            <Slider
              label="Escurecer"
              min={0}
              max={0.85}
              step={0.05}
              value={scene.background.dim}
              onChange={value => setBackground({ dim: value })}
              format={value => `${Math.round(value * 100)}%`}
            />
            <Field label="Movimento da câmera">
              <Segmented
                value={scene.background.kenBurns ?? "none"}
                onChange={value => setBackground({ kenBurns: value })}
                options={[
                  { value: "none", label: "Parado" },
                  { value: "in", label: "Aproximar" },
                  { value: "out", label: "Afastar" },
                ]}
                size="sm"
              />
            </Field>
          </>
        ) : null}
        <Toggle
          label="Aplicar este fundo em todas as cenas"
          checked={false}
          onChange={() =>
            api.apply(draft => {
              const source = draft.scenes[api.sceneIndex]?.background;
              if (!source) return;
              draft.scenes.forEach(item => {
                item.background = structuredClone(source);
              });
            })
          }
        />
      </Section>

      <Section title="Resumo">
        <EmptyHint>
          {scene.layers.length} elemento(s) nesta cena ·{" "}
          {scene.narration.assetId ? "narração gravada" : "sem narração ainda"}{" "}
          ·{" "}
          {scene.narration.words?.length
            ? `${scene.narration.words.length} palavras legendadas`
            : "sem legendas"}
        </EmptyHint>
      </Section>
    </div>
  );
}
