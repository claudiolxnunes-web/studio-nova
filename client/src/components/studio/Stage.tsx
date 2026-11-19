import { useCallback, useEffect, useRef, useState } from "react";
import {
  Crosshair,
  Grid3X3,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  Shield,
  SkipBack,
  SkipForward,
} from "lucide-react";
import type { Layer } from "@shared/editor";
import { formatTime } from "@/lib/format";
import { drawProjectFrame, drawSafeArea } from "@/engine/render";
import { syncVideoLayers } from "@/engine/media";
import { useEditorContext } from "@/store/editor";

type DragMode = "move" | "resize" | "rotate";

interface DragState {
  mode: DragMode;
  handle: string;
  layerId: string;
  startX: number;
  startY: number;
  origin: { x: number; y: number; w: number; h: number; rotation: number };
  centerX: number;
  centerY: number;
  startAngle: number;
}

const HANDLES = [
  { id: "nw", x: 0, y: 0 },
  { id: "ne", x: 1, y: 0 },
  { id: "sw", x: 0, y: 1 },
  { id: "se", x: 1, y: 1 },
];

export default function Stage() {
  const api = useEditorContext();
  const project = api.project;
  const scene = api.scene;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [safeArea, setSafeArea] = useState(false);
  const [grid, setGrid] = useState(false);
  const [zoom, setZoom] = useState<"fit" | 0.75 | 0.5>("fit");
  const [displayTime, setDisplayTime] = useState(0);
  const [boxSize, setBoxSize] = useState({ width: 640, height: 360 });

  const selected = api.selectedLayer;

  useEffect(() => {
    const element = wrapRef.current;
    if (!element || !project) return;
    const update = () => {
      const availableWidth = element.clientWidth;
      const availableHeight = element.clientHeight;
      const ratio = project.width / project.height;
      let width = availableWidth;
      let height = width / ratio;
      if (height > availableHeight) {
        height = availableHeight;
        width = height * ratio;
      }
      setBoxSize({ width: Math.max(80, Math.floor(width)), height: Math.max(60, Math.floor(height)) });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [project]);

  // Render loop: same renderer used by the export.
  useEffect(() => {
    let raf = 0;
    let lastKey = "";
    const loop = () => {
      const canvas = canvasRef.current;
      if (canvas && project) {
        if (canvas.width !== project.width || canvas.height !== project.height) {
          canvas.width = project.width;
          canvas.height = project.height;
        }
        const time = api.getTime();
        const key = `${project.updatedAt}-${time.toFixed(3)}-${safeArea}-${api.selectedLayerId}`;
        if (key !== lastKey) {
          lastKey = key;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            // Paused preview shows the composed frame (animations complete),
            // playback shows the entrance animations.
            drawProjectFrame(ctx, project, time, !api.playing);
            if (safeArea) drawSafeArea(ctx, project);
            syncVideoLayers(project, time, api.playing);
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [project, api, safeArea]);

  useEffect(() => {
    const interval = window.setInterval(() => setDisplayTime(api.getTime()), 120);
    return () => window.clearInterval(interval);
  }, [api]);

  // Keyboard shortcuts for fast editing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName ?? "";
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag) || target?.isContentEditable) return;

      const modifier = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (event.code === "Space") {
        event.preventDefault();
        api.togglePlay();
        return;
      }
      if (modifier && key === "z") {
        event.preventDefault();
        if (event.shiftKey) api.redo();
        else api.undo();
        return;
      }
      if (modifier && key === "y") {
        event.preventDefault();
        api.redo();
        return;
      }
      if (modifier && key === "d" && api.selectedLayerId) {
        event.preventDefault();
        api.duplicateLayer(api.selectedLayerId);
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && api.selectedLayerId) {
        event.preventDefault();
        api.deleteLayer(api.selectedLayerId);
        return;
      }
      if (event.key === "Escape") {
        api.selectLayer(null);
        return;
      }
      if (api.selectedLayer && event.key.startsWith("Arrow")) {
        event.preventDefault();
        const step = event.shiftKey ? 20 : 2;
        const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
        const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
        api.updateLayer(api.selectedLayer.id, {
          x: api.selectedLayer.x + dx,
          y: api.selectedLayer.y + dy,
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [api]);

  const toProject = useCallback(
    (event: React.PointerEvent | PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas || !project) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * project.width,
        y: ((event.clientY - rect.top) / rect.height) * project.height,
      };
    },
    [project],
  );

  const hitTest = useCallback(
    (point: { x: number; y: number }): Layer | null => {
      if (!scene) return null;
      for (let index = scene.layers.length - 1; index >= 0; index -= 1) {
        const layer = scene.layers[index];
        if (layer.hidden) continue;
        const cx = layer.x + layer.w / 2;
        const cy = layer.y + layer.h / 2;
        const angle = (-layer.rotation * Math.PI) / 180;
        const dx = point.x - cx;
        const dy = point.y - cy;
        const localX = dx * Math.cos(angle) - dy * Math.sin(angle) + layer.w / 2;
        const localY = dx * Math.sin(angle) + dy * Math.cos(angle) + layer.h / 2;
        if (localX >= 0 && localX <= layer.w && localY >= 0 && localY <= layer.h) return layer;
      }
      return null;
    },
    [scene],
  );

  const handlePointerDown = (event: React.PointerEvent) => {
    if (!project || !scene) return;
    const point = toProject(event);
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);

    if (selected) {
      const cx = selected.x + selected.w / 2;
      const cy = selected.y + selected.h / 2;
      const angle = (-selected.rotation * Math.PI) / 180;
      const dx = point.x - cx;
      const dy = point.y - cy;
      const localX = dx * Math.cos(angle) - dy * Math.sin(angle) + selected.w / 2;
      const localY = dx * Math.sin(angle) + dy * Math.cos(angle) + selected.h / 2;
      const handleSize = project.width * 0.022;

      const rotateDistance = Math.hypot(dx, dy);
      if (rotateDistance > selected.w * 0.55 && rotateDistance < selected.w * 0.55 + handleSize * 3) {
        api.apply(() => undefined);
        dragRef.current = {
          mode: "rotate",
          handle: "rotate",
          layerId: selected.id,
          startX: point.x,
          startY: point.y,
          origin: { x: selected.x, y: selected.y, w: selected.w, h: selected.h, rotation: selected.rotation },
          centerX: cx,
          centerY: cy,
          startAngle: Math.atan2(dy, dx),
        };
        return;
      }

      for (const handle of HANDLES) {
        const handleX = handle.x * selected.w;
        const handleY = handle.y * selected.h;
        if (Math.hypot(localX - handleX, localY - handleY) < handleSize) {
          api.apply(() => undefined);
          dragRef.current = {
            mode: "resize",
            handle: handle.id,
            layerId: selected.id,
            startX: point.x,
            startY: point.y,
            origin: { x: selected.x, y: selected.y, w: selected.w, h: selected.h, rotation: selected.rotation },
            centerX: cx,
            centerY: cy,
            startAngle: 0,
          };
          return;
        }
      }
    }

    const hit = hitTest(point);
    api.selectLayer(hit?.id ?? null);
    if (hit) {
      api.apply(() => undefined);
      dragRef.current = {
        mode: "move",
        handle: "move",
        layerId: hit.id,
        startX: point.x,
        startY: point.y,
        origin: { x: hit.x, y: hit.y, w: hit.w, h: hit.h, rotation: hit.rotation },
        centerX: hit.x + hit.w / 2,
        centerY: hit.y + hit.h / 2,
        startAngle: 0,
      };
    } else {
      dragRef.current = null;
    }
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !project) return;
    const point = toProject(event);
    const dx = point.x - drag.startX;
    const dy = point.y - drag.startY;

    if (drag.mode === "move") {
      const threshold = project.width * 0.009;
      const snapX = [0, (project.width - drag.origin.w) / 2, project.width - drag.origin.w];
      const snapY = [0, (project.height - drag.origin.h) / 2, project.height - drag.origin.h];
      let nextX = drag.origin.x + dx;
      let nextY = drag.origin.y + dy;
      for (const target of snapX) {
        if (Math.abs(nextX - target) < threshold) nextX = target;
      }
      for (const target of snapY) {
        if (Math.abs(nextY - target) < threshold) nextY = target;
      }
      api.updateLayer(
        drag.layerId,
        { x: Math.round(nextX), y: Math.round(nextY) },
        { history: false },
      );
      return;
    }

    if (drag.mode === "rotate") {
      const angle = Math.atan2(point.y - drag.centerY, point.x - drag.centerX);
      const delta = ((angle - drag.startAngle) * 180) / Math.PI;
      api.updateLayer(drag.layerId, { rotation: Math.round(drag.origin.rotation + delta) }, { history: false });
      return;
    }

    const minSize = 24;
    let { x, y, w, h } = drag.origin;
    if (drag.handle.includes("e")) w = Math.max(minSize, drag.origin.w + dx);
    if (drag.handle.includes("s")) h = Math.max(minSize, drag.origin.h + dy);
    if (drag.handle.includes("w")) {
      const newW = Math.max(minSize, drag.origin.w - dx);
      x = drag.origin.x + (drag.origin.w - newW);
      w = newW;
    }
    if (drag.handle.includes("n")) {
      const newH = Math.max(minSize, drag.origin.h - dy);
      y = drag.origin.y + (drag.origin.h - newH);
      h = newH;
    }
    api.updateLayer(drag.layerId, { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }, { history: false });
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  if (!project || !scene) return null;

  const zoomFactor = zoom === "fit" ? 1 : zoom;
  const displayWidth = Math.max(120, Math.round(boxSize.width * zoomFactor));
  const displayHeight = Math.max(80, Math.round(boxSize.height * zoomFactor));

  const selectionStyle = selected
    ? {
        left: `${(selected.x / project.width) * 100}%`,
        top: `${(selected.y / project.height) * 100}%`,
        width: `${(selected.w / project.width) * 100}%`,
        height: `${(selected.h / project.height) * 100}%`,
        transform: `rotate(${selected.rotation}deg)`,
      }
    : null;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-white/[0.07] px-3 py-2">
        <button type="button" className="icon-btn" onClick={() => api.seek(0)} title="Voltar ao início">
          <SkipBack size={15} />
        </button>
        <button
          type="button"
          onClick={api.togglePlay}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-[var(--studio-accent)] px-3 text-[12px] font-semibold text-[#170b03]"
        >
          {api.playing ? <Pause size={14} /> : <Play size={14} />}
          {api.playing ? "Pausar" : "Prévia"}
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => api.seek(api.totalDuration)}
          title="Ir para o fim"
        >
          <SkipForward size={15} />
        </button>
        <div className="ml-1 flex items-baseline gap-1 font-mono text-[11.5px]">
          <span className="text-foreground/90">{formatTime(displayTime)}</span>
          <span className="text-muted-foreground">/ {formatTime(api.totalDuration)}</span>
        </div>
        <div className="mx-1 hidden h-4 w-px bg-white/10 sm:block" />
        <span className="hidden truncate text-[11.5px] text-muted-foreground sm:block">
          Cena {api.sceneIndex + 1} de {project.scenes.length} · {scene.name}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className="icon-btn"
            data-active={safeArea}
            onClick={() => setSafeArea(value => !value)}
            title="Área segura para redes sociais"
          >
            <Shield size={15} />
          </button>
          <button
            type="button"
            className="icon-btn"
            data-active={grid}
            onClick={() => setGrid(value => !value)}
            title="Grade de composição (regra dos terços)"
          >
            <Grid3X3 size={15} />
          </button>
          <select
            value={String(zoom)}
            onChange={event => setZoom(event.target.value === "fit" ? "fit" : (Number(event.target.value) as 0.75 | 0.5))}
            className="h-7 rounded-md border border-white/10 bg-white/[0.04] px-1.5 font-mono text-[10px] text-muted-foreground"
            title="Zoom da prévia"
          >
            <option value="fit">Ajustar</option>
            <option value="0.75">75%</option>
            <option value="0.5">50%</option>
          </select>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              api.seek(0);
              void api.play();
            }}
            title="Reproduzir do início"
          >
            <RotateCcw size={15} />
          </button>
          <span className="hidden items-center gap-1 rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:flex">
            <Maximize2 size={10} /> {project.width}×{project.height}
          </span>
        </div>
      </div>

      <div className="stage-backdrop relative min-h-0 flex-1 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-5">
        <div ref={wrapRef} className="flex h-full w-full items-center justify-center">
        <div
          className="relative shrink-0 shadow-[0_24px_70px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10"
          style={{ width: displayWidth, height: displayHeight }}
        >
          <canvas
            ref={canvasRef}
            className="h-full w-full touch-none rounded-[3px]"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
          {selectionStyle ? (
            <div
              className="pointer-events-none absolute border border-[var(--studio-accent)]/90"
              style={selectionStyle}
            >
              {HANDLES.map(handle => (
                <span
                  key={handle.id}
                  className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#0a0a0d] bg-[var(--studio-accent)]"
                  style={{ left: `${handle.x * 100}%`, top: `${handle.y * 100}%` }}
                />
              ))}
              <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-[calc(50%+22px)] rounded-full border border-[#0a0a0d] bg-white/85" />
              <span className="absolute left-1/2 top-0 h-[22px] w-px -translate-x-1/2 -translate-y-full bg-[var(--studio-accent)]/70" />
            </div>
          ) : null}
          {!api.playing ? (
            <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-1 text-[10px] text-white/70 backdrop-blur">
              <Crosshair size={10} /> clique para selecionar · setas movem · Del apaga
            </div>
          ) : null}
          {grid ? (
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-y-0 left-1/3 w-px bg-white/25" />
              <div className="absolute inset-y-0 left-2/3 w-px bg-white/25" />
              <div className="absolute inset-x-0 top-1/3 h-px bg-white/25" />
              <div className="absolute inset-x-0 top-2/3 h-px bg-white/25" />
              <div className="absolute inset-0 border border-white/20" />
            </div>
          ) : null}
        </div>
        </div>
        </div>
      </div>
    </div>
  );
}
