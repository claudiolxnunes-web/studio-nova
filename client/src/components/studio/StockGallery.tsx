import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  Check,
  Film,
  Image as ImageIcon,
  Loader2,
  Play,
  Search,
} from "lucide-react";
import { useEditorContext } from "@/store/editor";
import {
  downloadStockItem,
  fetchStockStatus,
  fetchUnsplashPhoto,
  searchStock,
  type StockItem,
  type StockKind,
  type StockOrientation,
  type StockProvider,
  type StockStatus,
} from "@/lib/stockApi";

const SUGGESTIONS = [
  "natureza",
  "escritório",
  "cidade",
  "praia",
  "tecnologia",
  "sala de aula",
];

const PROVIDERS: Array<{ id: StockProvider; label: string; videos: boolean }> = [
  { id: "openverse", label: "Openverse · sem chave", videos: false },
  { id: "pixabay", label: "Pixabay", videos: true },
  { id: "pexels", label: "Pexels", videos: true },
  { id: "unsplash", label: "Unsplash", videos: false },
];

const ORIENTATIONS: Array<{ id: StockOrientation; label: string }> = [
  { id: "", label: "Tudo" },
  { id: "landscape", label: "Horizontal" },
  { id: "portrait", label: "Vertical" },
  { id: "square", label: "Quadrado" },
];

const PROVIDER_LABEL: Record<StockProvider, string> = {
  openverse: "Openverse",
  pixabay: "Pixabay",
  pexels: "Pexels",
  unsplash: "Unsplash",
};

