import { useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
import { FORMAT_PRESETS, totalDuration } from "@shared/editor";
import { formatClock } from "@/lib/format";
import { useEditorContext } from "@/store/editor";
import { ColorField, Section } from "../ui";

const ACCENTS = ["#FF7A1A", "#F2545B", "#E8C547", "#4FD1C5", "#6C5CE7", "#F4F1EA"];

export default function ProjectTab() {
  const api = useEditorContext();
  const project = api.project;
  const [, navigate] = useLocation();
  const [confirming, setConfirming] = useState(false);
  if (!project) return null;

  const duration = totalDuration(project);
  const narrated = project.scenes.filter(scene => scene.narration.assetId).length;
  const captioned = project.scenes.filter(scene => scene.narration.words?.length).length;

  return (
    <div className="space-y-5">
      <Section title="Identificação">
        <input className="studio-input" value={project.name} onChange={event => api.renameProject(event.target.value)} />
        <p className="text-[10.5px] leading-relaxed text-muted-foreground">
          Este nome vira o nome do arquivo exportado e aparece na lista de aulas.
        </p>
      </Section>

      <Section title="Formato de publicação" description="Trocar o formato reescala todos os elementos.">
        <div className="space-y-1.5">
          {FORMAT_PRESETS.map(preset => {
            const active = project.format === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => api.setFormat(preset.id)}
                className={`flex w-full items-center gap-2 rounded-lg border p-1.5 text-left transition ${
                  active
                    ? "border-[var(--studio-accent)]/70 bg-[var(--studio-accent)]/10"
                    : "border-white/10 bg-white/[0.02] hover:border-white/25"
                }`}
              >
                <span
                  className="grid shrink-0 place-items-center rounded border border-white/15 bg-white/5 font-mono text-[8.5px] text-muted-foreground"
                  style={{
                    width: preset.width >= preset.height ? 28 : 20,
                    height: preset.height > preset.width ? 28 : 20,
                  }}
                >
                  {preset.ratio}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-[11.5px] font-medium">
                    {preset.label}
                    {active ? <Check size={10} className="text-[var(--studio-accent)]" /> : null}
                  </span>
                  <span className="block truncate text-[9.5px] text-muted-foreground">{preset.channel}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Cor da marca">
        <ColorField label="Destaque" value={project.theme.accent} onChange={() => undefined} />
        <div className="grid grid-cols-6 gap-1.5">
          {ACCENTS.map(color => (
            <button
              key={color}
              type="button"
              onClick={() =>
                api.apply(draft => {
                  draft.theme.accent = color;
                })
              }
              className={`h-7 rounded-md border transition ${
                project.theme.accent === color ? "border-white/80" : "border-white/15"
              }`}
              style={{ background: color }}
              title={color}
            />
          ))}
        </div>
        <p className="text-[10.5px] leading-relaxed text-muted-foreground">
          Usada nos modelos de cena, nas formas e no anel dos avatares.
        </p>
      </Section>

      <Section title="Resumo da aula">
        <dl className="grid grid-cols-2 gap-1.5 text-[11px]">
          {[
            ["Cenas", String(project.scenes.length)],
            ["Duração", formatClock(duration)],
            ["Com narração", `${narrated}/${project.scenes.length}`],
            ["Com legendas", `${captioned}/${project.scenes.length}`],
            ["Mídias", String(project.media.length)],
            ["Resolução", `${project.width}×${project.height}`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-2 py-1.5">
              <dt className="text-[9.5px] uppercase tracking-wide text-muted-foreground">{label}</dt>
              <dd className="font-mono text-[11.5px] text-foreground/90">{value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Zona de risco">
        {confirming ? (
          <div className="space-y-1.5">
            <p className="text-[11px] text-red-200">Excluir esta aula apaga o projeto e não pode ser desfeito.</p>
            <div className="flex gap-1.5">
              <button
                type="button"
                className="btn-ghost flex-1 !py-1.5 text-[11px] !text-red-200"
                onClick={async () => {
                  await api.deleteCurrentProject();
                  navigate("/");
                }}
              >
                Confirmar exclusão
              </button>
              <button type="button" className="btn-ghost !py-1.5 text-[11px]" onClick={() => setConfirming(false)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn-ghost w-full !py-1.5 text-[11px]" onClick={() => setConfirming(true)}>
            <Trash2 size={12} /> Excluir esta aula
          </button>
        )}
      </Section>
    </div>
  );
}
