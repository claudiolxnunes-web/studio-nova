import { useState } from "react";
import {
  AlignCenter,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  FlipHorizontal,
  FlipVertical,
  Lock,
  Sparkles,
  Trash2,
  Unlock,
} from "lucide-react";
import type {
  AvatarLayer,
  BlendMode,
  ImageLayer,
  Layer,
  LayerFilters,
  ShapeLayer,
  TextLayer,
  VideoLayer,
} from "@shared/editor";
import { AVATAR_PRESETS, DEFAULT_FILTERS } from "@shared/editor";
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

const FONTS = [
  { value: "Space Grotesk", label: "Space Grotesk (títulos)" },
  { value: "Inter", label: "Inter (texto)" },
  { value: "Georgia", label: "Georgia (serifada)" },
  { value: "Arial", label: "Arial" },
];

const BLEND_MODES: Array<{ value: BlendMode; label: string }> = [
  { value: "source-over", label: "Normal" },
  { value: "multiply", label: "Multiplicar" },
  { value: "screen", label: "Tela" },
  { value: "overlay", label: "Sobrepor" },
  { value: "lighten", label: "Clarear" },
  { value: "darken", label: "Escurecer" },
  { value: "soft-light", label: "Luz suave" },
  { value: "color-dodge", label: "Subexpor" },
];

