import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  CloudDownload,
  CloudUpload,
  Loader2,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  syncAllProjects,
  type SyncProgress,
  type SyncResult,
} from "@/lib/cloudSync";

interface CloudSyncButtonProps {
  onSynced?: () => void | Promise<void>;
}

export default function CloudSyncButton({ onSynced }: CloudSyncButtonProps) {
  const { configured, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!configured || !user) return null;

  const sync = async () => {
    setOpen(true);
    setBusy(true);
    setResult(null);
    setError(null);
    setProgress({
      phase: "checking",
      message: "Preparando a sincronização…",
      current: 0,
      total: 0,
    });

    try {
      const next = await syncAllProjects(setProgress);
      setResult(next);
      await onSynced?.();
    } catch (syncError) {
      setError((syncError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const percent =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : 0;

  return (
    <>
      <button
        type="button"
        className="btn-ghost whitespace-nowrap !px-2 !py-1.5 text-[11.5px]"
        onClick={() => void sync()}
        disabled={busy}
        title="Sincronizar projetos e mídias com a nuvem"
      >
        {busy ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Cloud size={13} />
        )}
        <span className="hidden sm:inline">
          {busy ? "Sincronizando…" : "Nuvem"}
        </span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Sincronização com a nuvem"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141419] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="wordmark text-[16px]">Nuvem do Studio Nova</h2>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  Os projetos mais novos do computador são enviados. Os projetos
                  mais novos da nuvem são baixados para este navegador.
                </p>
              </div>
              <button
                type="button"
                className="icon-btn shrink-0"
                onClick={() => setOpen(false)}
                disabled={busy}
                title={busy ? "Aguarde a sincronização" : "Fechar"}
              >
                <X size={14} />
              </button>
            </div>

            {busy || (!result && !error) ? (
              <div className="mt-5">
                <div className="flex items-center gap-2 text-[12px]">
                  <Loader2 size={14} className="animate-spin text-[var(--studio-accent)]" />
                  <span>{progress?.message ?? "Sincronizando…"}</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[var(--studio-accent)] transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  {progress?.total
                    ? `${progress.current} de ${progress.total} projeto(s)`
                    : "Procurando projetos na nuvem…"}
                </p>
              </div>
            ) : null}

            {error ? (
              <div className="mt-5 rounded-xl border border-red-400/20 bg-red-500/10 p-3">
                <p className="flex items-center gap-2 text-[12px] font-medium text-red-200">
                  <AlertTriangle size={14} /> Não foi possível sincronizar
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-red-100/80">
                  {error}
                </p>
              </div>
            ) : null}

            {result ? (
              <div className="mt-5 space-y-3">
                <div className="flex items-center gap-2 text-[12.5px] font-medium text-emerald-200">
                  <CheckCircle2 size={15} /> Sincronização concluída
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-white/8 bg-white/[0.03] p-2.5">
                    <CloudUpload size={14} className="mx-auto text-[var(--studio-teal)]" />
                    <p className="mt-1 text-[15px] font-semibold">{result.uploaded.length}</p>
                    <p className="text-[10px] text-muted-foreground">enviados</p>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/[0.03] p-2.5">
                    <CloudDownload size={14} className="mx-auto text-[var(--studio-teal)]" />
                    <p className="mt-1 text-[15px] font-semibold">{result.downloaded.length}</p>
                    <p className="text-[10px] text-muted-foreground">baixados</p>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/[0.03] p-2.5">
                    <Cloud size={14} className="mx-auto text-muted-foreground" />
                    <p className="mt-1 text-[15px] font-semibold">{result.skipped.length}</p>
                    <p className="text-[10px] text-muted-foreground">sem mudança</p>
                  </div>
                </div>

                {result.errors.length > 0 ? (
                  <div className="max-h-36 overflow-auto rounded-xl border border-amber-400/20 bg-amber-500/10 p-3">
                    <p className="flex items-center gap-2 text-[11.5px] font-medium text-amber-200">
                      <AlertTriangle size={13} /> Avisos
                    </p>
                    <ul className="mt-1.5 space-y-1 text-[10.5px] leading-relaxed text-amber-100/80">
                      {result.errors.map((message, index) => (
                        <li key={`${message}-${index}`}>{message}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            {!busy ? (
              <button
                type="button"
                className="btn-primary mt-5 w-full !py-2 text-[12px]"
                onClick={() => setOpen(false)}
              >
                Fechar
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