function duration(seconds?: number): string {
  if (!seconds) return "";
  const total = Math.round(seconds);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

interface LoadOptions {
  page?: number;
  append?: boolean;
  provider?: StockProvider;
  kind?: StockKind;
  orientation?: StockOrientation;
  q?: string;
}

export default function StockGallery() {
  const api = useEditorContext();
  const [status, setStatus] = useState<StockStatus | null>(null);
  const [provider, setProvider] = useState<StockProvider>("openverse");
  const [kind, setKind] = useState<StockKind>("photo");
  const [orientation, setOrientation] = useState<StockOrientation>("");
  const [query, setQuery] = useState("natureza");
  const [items, setItems] = useState<StockItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [importedId, setImportedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [unsplashInput, setUnsplashInput] = useState("");
  const [unsplashLoading, setUnsplashLoading] = useState(false);

  useEffect(() => {
    void fetchStockStatus()
      .then(next => {
        setStatus(next);
        // If the user only has one key set, start there (Openverse always works).
        if (next.pixabay.configured && !next.pexels.configured && !next.unsplash.configured) {
          setProvider("pixabay");
        } else if (next.pexels.configured && !next.pixabay.configured) {
          setProvider("pexels");
        } else if (next.unsplash.configured && !next.pixabay.configured && !next.pexels.configured) {
          setProvider("unsplash");
        }
      })
      .catch(() => undefined);
  }, []);

  const activeProvider = PROVIDERS.find(item => item.id === provider) ?? PROVIDERS[0];
  const providerReady = status ? status[provider]?.configured !== false : true;
  const videoAllowed = activeProvider.videos;
  const resolvedKind: StockKind = videoAllowed ? kind : "photo";

  const load = async (options: LoadOptions = {}) => {
    const targetProvider = options.provider ?? provider;
    const targetKind = options.kind ?? resolvedKind;
    const targetOrientation = options.orientation ?? orientation;
    const term = (options.q ?? query).trim();
    const targetPage = options.page ?? 1;
    const append = options.append ?? false;

    if (term.length < 2) {
      setError("Digite pelo menos duas letras para buscar.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await searchStock({
        provider: targetProvider,
        kind: targetKind,
        q: term,
        page: targetPage,
        orientation: targetOrientation,
      });
      setItems(current => (append ? [...current, ...result.items] : result.items));
      setPage(result.page);
      setTotal(result.total);
      setSearched(true);
    } catch (problem) {
      setError((problem as Error).message);
      if (!append) {
        setItems([]);
        setTotal(0);
      }
    } finally {
      setLoading(false);
    }
  };

  const importUnsplashLink = async () => {
    if (!unsplashInput.trim()) {
      setError("Cole o link ou o ID da foto do Unsplash.");
      return;
    }
    setUnsplashLoading(true);
    setError(null);
    try {
      const item = await fetchUnsplashPhoto(unsplashInput);
      setProvider("unsplash");
      setKind("photo");
      setItems([item]);
      setTotal(1);
      setPage(1);
      setSearched(true);
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setUnsplashLoading(false);
    }
  };

  const handleImport = async (item: StockItem) => {
    setBusyId(item.id);
    setError(null);
    try {
      const file = await downloadStockItem(item);
      await api.importMediaFiles([file]);
      setImportedId(item.id);
      setTimeout(() => setImportedId(current => (current === item.id ? null : current)), 2500);
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5">
        <select
          value={provider}
          onChange={event => {
            const next = event.target.value as StockProvider;
            const nextVideos = PROVIDERS.find(item => item.id === next)?.videos ?? false;
            setProvider(next);
            setItems([]);
            setTotal(0);
            setSearched(false);
            if (!nextVideos && kind === "video") setKind("photo");
          }}
          className="studio-input flex-1 py-1.5 text-[11px]"
          aria-label="Banco de imagens"
        >
          {PROVIDERS.map(item => (
            <option key={item.id} value={item.id}>
              {item.label}
              {status && status[item.id]?.configured === false ? " (falta chave)" : ""}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-0.5 rounded-lg bg-white/[0.04] p-1">
          <button
            type="button"
            onClick={() => {
              setKind("photo");
              setItems([]);
              setSearched(false);
            }}
            className={`grid h-6 w-6 place-items-center rounded-md transition ${
              resolvedKind === "photo" ? "bg-white/10 text-foreground" : "text-muted-foreground"
            }`}
            title="Fotos"
          >
            <ImageIcon size={12} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (!videoAllowed) return;
              setKind("video");
              setItems([]);
              setSearched(false);
            }}
            disabled={!videoAllowed}
            className={`grid h-6 w-6 place-items-center rounded-md transition ${
              resolvedKind === "video" ? "bg-white/10 text-foreground" : "text-muted-foreground"
            } ${videoAllowed ? "" : "cursor-not-allowed opacity-40"}`}
            title={videoAllowed ? "Vídeos" : "Esse banco só tem fotos"}
          >
            <Film size={12} />
          </button>
        </div>
      </div>

      <form
        className="flex items-center gap-1.5"
        onSubmit={event => {
          event.preventDefault();
          void load({ page: 1, append: false });
        }}
      >
        <div className="relative flex-1">
          <Search
            size={12}
            className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={`Buscar no ${PROVIDER_LABEL[provider]}`}
            className="studio-input w-full py-1.5 pl-7 text-[11.5px]"
          />
        </div>
        <button type="submit" className="btn-ghost px-2 py-1.5 text-[11px]" disabled={loading}>
          {loading ? <Loader2 size={12} className="animate-spin" /> : "Buscar"}
        </button>
      </form>

      <form
        className="flex items-center gap-1.5"
        onSubmit={event => {
          event.preventDefault();
          void importUnsplashLink();
        }}
      >
        <input
          value={unsplashInput}
          onChange={event => setUnsplashInput(event.target.value)}
          placeholder="Colar link ou ID do Unsplash (opcional)"
          className="studio-input min-w-0 flex-1 py-1.5 text-[11px]"
        />
        <button
          type="submit"
          className="btn-ghost px-2 py-1.5 text-[10.5px]"
          disabled={unsplashLoading}
        >
          {unsplashLoading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            "Importar"
          )}
        </button>
      </form>

      <p className="text-[9.5px] leading-relaxed text-muted-foreground">
        No Unsplash, o crédito do fotógrafo é incluído no nome do arquivo
        importado. O link/ID usa a sua chave gratuita do Unsplash.
      </p>

      <div className="flex flex-wrap gap-1">
        {SUGGESTIONS.map(suggestion => (
          <button
            key={suggestion}
            type="button"
            onClick={() => {
              setQuery(suggestion);
              void load({ q: suggestion, page: 1, append: false });
            }}
            className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-muted-foreground transition hover:border-[var(--studio-accent)]/50 hover:text-[#ffc59b]"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {resolvedKind === "photo" ? (
        <div className="flex flex-wrap gap-1">
          {ORIENTATIONS.map(option => (
            <button
              key={option.id || "all"}
              type="button"
              onClick={() => {
                setOrientation(option.id);
                setItems([]);
                setSearched(false);
              }}
              className={`rounded-md border px-1.5 py-0.5 text-[9.5px] transition ${
                orientation === option.id
                  ? "border-[var(--studio-accent)]/60 bg-[var(--studio-accent)]/10 text-[#ffc59b]"
                  : "border-white/10 text-muted-foreground hover:text-foreground/80"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      {status && !providerReady ? (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">
          <p className="text-[10.5px] leading-relaxed text-muted-foreground">
            Falta a chave do {PROVIDER_LABEL[provider]} — é gratuita. O Openverse
            funciona sem chave.
          </p>
          <Link href="/ajustes" className="mt-1 inline-flex text-[10.5px] text-[#ffc59b]">
            Abrir Ajustes
          </Link>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[10.5px] leading-relaxed text-red-200">
          {error}
        </p>
      ) : null}

      {!searched && items.length === 0 && !loading && !error ? (
        <p className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2 text-[10.5px] leading-relaxed text-muted-foreground">
          Escolha um banco, digite o que procura e toque em Buscar. O Openverse já
          funciona sem chave; Pixabay, Pexels e Unsplash precisam de uma chave
          gratuita.
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className="grid grid-cols-2 gap-1.5">
          {items.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => void handleImport(item)}
              disabled={busyId !== null}
              className="group relative overflow-hidden rounded-lg border border-white/10 bg-black/30 text-left transition hover:border-[var(--studio-accent)]/60 disabled:opacity-70"
              title={`${item.title} · ${item.author} — clique para importar`}
            >
              <div className="relative h-20 w-full overflow-hidden bg-white/[0.04]">
                {item.thumb ? (
                  <img
                    src={item.thumb}
                    alt={item.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-muted-foreground">
                    {item.kind === "video" ? <Film size={16} /> : <ImageIcon size={16} />}
                  </div>
                )}
                {item.kind === "video" ? (
                  <span className="absolute inset-0 grid place-items-center bg-black/25 text-white">
                    <Play size={14} fill="currentColor" />
                  </span>
                ) : null}
                {item.duration ? (
                  <span className="absolute right-1 bottom-1 rounded bg-black/70 px-1 text-[9px] text-white/90">
                    {duration(item.duration)}
                  </span>
                ) : null}
                {busyId === item.id ? (
                  <span className="absolute inset-0 grid place-items-center bg-black/60 text-white">
                    <Loader2 size={16} className="animate-spin" />
                  </span>
                ) : null}
                {importedId === item.id ? (
                  <span className="absolute inset-0 grid place-items-center bg-emerald-600/70 text-white">
                    <Check size={18} />
                  </span>
                ) : null}
              </div>
              <p className="truncate px-1.5 py-1 text-[9.5px] text-muted-foreground">
                {item.author || PROVIDER_LABEL[item.provider]}
              </p>
            </button>
          ))}
        </div>
      ) : null}

      {items.length > 0 && items.length < total ? (
        <button
          type="button"
          className="btn-ghost w-full text-[11px]"
          disabled={loading}
          onClick={() => void load({ page: page + 1, append: true })}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : "Carregar mais"}
        </button>
      ) : null}

      {items.length > 0 ? (
        <p className="text-[9.5px] leading-relaxed text-muted-foreground">
          {items.length} de {total} resultados · {PROVIDER_LABEL[provider]}. Clique
          em uma miniatura para importar.{" "}
          {provider === "openverse" ? "Licenças livres para uso comercial (CC)." : ""}
        </p>
      ) : (
        <p className="text-[9.5px] leading-relaxed text-muted-foreground">
          Fotos e vídeos gratuitos, sem marca d'água.{" "}
          <Link href="/ajustes" className="text-[#ffc59b]">
            Gerir chaves
          </Link>
          .
        </p>
      )}
    </div>
  );
}