export default function LayerTab() {
  const api = useEditorContext();
  const layer = api.selectedLayer;
  const project = api.project;

  if (!layer || !project) {
    return (
      <EmptyHint>
        Selecione um elemento na prévia (ou na aba Camadas) para editar texto,
        imagem, vídeo, forma ou avatar.
      </EmptyHint>
    );
  }

  const patch = (value: Record<string, unknown>) =>
    api.updateLayer(layer.id, value as Partial<Layer>);
  const filters: LayerFilters = layer.filters ?? DEFAULT_FILTERS;
  const patchFilter = (value: Partial<LayerFilters>) =>
    patch({ filters: { ...filters, ...value } });

  const align = (
    mode: "left" | "centerX" | "right" | "top" | "centerY" | "bottom"
  ) => {
    const next: Record<string, number> = {};
    if (mode === "left") next.x = Math.round(project.width * 0.05);
    if (mode === "centerX") next.x = Math.round((project.width - layer.w) / 2);
    if (mode === "right") next.x = Math.round(project.width * 0.95 - layer.w);
    if (mode === "top") next.y = Math.round(project.height * 0.06);
    if (mode === "centerY") next.y = Math.round((project.height - layer.h) / 2);
    if (mode === "bottom") next.y = Math.round(project.height * 0.94 - layer.h);
    patch(next);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <span className="chip" data-active="true">
          {layer.kind === "text"
            ? "Texto"
            : layer.kind === "image"
              ? "Imagem"
              : layer.kind === "video"
                ? "Vídeo"
                : layer.kind === "shape"
                  ? "Forma"
                  : "Avatar"}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="icon-btn"
            onClick={() => api.moveLayerOrder(layer.id, 1)}
            title="Trazer para frente"
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => api.moveLayerOrder(layer.id, -1)}
            title="Enviar para trás"
          >
            <ArrowDown size={14} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => patch({ hidden: !layer.hidden })}
            title="Mostrar/ocultar"
          >
            {layer.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => patch({ locked: !layer.locked })}
            title="Travar posição"
          >
            {layer.locked ? <Lock size={14} /> : <Unlock size={14} />}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => api.duplicateLayer(layer.id)}
            title="Duplicar"
          >
            <Copy size={14} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => api.deleteLayer(layer.id)}
            title="Excluir"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <Section title="Alinhamento rápido">
        <div className="grid grid-cols-6 gap-1">
          {[
            {
              mode: "left" as const,
              icon: AlignStartVertical,
              label: "Esquerda",
            },
            {
              mode: "centerX" as const,
              icon: AlignCenter,
              label: "Centro horizontal",
            },
            {
              mode: "right" as const,
              icon: AlignEndVertical,
              label: "Direita",
            },
            { mode: "top" as const, icon: AlignStartHorizontal, label: "Topo" },
            {
              mode: "centerY" as const,
              icon: AlignCenter,
              label: "Centro vertical",
            },
            {
              mode: "bottom" as const,
              icon: AlignEndHorizontal,
              label: "Base",
            },
          ].map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.mode}
                type="button"
                onClick={() => align(item.mode)}
                title={item.label}
                className="grid h-8 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-muted-foreground transition hover:border-[var(--studio-accent)]/50 hover:text-[#ffc59b]"
              >
                <Icon size={13} />
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            className="btn-ghost !py-1.5 text-[11px]"
            onClick={() => patch({ flipH: !layer.flipH })}
          >
            <FlipHorizontal size={12} /> Espelhar
          </button>
          <button
            type="button"
            className="btn-ghost !py-1.5 text-[11px]"
            onClick={() => patch({ flipV: !layer.flipV })}
          >
            <FlipVertical size={12} /> Inverter
          </button>
        </div>
      </Section>

      {layer.kind === "text" ? (
        <TextFields layer={layer} patch={patch} />
      ) : null}
      {layer.kind === "image" ? (
        <ImageFields layer={layer} patch={patch} />
      ) : null}
      {layer.kind === "video" ? (
        <VideoFields layer={layer} patch={patch} />
      ) : null}
      {layer.kind === "shape" ? (
        <ShapeFields layer={layer} patch={patch} />
      ) : null}
      {layer.kind === "avatar" ? (
        <AvatarFields layer={layer} patch={patch} />
      ) : null}

      <Section title="Posição e tamanho">
        <div className="grid grid-cols-2 gap-2">
          <Field label="X">
            <input
              type="number"
              className="studio-input"
              value={Math.round(layer.x)}
              onChange={event => patch({ x: Number(event.target.value) })}
            />
          </Field>
          <Field label="Y">
            <input
              type="number"
              className="studio-input"
              value={Math.round(layer.y)}
              onChange={event => patch({ y: Number(event.target.value) })}
            />
          </Field>
          <Field label="Largura">
            <input
              type="number"
              className="studio-input"
              value={Math.round(layer.w)}
              onChange={event =>
                patch({ w: Math.max(16, Number(event.target.value)) })
              }
            />
          </Field>
          <Field label="Altura">
            <input
              type="number"
              className="studio-input"
              value={Math.round(layer.h)}
              onChange={event =>
                patch({ h: Math.max(16, Number(event.target.value)) })
              }
            />
          </Field>
        </div>
        <Slider
          label="Rotação"
          min={-45}
          max={45}
          step={1}
          value={layer.rotation}
          onChange={value => patch({ rotation: value })}
          format={value => `${value}°`}
        />
        <Slider
          label="Opacidade"
          min={0.05}
          max={1}
          step={0.05}
          value={layer.opacity}
          onChange={value => patch({ opacity: value })}
          format={value => `${Math.round(value * 100)}%`}
        />
        <Field label="Modo de mistura">
          <Select
            value={layer.blend ?? "source-over"}
            onChange={value => patch({ blend: value })}
            options={BLEND_MODES}
          />
        </Field>
      </Section>

      <Section title="Filtros e cor">
        <Slider
          label="Brilho"
          min={0.4}
          max={1.8}
          step={0.05}
          value={filters.brightness}
          onChange={value => patchFilter({ brightness: value })}
          format={value => value.toFixed(2)}
        />
        <Slider
          label="Contraste"
          min={0.4}
          max={1.8}
          step={0.05}
          value={filters.contrast}
          onChange={value => patchFilter({ contrast: value })}
          format={value => value.toFixed(2)}
        />
        <Slider
          label="Saturação"
          min={0}
          max={2}
          step={0.05}
          value={filters.saturate}
          onChange={value => patchFilter({ saturate: value })}
          format={value => value.toFixed(2)}
        />
        <Slider
          label="Desfoque"
          min={0}
          max={24}
          step={1}
          value={filters.blur}
          onChange={value => patchFilter({ blur: value })}
          format={value => `${value}px`}
        />
        <Slider
          label="Preto e branco"
          min={0}
          max={1}
          step={0.1}
          value={filters.grayscale}
          onChange={value => patchFilter({ grayscale: value })}
          format={value => `${Math.round(value * 100)}%`}
        />
        <button
          type="button"
          className="btn-ghost w-full !py-1.5 text-[11px]"
          onClick={() => patch({ filters: DEFAULT_FILTERS })}
        >
          Limpar filtros
        </button>
      </Section>

      <Section title="Borda e sombra">
        <Slider
          label="Espessura da borda"
          min={0}
          max={24}
          step={1}
          value={layer.border?.width ?? 0}
          onChange={value =>
            patch({
              border: { width: value, color: layer.border?.color ?? "#FFFFFF" },
            })
          }
          format={value => `${value}px`}
        />
        {layer.border && layer.border.width > 0 ? (
          <ColorField
            label="Cor da borda"
            value={layer.border.color}
            onChange={value =>
              patch({
                border: { width: layer.border?.width ?? 0, color: value },
              })
            }
          />
        ) : null}
        <Toggle
          label="Sombra projetada"
          checked={Boolean(layer.shadowStyle)}
          onChange={value =>
            patch({
              shadowStyle: value
                ? { color: "rgba(0,0,0,0.45)", blur: 40, offsetY: 18 }
                : undefined,
            })
          }
        />
        {layer.shadowStyle ? (
          <>
            <Slider
              label="Desfoque da sombra"
              min={0}
              max={90}
              step={2}
              value={layer.shadowStyle.blur}
              onChange={value =>
                patch({
                  shadowStyle: {
                    ...(layer.shadowStyle as {
                      color: string;
                      blur: number;
                      offsetY: number;
                    }),
                    blur: value,
                  },
                })
              }
            />
            <Slider
              label="Deslocamento vertical"
              min={-40}
              max={60}
              step={2}
              value={layer.shadowStyle.offsetY}
              onChange={value =>
                patch({
                  shadowStyle: {
                    ...(layer.shadowStyle as {
                      color: string;
                      blur: number;
                      offsetY: number;
                    }),
                    offsetY: value,
                  },
                })
              }
            />
          </>
        ) : null}
      </Section>

      <Section title="Animação de entrada">
        <Segmented
          value={layer.anim ?? "none"}
          onChange={value => patch({ anim: value })}
          size="sm"
          options={[
            { value: "none", label: "Nenhuma" },
            { value: "fade", label: "Fade" },
            { value: "rise", label: "Subir" },
            { value: "pop", label: "Zoom" },
          ]}
        />
        <Slider
          label="Atraso"
          min={0}
          max={3}
          step={0.1}
          value={layer.animDelay ?? 0}
          onChange={value => patch({ animDelay: value })}
          format={value => `${value.toFixed(1)}s`}
        />
      </Section>
    </div>
  );
}

