import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { narrationLength } from "@shared/editor";
import { useEditorContext } from "@/store/editor";
import { formatClock } from "@/lib/format";

export default function Timeline() {
  const api = useEditorContext();
  const project = api.project;
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [time, setTime] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => setTime(api.getTime()), 100);
    return () => window.clearInterval(interval);
  }, [api]);

  if (!project) return null;
  const total = Math.max(0.1, api.totalDuration);
  const starts: number[] = [];
  let acc = 0;
  for (const scene of project.scenes) {
    starts.push(acc);
    acc += scene.duration;
  }

  const seekFromEvent = (event: React.MouseEvent) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const target = ratio * total;
    api.seek(target);
    let index = 0;
    starts.forEach((start, sceneIndex) => {
      if (target >= start) index = sceneIndex;
    });
    if (index !== api.sceneIndex) api.setSceneIndex(index);
  };

  return (
    <div className="border-t border-white/[0.07] bg-[#0b0b10] px-3 py-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="label">Linha do tempo</span>
        <span className="font-mono text-[10.5px] text-muted-foreground">
          {formatClock(time)} / {formatClock(total)}
        </span>
      </div>
      <div
        ref={trackRef}
        onClick={seekFromEvent}
        className="relative flex h-11 w-full cursor-pointer overflow-hidden rounded-lg border border-white/[0.07] bg-white/[0.02]"
      >
        {project.scenes.map((scene, index) => {
          const width = (scene.duration / total) * 100;
          const active = index === api.sceneIndex;
          return (
            <div
              key={scene.id}
              className={`relative flex h-full min-w-0 flex-col justify-center gap-0.5 border-r border-black/40 px-1.5 transition ${
                active ? "bg-[var(--studio-accent)]/18" : "bg-white/[0.03] hover:bg-white/[0.06]"
              }`}
              style={{ width: `${width}%` }}
              onClick={event => {
                event.stopPropagation();
                api.setSceneIndex(index);
                api.seek(starts[index] + Math.min(0.2, scene.duration / 2));
              }}
              title={`${scene.name} · ${formatClock(scene.duration)}`}
            >
              <span className="flex items-center gap-1 truncate text-[10px] font-medium text-foreground/85">
                <span className="font-mono opacity-60">{index + 1}</span>
                <span className="truncate">{scene.name}</span>
                {scene.narration.assetId ? <Mic size={8} className="shrink-0 text-[var(--studio-teal)]" /> : null}
              </span>
              <span
                className="h-1 rounded-full bg-[var(--studio-teal)]/80"
                title={`Narração cobre ${Math.round(
                  Math.min(
                    1,
                    narrationLength(scene.narration) /
                      Math.max(0.1, scene.duration),
                  ) * 100,
                )}% da cena`}
                style={{
                  width: `${Math.min(
                    100,
                    (narrationLength(scene.narration) /
                      Math.max(0.1, scene.duration)) *
                      100,
                  )}%`,
                }}
              />
            </div>
          );
        })}
        <div
          className="pointer-events-none absolute top-0 h-full w-[2px] bg-[#ffd2ae] shadow-[0_0_10px_rgba(255,122,26,0.9)]"
          style={{ left: `${Math.min(100, (time / total) * 100)}%` }}
        />
      </div>
    </div>
  );
}
