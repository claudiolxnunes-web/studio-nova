import { useEffect, useRef, useState } from "react";
import {
  Film,
  Image as ImageIcon,
  Music,
  Sparkles,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import type { MediaAsset } from "@shared/editor";
import { SCENARIOS } from "@shared/editor";
import { fileSize } from "@/lib/format";
import { mediaRegistry } from "@/engine/media";
import { useEditorContext } from "@/store/editor";
import CameraRecorder from "../CameraRecorder";
import StockGallery from "../StockGallery";
import { EmptyHint, Section } from "../ui";

function MediaThumb({ asset }: { asset: MediaAsset }) {
  const [url, setUrl] = useState<string | null>(
    mediaRegistry.get(asset.id)?.url ?? null
  );

  useEffect(() => {
    let alive = true;
    void mediaRegistry.ensure(asset).then(entry => {
      if (alive && entry?.url) setUrl(entry.url);
    });
    return () => {
      alive = false;
    };
  }, [asset]);

  if (asset.kind === "image" && url) {
    return (
      <img src={url} alt={asset.name} className="h-full w-full object-cover" />
    );
  }
  if (asset.kind === "video" && url) {
    return (
      <video
        src={url}
        muted
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
      />
    );
  }
  return (
    <div className="grid h-full w-full place-items-center bg-white/[0.04] text-muted-foreground">
      {asset.kind === "video" ? (
        <Film size={16} />
      ) : asset.kind === "audio" ? (
        <Music size={16} />
      ) : (
        <ImageIcon size={16} />
      )}
    </div>
  );
}

export default function MediaTab() {
  const api = useEditorContext();
  const project = api.project;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);

  if (!project) return null;

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    await api.importMediaFiles(list);
  };

  return (
    <div className="space-y-5">
      <Section
        title="Importar mídia"
        description="Imagens, vídeos e áudios ficam salvos neste navegador e podem ser usados em qualquer cena."
      >
        <div
          onDragOver={event => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={async event => {
            event.preventDefault();
            setDragging(false);
            await handleFiles(event.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed p-4 text-center transition ${
            dragging
              ? "border-[var(--studio-accent)] bg-[var(--studio-accent)]/10"
              : "border-white/15 hover:border-white/30"
          }`}
        >
          <Upload size={16} className="text-muted-foreground" />
          <span className="text-[12px] font-medium">
            Arraste arquivos ou clique para importar
          </span>
          <span className="text-[10.5px] text-muted-foreground">
            PNG, JPG, WEBP, MP4, MOV, MP3, WAV
          </span>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*"
          className="hidden"
          onChange={async event => {
            if (event.target.files) await handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </Section>

      <Section
        title="Galerias grátis"
        description="Busque fotos e vídeos gratuitos do Openverse (sem chave), Pixabay, Pexels e Unsplash e traga direto para a biblioteca. Sem marca d'água e livres para uso comercial."
      >
        <StockGallery />
      </Section>

      <Section
        title="Filmar agora"
        description="Grave você mesmo pela câmera do computador ou do celular e use como camada ou como fundo da cena."
      >
        <button
          type="button"
          className="btn-ghost w-full"
          onClick={() => setCameraOpen(true)}
        >
          <Video size={13} /> Abrir câmera e gravar
        </button>
        <p className="text-[10.5px] leading-relaxed text-muted-foreground">
          O clipe entra na biblioteca e pode ser reutilizado. Para transcrever a
          sua fala, use a aba Legenda.
        </p>
      </Section>

      <Section
        title="Cenários realistas"
        description="Fundo fotorrealista gerado por IA, já aplicado com movimento lento de câmera."
      >
        <div className="grid grid-cols-2 gap-1.5">
          {SCENARIOS.map(scenario => (
            <button
              key={scenario.id}
              type="button"
              disabled={api.voiceBusy}
              onClick={() => void api.applyScenario(scenario.id)}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[11px] font-medium text-foreground/85 transition hover:border-[var(--studio-accent)]/50 hover:text-[#ffc59b] disabled:opacity-50"
            >
              {scenario.label}
            </button>
          ))}
        </div>
        <p className="text-[10.5px] leading-relaxed text-muted-foreground">
          Cidade, campo, floresta, praia, montanha, interior e estúdio. O
          movimento pode ser trocado na aba Cena.
        </p>
      </Section>

      <Section
        title="Imagem com IA"
        description="Descreva a cena que você quer e o estúdio gera a imagem."
      >
        <textarea
          className="studio-input min-h-[62px] resize-y text-[12px]"
          placeholder="Ex.: professora sorrindo em um escritório claro, estilo foto, fundo desfocado"
          value={prompt}
          onChange={event => setPrompt(event.target.value)}
        />
        <button
          type="button"
          className="btn-ghost w-full"
          disabled={api.voiceBusy || prompt.trim().length < 3}
          onClick={async () => {
            await api.generateImage(prompt.trim());
            setPrompt("");
          }}
        >
          <Sparkles size={13} /> Gerar imagem
        </button>
      </Section>

      <Section title={`Biblioteca · ${project.media.length}`}>
        {project.media.length === 0 ? (
          <EmptyHint>
            Nenhuma mídia importada ainda. Você pode criar uma aula só com
            fundos e textos.
          </EmptyHint>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {project.media.map(asset => (
              <div
                key={asset.id}
                className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]"
              >
                <div className="h-16 w-full overflow-hidden">
                  <MediaThumb asset={asset} />
                </div>
                <div className="space-y-1 p-1.5">
                  <p
                    className="truncate text-[10.5px] font-medium"
                    title={asset.name}
                  >
                    {asset.name}
                  </p>
                  <p className="text-[9.5px] text-muted-foreground">
                    {asset.width && asset.height
                      ? `${asset.width}×${asset.height} · `
                      : ""}
                    {fileSize(asset.size)}
                  </p>
                  <div className="flex items-center gap-1">
                    {asset.kind !== "audio" ? (
                      <button
                        type="button"
                        className="flex-1 rounded-md bg-white/6 px-1 py-1 text-[9.5px] text-foreground/80 hover:bg-white/12"
                        onClick={() =>
                          api.addLayer(
                            asset.kind === "image" ? "image" : "video",
                            asset.id
                          )
                        }
                      >
                        Usar
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="flex-1 rounded-md bg-white/6 px-1 py-1 text-[9.5px] text-foreground/80 hover:bg-white/12"
                        onClick={() =>
                          api.updateNarration({
                            assetId: asset.id,
                            source: "upload",
                          })
                        }
                      >
                        Narrar
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded-md bg-white/6 p-1 text-muted-foreground hover:bg-red-500/20 hover:text-red-300"
                      onClick={() => {
                        const ok = window.confirm(
                          `Remover "${asset.name}" da biblioteca? Ela também será retirada das cenas que usam este arquivo.`,
                        );
                        if (ok) void api.removeMedia(asset.id);
                      }}
                      title="Remover da biblioteca"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
      <CameraRecorder
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onUse={(blob, mode) => api.addRecordedVideo(blob, mode)}
      />
    </div>
  );
}