type Patch = (value: Record<string, unknown>) => void;

function TextFields({ layer, patch }: { layer: TextLayer; patch: Patch }) {
  return (
    <Section title="Texto">
      <textarea
        className="studio-input min-h-[84px] resize-y leading-relaxed"
        value={layer.text}
        onChange={event => patch({ text: event.target.value })}
      />
      <Field label="Fonte">
        <Select
          value={layer.fontFamily}
          onChange={value => patch({ fontFamily: value })}
          options={FONTS}
        />
      </Field>
      <Slider
        label="Tamanho"
        min={18}
        max={180}
        step={2}
        value={layer.fontSize}
        onChange={value => patch({ fontSize: value })}
        format={value => `${value}px`}
      />
      <Segmented
        value={String(layer.fontWeight)}
        onChange={value => patch({ fontWeight: Number(value) })}
        size="sm"
        options={[
          { value: "400", label: "Leve" },
          { value: "600", label: "Médio" },
          { value: "700", label: "Forte" },
          { value: "800", label: "Extra" },
        ]}
      />
      <Segmented
        value={layer.align}
        onChange={value => patch({ align: value })}
        size="sm"
        options={[
          { value: "left", label: "Esquerda" },
          { value: "center", label: "Centro" },
          { value: "right", label: "Direita" },
        ]}
      />
      <ColorField
        label="Cor do texto"
        value={layer.color}
        onChange={value => patch({ color: value })}
      />
      <Slider
        label="Entrelinha"
        min={0.9}
        max={1.8}
        step={0.05}
        value={layer.lineHeight}
        onChange={value => patch({ lineHeight: value })}
        format={value => value.toFixed(2)}
      />
      <Slider
        label="Espaço entre letras"
        min={-4}
        max={12}
        step={0.5}
        value={layer.letterSpacing}
        onChange={value => patch({ letterSpacing: value })}
        format={value => `${value}px`}
      />
      <Toggle
        label="Texto em caixa alta"
        checked={layer.uppercase}
        onChange={value => patch({ uppercase: value })}
      />
      <Toggle
        label="Sombra no texto"
        checked={layer.shadow}
        onChange={value => patch({ shadow: value })}
      />
      <Slider
        label="Contorno"
        min={0}
        max={12}
        step={0.5}
        value={layer.strokeWidth ?? 0}
        onChange={value => patch({ strokeWidth: value })}
        format={value => `${value}px`}
      />
      {layer.strokeWidth ? (
        <ColorField
          label="Cor do contorno"
          value={layer.strokeColor ?? "#000000"}
          onChange={value => patch({ strokeColor: value })}
        />
      ) : null}
      <Field label="Palavra em destaque" hint="pinta uma palavra da frase">
        <input
          className="studio-input"
          placeholder="ex.: grátis"
          value={layer.highlightWord ?? ""}
          onChange={event => patch({ highlightWord: event.target.value })}
        />
      </Field>
      {layer.highlightWord ? (
        <ColorField
          label="Cor do destaque"
          value={layer.highlightColor ?? "#FFB020"}
          onChange={value => patch({ highlightColor: value })}
        />
      ) : null}
      <Toggle
        label="Fundo atrás do texto"
        checked={layer.bgEnabled}
        onChange={value => patch({ bgEnabled: value })}
      />
      {layer.bgEnabled ? (
        <>
          <ColorField
            label="Cor do fundo"
            value={layer.bgColor}
            onChange={value => patch({ bgColor: value })}
          />
          <Slider
            label="Cantos arredondados"
            min={0}
            max={80}
            step={2}
            value={layer.bgRadius}
            onChange={value => patch({ bgRadius: value })}
          />
        </>
      ) : null}
    </Section>
  );
}

