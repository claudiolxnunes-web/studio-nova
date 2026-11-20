import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogIn, LogOut, Loader2, UserRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

function displayName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): string {
  const meta = user.user_metadata ?? {};
  const name =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    user.email?.split("@")[0] ||
    "Conta";
  return name;
}

export default function AccountButton() {
  const { configured, loading, user, signInWithGoogle, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!configured) return null;

  const login = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      const message = (error as Error).message;
      window.alert(
        `Não foi possível entrar com o Google.\n\n${message}\n\n` +
          "Confira se o provedor Google está ativo no Supabase e se a redirect URL está correta.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <span className="grid h-8 w-8 place-items-center text-muted-foreground">
        <Loader2 size={14} className="animate-spin" />
      </span>
    );
  }

  if (!user) {
    return (
      <button
        type="button"
        className="btn-ghost whitespace-nowrap !px-2 !py-1.5 text-[11.5px]"
        onClick={() => void login()}
        disabled={busy}
        title="Entrar com Gmail via Supabase"
      >
        {busy ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <LogIn size={13} />
        )}
        <span className="hidden sm:inline">Entrar com Gmail</span>
      </button>
    );
  }

  const meta = user.user_metadata ?? {};
  const avatar =
    typeof meta.avatar_url === "string"
      ? meta.avatar_url
      : typeof meta.picture === "string"
        ? meta.picture
        : "";
  const name = displayName(user);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] py-1 pl-1 pr-2 text-[11px] text-foreground/85 transition hover:bg-white/[0.08]"
        onClick={() => setOpen(value => !value)}
        title={user.email ?? "Conta"}
      >
        {avatar ? (
          <img
            src={avatar}
            alt={name}
            className="h-6 w-6 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="grid h-6 w-6 place-items-center rounded-full bg-white/10">
            <UserRound size={12} />
          </span>
        )}
        <span className="hidden max-w-[110px] truncate sm:block">{name}</span>
        <ChevronDown size={11} className="text-muted-foreground" />
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-56 overflow-hidden rounded-xl border border-white/10 bg-[#141419] p-1.5 shadow-2xl">
          <div className="border-b border-white/8 px-2 pb-2 pt-1">
            <p className="truncate text-[11.5px] font-medium">{name}</p>
            <p className="truncate text-[10px] text-muted-foreground">
              {user.email}
            </p>
          </div>
          <div className="px-2 py-2 text-[10px] leading-relaxed text-muted-foreground">
            Sessão Google conectada ao Supabase. A sincronização dos projetos
            será ativada na próxima etapa.
          </div>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] text-red-200 transition hover:bg-red-500/10"
            onClick={async () => {
              try {
                await signOut();
                setOpen(false);
              } catch (error) {
                window.alert((error as Error).message);
              }
            }}
          >
            <LogOut size={12} /> Sair
          </button>
        </div>
      ) : null}
    </div>
  );
}
