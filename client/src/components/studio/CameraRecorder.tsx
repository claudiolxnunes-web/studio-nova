import { useCallback, useEffect, useRef, useState } from "react";
import { Circle, Loader2, Square, Video, X } from "lucide-react";
import {
  CameraRecorder as Recorder,
  cameraSupport,
  openCamera,
  type ClipResult,
} from "@/engine/camera";
import { Segmented } from "./ui";

type Mode = "layer" | "background";

export default function CameraRecorder({
  open,
  onClose,
  onUse,
}: {
  open: boolean;
  onClose: () => void;
  onUse: (blob: Blob, mode: Mode) => Promise<void> | void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<Recorder | null>(null);
  const timerRef = useRef<number | null>(null);

  const [mode, setMode] = useState<Mode>("layer");
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [clip, setClip] = useState<(ClipResult & { url: string }) | null>(null);
  const [saving, setSaving] = useState(false);

  const support = cameraSupport();

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  useEffect(() => {
    if (!open) {
      stopStream();
      setClip(null);
      setError(null);
      setElapsed(0);
      setRecording(false);
      return;
    }
    if (!support.supported) {
      setError(support.reason ?? "Câmera indisponível.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const stream = await openCamera(facing);
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setReady(true);
        setError(null);
      } catch (caught) {
        const message = (caught as Error).message || "";
        setError(
          /denied|permission/i.test(message)
            ? "Permissão de câmera negada. Libere o acesso no navegador e tente de novo."
            : `Não foi possível abrir a câmera: ${message}`
        );
      }
    })();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, facing, support.supported, support.reason, stopStream]);

  useEffect(() => {
    if (!recording) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    timerRef.current = window.setInterval(
      () => setElapsed(value => value + 0.1),
      100
    );
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [recording]);

  const startRecording = () => {
    if (!streamRef.current) return;
    setClip(null);
    setElapsed(0);
    const recorder = new Recorder(streamRef.current);
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  };

  const stopRecording = async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    setRecording(false);
    const result = await recorder.stop();
    const url = URL.createObjectURL(result.blob);
    setClip({ ...result, url });
    recorderRef.current = null;
  };

  const useClip = async () => {
    if (!clip) return;
    setSaving(true);
    try {
      await onUse(clip.blob, mode);
      URL.revokeObjectURL(clip.url);
      setClip(null);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-3 backdrop-blur-sm">
      <div className="panel w-full max-w-xl overflow-hidden">
        <header className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
          <div>
            <h2 className="wordmark text-[15px]">Filmar com a câmera</h2>
            <p className="text-[11px] text-muted-foreground">
              Grave você mesmo e insira na cena
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </header>

        <div className="space-y-3 px-4 py-4">
          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`aspect-video w-full object-cover ${clip ? "hidden" : ""}`}
              style={{
                transform: facing === "user" ? "scaleX(-1)" : undefined,
              }}
            />
            {clip ? (
              <video
                src={clip.url}
                controls
                className="aspect-video w-full object-cover"
              />
            ) : null}
            {recording ? (
              <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-red-500/90 px-2 py-1 text-[10.5px] font-semibold text-white">
                <Circle size={8} className="animate-pulse" /> REC{" "}
                {elapsed.toFixed(1)}s
              </span>
            ) : null}
            {!ready && !clip && !error ? (
              <span className="absolute inset-0 grid place-items-center text-[11.5px] text-white/70">
                <Loader2 size={16} className="animate-spin" />
              </span>
            ) : null}
          </div>

          {error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-[11.5px] text-red-200">
              {error}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <span className="label">Onde usar a gravação</span>
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: "layer", label: "Camada na cena" },
                { value: "background", label: "Fundo da cena" },
              ]}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!clip ? (
              recording ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => void stopRecording()}
                >
                  <Square size={13} /> Parar gravação
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={startRecording}
                  disabled={!ready}
                >
                  <Circle size={13} /> Começar a gravar
                </button>
              )
            ) : (
              <>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => void useClip()}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Video size={13} />
                  )}
                  Usar esta gravação
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    if (clip) URL.revokeObjectURL(clip.url);
                    setClip(null);
                    setElapsed(0);
                  }}
                >
                  Gravar de novo
                </button>
              </>
            )}
            <button
              type="button"
              className="btn-ghost ml-auto"
              onClick={() =>
                setFacing(value => (value === "user" ? "environment" : "user"))
              }
              title="Alternar entre câmera frontal e traseira"
            >
              {facing === "user" ? "Câmera frontal" : "Câmera traseira"}
            </button>
          </div>

          <p className="text-[10.5px] leading-relaxed text-muted-foreground">
            A gravação entra na biblioteca de mídia e pode ser reutilizada em
            outras cenas. O áudio do microfone também é gravado — use a aba
            Legenda para transcrever o que você falou.
          </p>
        </div>
      </div>
    </div>
  );
}