function MediaSelect({
  kind,
  value,
  onChange,
}: {
  kind: "image" | "video";
  value: string;
  onChange: (value: string) => void;
}) {
  const api = useEditorContext();
  const assets = (api.project?.media ?? []).filter(
    asset => asset.kind === kind
  );
  return (
    <Field label={kind === "image" ? "Imagem" : "Vídeo"}>
      <Select
        value={value}
        onChange={onChange}
        options={[
          {
            value: "",
            label: assets.length
              ? "Selecione…"
              : "Importe uma mídia na aba Mídia",
          },
          ...assets.map(asset => ({ value: asset.id, label: asset.name })),
        ]}
      />
    </Field>
  );
}

function ImageFields({ layer, patch }: { layer: ImageLayer; patch: Patch }) {
  return (
    <Section title="Imagem">
      <MediaSelect
        kind="image"
        value={layer.mediaId}
        onChange={value => patch({ mediaId: value })}
      />
      <Segmented
        value={layer.fit}
        onChange={value => patch({ fit: value })}
        size="sm"
        options={[
          { value: "cover", label: "Preencher" },
          { value: "contain", label: "Caber" },
        ]}
      />
      <Segmented
        value={layer.kenBurns}
        onChange={value => patch({ kenBurns: value })}
        size="sm"
        options={[
          { value: "none", label: "Parada" },
          { value: "in", label: "Zoom +" },
          { value: "out", label: "Zoom −" },
        ]}
      />
      <Slider
        label="Cantos arredondados"
        min={0}
        max={120}
        step={2}
        value={layer.radius}
        onChange={value => patch({ radius: value })}
      />
      <Toggle
        label="Sombra"
        checked={layer.shadow}
        onChange={value => patch({ shadow: value })}
      />
    </Section>
  );
}

