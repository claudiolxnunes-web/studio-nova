import { useEffect, useRef, useState } from "react";
import { Captions, Mic, Square, Upload, Volume2, Wand2 } from "lucide-react";
import { narrationLength, PT_VOICES } from "@shared/editor";
import { estimateNarrationDuration, formatClock } from "@/lib/format";
import { mediaRegistry } from "@/engine/media";
import { useEditorContext } from "@/store/editor";
import { EmptyHint, Field, Section, Slider } from "../ui";

export default function VoiceTab() {
  const api = useEditorContext();
  const scene = api.scene;
  const [recording, setRecording] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const assetId = scene?.narration.assetId;

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!assetId) {
        setPreviewUrl(null);
        return;
      }
      const entry = mediaRegistry.get(assetId);
      if (entry?.url) {
        setPreviewUrl(entry.url);
        return;
      }
      const asset = api.project?.media.find(item => item.id === assetId);
      if (asset) {
        const loaded = await mediaRegistry.ensure(asset);
        if (alive && loaded?.url) setPreviewUrl(loaded.url);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [assetId, api.project?.media]);

  if (!scene) return null;

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setRecording(false);
        await api.attachNarrationAudio(blob, "mic");
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      window.alert("Não foi possível acessar o microfone. Verifique a permissão do navegador.");
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
  };

  return (
    <div className="space-y-5">
      <Section
        title="Roteiro da cena"
        description="Escreva exatamente o que deve ser falado. A narração usa vozes neurais em português brasileiro."
        right={
          <span className="font-mono text-[10px] text-muted-foreground">
            {scene.narration.text.trim().split(/\s+/).filter(Boolean).length} palavras
          </span>
        }
      >
        <textarea
          className="studio-input min-h-[130px] resize-y leading-relaxed"
          placeholder="Olá! Nesta aula eu vou te mostrar…"
          value={scene.narration.text}
          onChange={event => api.updateNarration({ text: event.target.value })}
        />
        <div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
          <span>Estimativa falada: {formatClock(estimateNarrationDuration(scene.narration.text))}</span>
          <span>Cena: {formatClock(scene.duration)}</span>
        </div>
      </Section>

      <Section title="Voz">
        <div className="space-y-2">
          {PT_VOICES.map(voice => (
            <button
              key={voice.id}
              type="button"
              onClick={() => api.updateNarration({ voiceId: voice.id })}
              className={`flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left transition ${
                scene.narration.voiceId === voice.id
                  ? "border-[var(--studio-accent)]/70 bg-[var(--studio-accent)]/10"
                  : "border-white/10 bg-white/[0.02] hover:border-white/25"
              }`}
            >
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/8 text-[11px] font-semibold text-foreground/80">
                {voice.name.slice(0, 1)}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-[12.5px] font-medium">
                  {voice.name}
                  <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[9.5px] text-muted-foreground">
                    {voice.gender}
                  </span>
                </span>
                <span className="block text-[10.5px] leading-relaxed text-muted-foreground">{voice.description}</span>
              </span>
            </button>
          ))}
        </div>
        <Slider
          label="Velocidade"
          min={0.7}
          max={1.4}
          step={0.05}
          value={scene.narration.rate}
          onChange={value => api.updateNarration({ rate: value })}
          format={value => `${value.toFixed(2)}x`}
        />
        <Slider
          label="Tom"
          min={0.8}
          max={1.2}
          step={0.05}
          value={scene.narration.pitch}
          onChange={value => api.updateNarration({ pitch: value })}
          format={value => value.toFixed(2)}
        />
      </Section>

      <Section title="Áudio da cena">
        <button
          type="button"
          className="btn-primary w-full"
          disabled={api.voiceBusy || !scene.narration.text.trim()}
          onClick={() => void api.generateVoice()}
        >
          <Wand2 size={14} />
          {scene.narration.assetId ? "Gerar novamente" : "Gerar narração"}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => (recording ? stopRecording() : void startRecording())}
            disabled={api.voiceBusy}
          >
            {recording ? <Square size={13} className="text-red-400" /> : <Mic size={13} />}
            {recording ? "Parar" : "Gravar"}
          </button>
          <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()} disabled={api.voiceBusy}>
            <Upload size={13} /> Enviar áudio
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={async event => {
            const file = event.target.files?.[0];
            if (file) await api.attachNarrationAudio(file, "upload");
            event.target.value = "";
          }}
        />

        {previewUrl ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
            <div className="mb-1 flex items-center justify-between text-[10.5px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Volume2 size={11} /> Narração atual
              </span>
              <span>
                {narrationLength(scene.narration)
                  ? formatClock(narrationLength(scene.narration))
                  : "—"}
                {scene.narration.source === "tts"
                  ? " · voz IA"
                  : scene.narration.source === "mic"
                    ? " · microfone"
                    : scene.narration.source === "upload"
                      ? " · arquivo"
                      : ""}
              </span>
            </div>
            <audio src={previewUrl} controls className="h-8 w-full" />
          </div>
        ) : (
          <EmptyHint>Esta cena ainda não tem áudio. Gere a narração, grave com o microfone ou envie um arquivo.</EmptyHint>
        )}

        {api.voiceStatus ? (
          <p className="rounded-lg bg-white/[0.04] px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
            {api.voiceStatus}
          </p>
        ) : null}
      </Section>

      <Section title="Legendas" description="Transcreva o áudio desta cena para legendar palavra por palavra.">
        <button
          type="button"
          className="btn-ghost w-full"
          disabled={api.voiceBusy || !scene.narration.assetId}
          onClick={() => void api.transcribeScene()}
        >
          <Captions size={13} />
          {scene.narration.words?.length ? "Refazer legendas desta cena" : "Gerar legendas desta cena"}
        </button>
        <Field label="Legenda atual">
          <textarea
            readOnly
            value={
              scene.narration.words?.length
                ? scene.narration.words.map(word => word.word).join(" ")
                : "Nenhuma legenda sincronizada ainda."
            }
            className="studio-input min-h-[64px] resize-none text-[11.5px] leading-relaxed text-muted-foreground"
          />
        </Field>
      </Section>
    </div>
  );
}