function VideoFields({ layer, patch }: { layer: VideoLayer; patch: Patch }) {
  return (
    <Section title="Vídeo">
      <MediaSelect
        kind="video"
        value={layer.mediaId}
        onChange={value => patch({ mediaId: value })}
      />
      <Segmented
        value={layer.fit}
        onChange={value => patch({ fit: value })}
        size="sm"
        options={[
          { value: "cover", label: "Preencher" },
          { value: "contain", label: "Caber" },
        ]}
      />
      <Slider
        label="Começar em"
        min={0}
        max={60}
        step={0.5}
        value={layer.startAt}
        onChange={value => patch({ startAt: value })}
        format={value => `${value.toFixed(1)}s`}
      />
      <Slider
        label="Cantos arredondados"
        min={0}
        max={120}
        step={2}
        value={layer.radius}
        onChange={value => patch({ radius: value })}
      />
    </Section>
  );
}

function ShapeFields({ layer, patch }: { layer: ShapeLayer; patch: Patch }) {
  return (
    <Section title="Forma">
      <Segmented
        value={layer.shape}
        onChange={value => patch({ shape: value })}
        size="sm"
        options={[
          { value: "rect", label: "Retângulo" },
          { value: "ellipse", label: "Círculo" },
          { value: "line", label: "Linha" },
        ]}
      />
      <ColorField
        label="Preenchimento"
        value={layer.fill}
        onChange={value => patch({ fill: value })}
      />
      {layer.shape === "rect" ? (
        <Slider
          label="Cantos arredondados"
          min={0}
          max={200}
          step={2}
          value={layer.radius}
          onChange={value => patch({ radius: value })}
        />
      ) : null}
      <Slider
        label="Contorno"
        min={0}
        max={24}
        step={1}
        value={layer.strokeWidth}
        onChange={value => patch({ strokeWidth: value })}
        format={value => `${value}px`}
      />
      {layer.strokeWidth > 0 ? (
        <ColorField
          label="Cor do contorno"
          value={layer.stroke}
          onChange={value => patch({ stroke: value })}
        />
      ) : null}
    </Section>
  );
}

const PRESENTER_LIBRARY = [
  { id: "ana", name: "Ana", src: "/avatars/ana.jpg" },
  { id: "bruno", name: "Bruno", src: "/avatars/bruno.jpg" },
  { id: "carla", name: "Carla", src: "/avatars/carla.jpg" },
  { id: "diego", name: "Diego", src: "/avatars/diego.jpg" },
  { id: "elisa", name: "Elisa", src: "/avatars/elisa.jpg" },
  { id: "fabio", name: "Fábio", src: "/avatars/fabio.jpg" },
];

function AvatarFields({ layer, patch }: { layer: AvatarLayer; patch: Patch }) {
  const api = useEditorContext();
  const photos = (api.project?.media ?? []).filter(
    asset => asset.kind === "image"
  );
  const [portraitPrompt, setPortraitPrompt] = useState("");
  const [loadingPresenter, setLoadingPresenter] = useState<string | null>(null);

  const applyPresenter = async (presenter: { id: string; name: string; src: string }) => {
    if (loadingPresenter) return;
    setLoadingPresenter(presenter.id);
    try {
      const response = await fetch(presenter.src);
      const blob = await response.blob();
      const file = new File([blob], `apresentador-${presenter.id}.jpg`, {
        type: blob.type || "image/jpeg",
      });
      const [asset] = await api.importMediaFiles([file]);
      if (asset) patch({ mode: "photo", photoMediaId: asset.id });
    } catch {
      /* ignore: the person can still pick a photo manually */
    } finally {
      setLoadingPresenter(null);
    }
  };

  return (
    <Section title="Avatar">
      <div>
        <p className="mb-1.5 flex items-center justify-between text-[10.5px] text-muted-foreground">
          <span>Apresentadores prontos</span>
          <span className="text-muted-foreground/60">foto real · animados</span>
        </p>
        <div className="grid grid-cols-6 gap-1.5">
          {PRESENTER_LIBRARY.map(presenter => (
            <button
              key={presenter.id}
              type="button"
              onClick={() => void applyPresenter(presenter)}
              className={`relative aspect-[4/5] overflow-hidden rounded-lg border transition ${
                layer.mode === "photo" && loadingPresenter === presenter.id
                  ? "border-[var(--studio-accent)]"
                  : "border-white/10 hover:border-white/35"
              }`}
              title={presenter.name}
            >
              <img src={presenter.src} alt={presenter.name} className="h-full w-full object-cover" />
              {loadingPresenter === presenter.id ? (
                <span className="absolute inset-0 grid place-items-center bg-black/60 text-[9px]">
                  …
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
      <Segmented
        value={layer.mode}
        onChange={value => patch({ mode: value })}
        size="sm"
        options={[
          { value: "vector", label: "Ilustração" },
          { value: "photo", label: "Minha foto" },
        ]}
      />
      {layer.mode === "vector" ? (
        <div className="grid grid-cols-4 gap-2">
          {AVATAR_PRESETS.map(preset => (
            <button
              key={preset.id}
              type="button"
              onClick={() => patch({ avatarId: preset.id })}
              className={`flex flex-col items-center gap-1 rounded-xl border p-1.5 transition ${
                layer.avatarId === preset.id
                  ? "border-[var(--studio-accent)]/70 bg-[var(--studio-accent)]/10"
                  : "border-white/10 hover:border-white/25"
              }`}
            >
              <span
                className="grid h-9 w-9 place-items-center rounded-full text-[13px] font-bold"
                style={{ background: preset.shirt, color: "#0b0b10" }}
              >
                {preset.name.slice(0, 1)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {preset.name}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <>
          <Field
            label="Foto do apresentador"
            hint="rosto detectado automaticamente"
          >
            <Select
              value={layer.photoMediaId ?? ""}
              onChange={value => patch({ photoMediaId: value || undefined })}
              options={[
                {
                  value: "",
                  label: photos.length
                    ? "Selecione uma foto…"
                    : "Importe uma foto na aba Mídia",
                },
                ...photos.map(asset => ({
                  value: asset.id,
                  label: asset.name,
                })),
              ]}
            />
          </Field>
          <Field
            label="Gerar retrato realista (IA)"
            hint="descreva a pessoa; o retrato entra na biblioteca e já vira o avatar"
          >
            <div className="flex gap-1.5">
              <input
                className="studio-input flex-1 text-[11.5px]"
                placeholder="Ex.: mulher brasileira, 38 anos, camisa social azul"
                value={portraitPrompt}
                onChange={event => setPortraitPrompt(event.target.value)}
              />
              <button
                type="button"
                className="btn-ghost shrink-0 !px-2.5"
                disabled={api.voiceBusy}
                title="Gerar retrato realista"
                onClick={() => void api.generatePortrait(portraitPrompt)}
              >
                <Sparkles size={12} />
              </button>
            </div>
          </Field>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Para máxima semelhança, grave você mesmo pela câmera na aba Mídia →
            Filmar agora e use o clipe como camada.
          </p>
        </>
      )}
      <Toggle
        label="Anel de destaque"
        checked={layer.ring}
        onChange={value => patch({ ring: value })}
      />
      {layer.ring ? (
        <ColorField
          label="Cor do anel"
          value={layer.ringColor}
          onChange={value => patch({ ringColor: value })}
        />
      ) : null}
      <Toggle
        label="Movimento ao falar"
        hint="boca, olhos e balanço seguem a narração da cena"
        checked={layer.bob}
        onChange={value => patch({ bob: value })}
      />
      <Toggle
        label="Espelhar"
        checked={Boolean(layer.mirror)}
        onChange={value => patch({ mirror: value })}
      />
    </Section>
  );
}
