import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Box,
  Check,
  Cpu,
  ExternalLink,
  Images,
  KeyRound,
  ListChecks,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { fetchEngines, saveAvatarConfig, type AvatarConfigView } from "@/lib/avatarApi";
import {
  fetchComfyCheckpoints,
  fetchComfyStatus,
  saveComfyConfig,
  type ComfyStatus,
} from "@/lib/comfyApi";
import { fetchStockStatus, saveStockKeys, type StockStatus } from "@/lib/stockApi";
import {
  fetchNanoStatus,
  saveNanoConfig,
  type NanoStatus,
} from "@/lib/nanoApi";
import {
  fetchTripoStatus,
  saveTripoConfig,
  type TripoStatus,
} from "@/lib/tripoApi";

interface ProviderField {
  id: "heygenKey" | "didKey" | "tavusKey";
  name: string;
  engine: "heygen" | "did" | "tavus";
  price: string;
  where: string;
  href: string;
  note: string;
}

const PROVIDERS: ProviderField[] = [
  {
    id: "heygenKey",
    name: "HeyGen",
    engine: "heygen",
    price: "Pago por minuto · teste grátis",
    where: "app.heygen.com → Settings → API",
    href: "https://app.heygen.com/settings?nav=API",
    note: "Avatares de estúdio com corpo e gestos. A melhor qualidade disponível hoje.",
  },
  {
    id: "didKey",
    name: "D-ID",
    engine: "did",
    price: "Pago por minuto · teste grátis",
    where: "studio.d-id.com → API keys",
    href: "https://studio.d-id.com/account-settings",
    note: "Transforma qualquer foto em apresentador falante. Excelente para retratos.",
  },
  {
    id: "tavusKey",
    name: "Tavus",
    engine: "tavus",
    price: "Pago · plano inicial gratuito",
    where: "platform.tavus.io → API key",
    href: "https://platform.tavus.io/",
    note: "Clona o seu próprio vídeo e gera aulas longas com o seu rosto.",
  },
];

interface StockField {
  id: "pixabayKey" | "pexelsKey" | "unsplashKey";
  provider: "pixabay" | "pexels" | "unsplash";
  name: string;
  price: string;
  where: string;
  href: string;
  note: string;
}

const STOCK_PROVIDERS: StockField[] = [
  {
    id: "pixabayKey",
    provider: "pixabay",
    name: "Pixabay",
    price: "100% grátis · sem cartão",
    where: "pixabay.com/api/docs → criar conta → sua chave aparece na página",
    href: "https://pixabay.com/api/docs/",
    note: "Fotos, vídeos e ilustrações para uso comercial, sem marca d'água. Busca em português.",
  },
  {
    id: "pexelsKey",
    provider: "pexels",
    name: "Pexels",
    price: "100% grátis · sem cartão",
    where: "pexels.com/api → Get started",
    href: "https://www.pexels.com/api/",
    note: "Fotos e vídeos em alta resolução, ótimos para fundos de cena e B-roll.",
  },
  {
    id: "unsplashKey",
    provider: "unsplash",
    name: "Unsplash",
    price: "100% grátis · 50 buscas/hora",
    where: "unsplash.com/developers → New application → Access Key",
    href: "https://unsplash.com/developers",
    note: "Fotografia autoral em alta resolução. A licença permite uso comercial.",
  },
];

export default function Settings() {
  const [config, setConfig] = useState<AvatarConfigView | null>(null);
  const [values, setValues] = useState({ heygenKey: "", didKey: "", tavusKey: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [stock, setStock] = useState<StockStatus | null>(null);
  const [stockValues, setStockValues] = useState({
    pixabayKey: "",
    pexelsKey: "",
    unsplashKey: "",
  });
  const [stockSaving, setStockSaving] = useState(false);
  const [stockSaved, setStockSaved] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);

  const [comfy, setComfy] = useState<ComfyStatus | null>(null);
  const [comfyValues, setComfyValues] = useState({
    url: "",
    token: "",
    checkpoint: "",
    workflow: "",
  });
  const [comfySaving, setComfySaving] = useState(false);
  const [comfyChecking, setComfyChecking] = useState(false);
  const [comfySaved, setComfySaved] = useState(false);
  const [comfyError, setComfyError] = useState<string | null>(null);
  const [checkpoints, setCheckpoints] = useState<string[]>([]);

  const [nano, setNano] = useState<NanoStatus | null>(null);
  const [nanoValues, setNanoValues] = useState({
    key: "",
    model: "gemini-nano-banana-2.1",
    imageSize: "1K",
  });
  const [nanoSaving, setNanoSaving] = useState(false);
  const [nanoSaved, setNanoSaved] = useState(false);
  const [nanoError, setNanoError] = useState<string | null>(null);

  const [tripo, setTripo] = useState<TripoStatus | null>(null);
  const [tripoValues, setTripoValues] = useState({
    key: "",
    model: "v3.1-20260211",
  });
  const [tripoSaving, setTripoSaving] = useState(false);
  const [tripoSaved, setTripoSaved] = useState(false);
  const [tripoError, setTripoError] = useState<string | null>(null);
  const [imagePreference, setImagePreference] = useState("auto");

  const applyComfyStatus = (status: ComfyStatus) => {
    setComfy(status);
    setComfyValues(current => ({
      url: status.url ?? "",
      token: current.token,
      checkpoint: status.checkpoint ?? "",
      workflow: status.workflow ?? "",
    }));
  };

  useEffect(() => {
    void fetchEngines()
      .then(payload => setConfig(payload.config))
      .catch(() => undefined);
    void fetchStockStatus()
      .then(next => setStock(next))
      .catch(() => undefined);
    void fetchComfyStatus()
      .then(applyComfyStatus)
      .catch(() => undefined);
    void fetchNanoStatus()
      .then(status => {
        setNano(status);
        setNanoValues(current => ({
          ...current,
          model: status.model || current.model,
          imageSize: status.imageSize || current.imageSize,
        }));
      })
      .catch(() => undefined);
    void fetchTripoStatus()
      .then(status => {
        setTripo(status);
        setTripoValues(current => ({
          ...current,
          model: status.model || current.model,
        }));
      })
      .catch(() => undefined);
    try {
      setImagePreference(
        localStorage.getItem("studio-image-provider") ?? "auto",
      );
    } catch {
      /* ignore */
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const next = await saveAvatarConfig({
        heygenKey: values.heygenKey || undefined,
        didKey: values.didKey || undefined,
        tavusKey: values.tavusKey || undefined,
      });
      setConfig(next);
      setValues({ heygenKey: "", didKey: "", tavusKey: "" });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStock = async () => {
    setStockSaving(true);
    setStockError(null);
    setStockSaved(false);
    try {
      const next = await saveStockKeys({
        pixabayKey: stockValues.pixabayKey || undefined,
        pexelsKey: stockValues.pexelsKey || undefined,
        unsplashKey: stockValues.unsplashKey || undefined,
      });
      setStock(next);
      setStockValues({ pixabayKey: "", pexelsKey: "", unsplashKey: "" });
      setStockSaved(true);
      setTimeout(() => setStockSaved(false), 3000);
    } catch (problem) {
      setStockError((problem as Error).message);
    } finally {
      setStockSaving(false);
    }
  };

  const persistComfyConfig = async () => {
    const next = await saveComfyConfig({
      url: comfyValues.url,
      token: comfyValues.token || undefined,
      checkpoint: comfyValues.checkpoint,
      workflow: comfyValues.workflow,
    });
    applyComfyStatus(next);
    setComfyValues(current => ({ ...current, token: "" }));
    return next;
  };

  const handleSaveComfy = async () => {
    setComfySaving(true);
    setComfyError(null);
    setComfySaved(false);
    try {
      await persistComfyConfig();
      setComfySaved(true);
      setTimeout(() => setComfySaved(false), 3000);
    } catch (problem) {
      setComfyError((problem as Error).message);
    } finally {
      setComfySaving(false);
    }
  };

  const handleTestComfy = async () => {
    setComfyChecking(true);
    setComfyError(null);
    try {
      await persistComfyConfig();
    } catch (problem) {
      setComfyError((problem as Error).message);
    } finally {
      setComfyChecking(false);
    }
  };

  const handleListCheckpoints = async () => {
    setComfyError(null);
    try {
      await persistComfyConfig();
      const list = await fetchComfyCheckpoints();
      setCheckpoints(list);
      if (list.length === 0) {
        setComfyError(
          "O ComfyUI respondeu, mas não encontrou checkpoints na pasta models/checkpoints.",
        );
      }
    } catch (problem) {
      setComfyError((problem as Error).message);
    }
  };

  const handleSaveNano = async () => {
    setNanoSaving(true);
    setNanoError(null);
    setNanoSaved(false);
    try {
      const status = await saveNanoConfig({
        key: nanoValues.key || undefined,
        model: nanoValues.model,
        imageSize: nanoValues.imageSize,
      });
      setNano(status);
      setNanoValues(current => ({ ...current, key: "" }));
      setNanoSaved(true);
      setTimeout(() => setNanoSaved(false), 3000);
    } catch (problem) {
      setNanoError((problem as Error).message);
    } finally {
      setNanoSaving(false);
    }
  };

  const handleSaveTripo = async () => {
    setTripoSaving(true);
    setTripoError(null);
    setTripoSaved(false);
    try {
      const status = await saveTripoConfig({
        key: tripoValues.key || undefined,
        model: tripoValues.model,
      });
      setTripo(status);
      setTripoValues(current => ({ ...current, key: "" }));
      setTripoSaved(true);
      setTimeout(() => setTripoSaved(false), 3000);
    } catch (problem) {
      setTripoError((problem as Error).message);
    } finally {
      setTripoSaving(false);
    }
  };

  return (
    <div className="studio-shell min-h-screen">
      <header className="border-b border-white/8 bg-[#0A0A0F]/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[900px] items-center gap-3 px-4">
          <Link href="/" className="btn-ghost h-8 w-8 p-0" aria-label="Voltar">
            <ArrowLeft size={15} />
          </Link>
          <div>
            <p className="wordmark text-[14px] leading-none">Chaves de API</p>
            <p className="mt-1 text-[10.5px] text-muted-foreground">
              Liga os motores de avatar profissionais
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[900px] space-y-4 px-4 py-6">
        <div className="panel flex items-start gap-3 p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300">
            <ShieldCheck size={17} />
          </span>
          <div>
            <p className="text-[12.5px] font-medium">As chaves ficam só na sua máquina</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Elas são gravadas em <code className="rounded bg-white/8 px-1">data/studio-config.json</code>{" "}
              com permissão restrita e nunca são enviadas ao navegador — o Studio Nova fala com o provedor
              por você. Por isso o avatar e a voz funcionam mesmo com o site aberto em outro computador da
              rede.
            </p>
          </div>
        </div>

        {PROVIDERS.map(provider => {
          const state = config?.engines[provider.engine];
          return (
            <section id={provider.engine} key={provider.id} className="panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-2 text-[13px] font-medium">
                    <KeyRound size={14} className="text-muted-foreground" />
                    {provider.name}
                    {state?.configured ? (
                      <span className="flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9.5px] text-emerald-300">
                        <Check size={10} /> conectado
                      </span>
                    ) : null}
                  </h2>
                  <p className="mt-0.5 text-[10.5px] text-muted-foreground">{provider.price}</p>
                </div>
                <a
                  href={provider.href}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost text-[10.5px]"
                >
                  Pegar a chave <ExternalLink size={12} />
                </a>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{provider.note}</p>
              <label className="mt-3 block">
                <span className="text-[10.5px] text-muted-foreground">
                  {state?.configured ? `Chave atual: ${state.hint} — cole outra para substituir` : provider.where}
                </span>
                <input
                  type="password"
                  value={values[provider.id]}
                  onChange={event =>
                    setValues(current => ({ ...current, [provider.id]: event.target.value }))
                  }
                  placeholder="Cole a chave aqui"
                  className="studio-input mt-1 w-full font-mono text-[11.5px]"
                />
              </label>
            </section>
          );
        })}

        <div className="panel p-4">
          <h2 className="text-[13px] font-medium">Ferramentas de IA</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Nomes e papéis de cada motor no Studio Nova:
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[
              ["Nano Banana", "imagens Google"],
              ["Tripo 3D", "objetos 3D"],
              ["ComfyUI", "imagens/vídeo local ou online"],
              ["HeyGen", "apresentador"],
              ["Pollinations", "reserva grátis"],
            ].map(([name, role]) => (
              <span
                key={name}
                className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-muted-foreground"
              >
                <strong className="text-foreground/85">{name}</strong> · {role}
              </span>
            ))}
          </div>
          <label className="mt-4 block max-w-md">
            <span className="label">Ordem de geração de imagem</span>
            <select
              className="studio-input mt-1 w-full"
              value={imagePreference}
              onChange={event => {
                const value = event.target.value;
                setImagePreference(value);
                try {
                  localStorage.setItem("studio-image-provider", value);
                } catch {
                  /* ignore */
                }
              }}
            >
              <option value="auto">
                Automático — Nano Banana → ComfyUI → grátis
              </option>
              <option value="nano">Nano Banana primeiro</option>
              <option value="comfy">ComfyUI primeiro</option>
              <option value="free">Só o gerador gratuito</option>
            </select>
          </label>
        </div>

        <section id="nano" className="panel space-y-4 border border-amber-500/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-[13px] font-medium">
                <Sparkles size={14} className="text-amber-300" />
                Nano Banana (Google)
                {nano?.configured ? (
                  <span className="flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9.5px] text-emerald-300">
                    <Check size={10} /> configurado
                  </span>
                ) : (
                  <span className="rounded bg-white/8 px-1.5 py-0.5 text-[9.5px] text-muted-foreground">
                    opcional
                  </span>
                )}
              </h2>
              <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                Imagens com Gemini/Nano Banana usando sua chave do Google AI Studio.
              </p>
            </div>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="btn-ghost text-[10.5px]"
            >
              Pegar a chave <ExternalLink size={12} />
            </a>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="label">
                Chave do Google AI Studio
                {nano?.configured ? " — cole outra para substituir" : ""}
              </span>
              <input
                type="password"
                className="studio-input mt-1 w-full font-mono text-[11.5px]"
                placeholder="AIza..."
                value={nanoValues.key}
                onChange={event =>
                  setNanoValues(current => ({ ...current, key: event.target.value }))
                }
              />
            </label>
            <label className="block">
              <span className="label">Modelo</span>
              <select
                className="studio-input mt-1 w-full"
                value={nanoValues.model}
                onChange={event =>
                  setNanoValues(current => ({
                    ...current,
                    model: event.target.value,
                  }))
                }
              >
                <option value="gemini-nano-banana-2.1">
                  Nano Banana 2.1 (recomendado)
                </option>
                <option value="gemini-3.1-flash-lite-image">
                  Nano Banana 2 Lite (mais barato/rápido)
                </option>
                <option value="gemini-3.1-flash-image">Nano Banana 2</option>
                <option value="gemini-3-pro-image">Nano Banana Pro</option>
                <option value="gemini-2.5-flash-image">Nano Banana legado</option>
              </select>
            </label>
            <label className="block">
              <span className="label">Resolução</span>
              <select
                className="studio-input mt-1 w-full"
                value={nanoValues.imageSize}
                onChange={event =>
                  setNanoValues(current => ({
                    ...current,
                    imageSize: event.target.value,
                  }))
                }
              >
                <option value="1K">1K (mais barato)</option>
                <option value="2K">2K</option>
                <option value="4K">4K (mais caro)</option>
              </select>
            </label>
          </div>

          <p className="text-[10.5px] leading-relaxed text-muted-foreground">
            {nano?.message ??
              "A cota gratuita depende da sua conta no Google AI Studio. Se ela acabar, o Studio Nova usa automaticamente o ComfyUI ou o gerador gratuito de reserva."}
          </p>

          {nanoError ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11.5px] text-red-200">
              {nanoError}
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSaveNano()}
              disabled={nanoSaving}
              className="btn-primary text-[11.5px]"
            >
              {nanoSaving ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Check size={13} />
              )}
              Salvar Nano Banana
            </button>
            {nanoSaved ? (
              <span className="text-[11px] text-emerald-300">Configuração salva.</span>
            ) : null}
          </div>
        </section>

        <section id="tripo" className="panel space-y-4 border border-violet-500/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-[13px] font-medium">
                <Box size={14} className="text-violet-300" />
                Tripo 3D
                {tripo?.configured ? (
                  <span className="flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9.5px] text-emerald-300">
                    <Check size={10} /> configurado
                  </span>
                ) : (
                  <span className="rounded bg-white/8 px-1.5 py-0.5 text-[9.5px] text-muted-foreground">
                    opcional
                  </span>
                )}
              </h2>
              <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                Objetos 3D a partir de texto, com GLB e preview.
              </p>
            </div>
            <a
              href="https://developers.tripo3d.ai/en/keys"
              target="_blank"
              rel="noreferrer"
              className="btn-ghost text-[10.5px]"
            >
              Pegar a chave <ExternalLink size={12} />
            </a>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="label">
                Chave da Tripo API
                {tripo?.configured ? " — cole outra para substituir" : ""}
              </span>
              <input
                type="password"
                className="studio-input mt-1 w-full font-mono text-[11.5px]"
                placeholder="tsk_..."
                value={tripoValues.key}
                onChange={event =>
                  setTripoValues(current => ({ ...current, key: event.target.value }))
                }
              />
            </label>
            <label className="block">
              <span className="label">Modelo</span>
              <select
                className="studio-input mt-1 w-full"
                value={tripoValues.model}
                onChange={event =>
                  setTripoValues(current => ({
                    ...current,
                    model: event.target.value,
                  }))
                }
              >
                <option value="v3.1-20260211">H3.1 — máxima qualidade</option>
                <option value="P2-20260801">P2 — game-ready / low poly</option>
                <option value="v3.0-20250812">v3.0 — estável</option>
              </select>
            </label>
            <div className="flex items-end">
              <Link href="/tripo" className="btn-ghost w-full !py-2 text-[11px]">
                Abrir laboratório 3D <ExternalLink size={12} />
              </Link>
            </div>
          </div>

          <p className="text-[10.5px] leading-relaxed text-muted-foreground">
            {tripo?.message ??
              "Cada modelo consome créditos da Tripo (1 crédito = US$ 0,01; text-to-3D custa 10–20 créditos)."}
          </p>

          {tripoError ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11.5px] text-red-200">
              {tripoError}
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSaveTripo()}
              disabled={tripoSaving}
              className="btn-primary text-[11.5px]"
            >
              {tripoSaving ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Check size={13} />
              )}
              Salvar Tripo
            </button>
            {tripoSaved ? (
              <span className="text-[11px] text-emerald-300">Configuração salva.</span>
            ) : null}
          </div>
        </section>

        <section id="comfy" className="panel space-y-4 border border-cyan-500/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-[13px] font-medium">
                <Cpu size={14} className="text-cyan-300" />
                ComfyUI — geração local
                {comfy?.online ? (
                  <span className="flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9.5px] text-emerald-300">
                    <Check size={10} /> online
                  </span>
                ) : comfy?.configured ? (
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9.5px] text-amber-300">
                    offline
                  </span>
                ) : (
                  <span className="rounded bg-white/8 px-1.5 py-0.5 text-[9.5px] text-muted-foreground">
                    opcional
                  </span>
                )}
              </h2>
              <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                Gere capas, cenários e retratos no seu próprio ComfyUI, com GPU.
              </p>
            </div>
            <a
              href="https://docs.comfy.org/development/comfyui-server/comms_overview"
              target="_blank"
              rel="noreferrer"
              className="btn-ghost text-[10.5px]"
            >
              Documentação <ExternalLink size={12} />
            </a>
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Rode o ComfyUI na máquina com GPU:
            <code className="mx-1 rounded bg-white/8 px-1">
              python main.py --listen 0.0.0.0 --port 8188
            </code>
            e informe a URL abaixo. O Studio Nova fala com o ComfyUI pelo servidor
            local; o navegador nunca acessa a porta 8188 diretamente. O ComfyUI não
            tem login nativo — proteja a porta com firewall/VPN ou um proxy com
            autenticação.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">URL do ComfyUI</span>
              <input
                className="studio-input mt-1 w-full font-mono text-[11.5px]"
                placeholder="http://127.0.0.1:8188"
                value={comfyValues.url}
                onChange={event =>
                  setComfyValues(current => ({ ...current, url: event.target.value }))
                }
              />
            </label>
            <label className="block">
              <span className="label">Token do proxy (opcional)</span>
              <input
                type="password"
                className="studio-input mt-1 w-full font-mono text-[11.5px]"
                placeholder="Bearer / X-API-Key"
                value={comfyValues.token}
                onChange={event =>
                  setComfyValues(current => ({ ...current, token: event.target.value }))
                }
              />
            </label>
          </div>

          <label className="block">
            <span className="label">Checkpoint padrão</span>
            <input
              className="studio-input mt-1 w-full font-mono text-[11.5px]"
              placeholder="sd_xl_base_1.0.safetensors"
              list="comfy-checkpoints"
              value={comfyValues.checkpoint}
              onChange={event =>
                setComfyValues(current => ({ ...current, checkpoint: event.target.value }))
              }
            />
            <datalist id="comfy-checkpoints">
              {checkpoints.map(name => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <span className="mt-1 block text-[10px] text-muted-foreground">
              Usado pelo grafo padrão quando você não informa um workflow próprio.
            </span>
          </label>

          <label className="block">
            <span className="label">Workflow API (opcional)</span>
            <textarea
              className="studio-input mt-1 min-h-[150px] w-full resize-y font-mono text-[10.5px] leading-relaxed"
              placeholder={'Cole o JSON exportado em "Save (API Format)".\n\nPlaceholders: {{PROMPT}}, {{NEGATIVE}}, {{SEED}}, {{WIDTH}}, {{HEIGHT}}, {{STEPS}}, {{CFG}}, {{CHECKPOINT}}'}
              value={comfyValues.workflow}
              onChange={event =>
                setComfyValues(current => ({ ...current, workflow: event.target.value }))
              }
            />
            <span className="mt-1 block text-[10px] leading-relaxed text-muted-foreground">
              Se vazio, o Studio usa um grafo SDXL padrão com o checkpoint acima.
              Se preenchido, o workflow é usado como está — coloque os placeholders
              nos nós de prompt, seed e tamanho.
            </span>
          </label>

          {comfy?.message ? (
            <p
              className={`text-[10.5px] ${
                comfy.online ? "text-emerald-300" : "text-amber-200"
              }`}
            >
              {comfy.message}
              {comfy.version ? ` · ComfyUI ${comfy.version}` : ""}
              {comfy.devices?.length
                ? ` · ${comfy.devices
                    .map(
                      device =>
                        `${device.name} (${Math.round(device.vramTotal / 1024 / 1024 / 1024)} GB)`,
                    )
                    .join(", ")}`
                : ""}
              {comfy.queueRunning || comfy.queuePending
                ? ` · fila ${comfy.queueRunning ?? 0}/${comfy.queuePending ?? 0}`
                : ""}
            </p>
          ) : null}

          {comfyError ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11.5px] text-red-200">
              {comfyError}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleTestComfy()}
              disabled={comfyChecking || !comfyValues.url}
              className="btn-ghost text-[11.5px]"
            >
              {comfyChecking ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <RefreshCw size={13} />
              )}
              Testar conexão
            </button>
            <button
              type="button"
              onClick={() => void handleListCheckpoints()}
              disabled={!comfyValues.url}
              className="btn-ghost text-[11.5px]"
            >
              <ListChecks size={13} /> Listar modelos
            </button>
            <button
              type="button"
              onClick={() => void handleSaveComfy()}
              disabled={comfySaving}
              className="btn-primary text-[11.5px]"
            >
              {comfySaving ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Check size={13} />
              )}
              Salvar ComfyUI
            </button>
            {comfySaved ? (
              <span className="text-[11px] text-emerald-300">Configuração salva.</span>
            ) : null}
          </div>
        </section>

        <div className="panel flex items-start gap-3 p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-500/15 text-sky-300">
            <Images size={17} />
          </span>
          <div>
            <p className="text-[12.5px] font-medium">Openverse já funciona, sem chave</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Fotos com licença livre (Creative Commons) para uso comercial, buscadas
              na hora na aba Mídia. Não precisa de cadastro. As chaves abaixo são só
              para Pixabay, Pexels e Unsplash, que têm acervos maiores.
            </p>
          </div>
        </div>

        {STOCK_PROVIDERS.map(provider => {
          const state = stock ? stock[provider.provider] : null;
          return (
            <section key={provider.id} className="panel p-4 border border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-2 text-[13px] font-medium">
                    <Images size={14} className="text-muted-foreground" />
                    {provider.name}
                    {state?.configured ? (
                      <span className="flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9.5px] text-emerald-300">
                        <Check size={10} /> configurado
                      </span>
                    ) : null}
                  </h2>
                  <p className="mt-0.5 text-[10.5px] text-muted-foreground">{provider.price}</p>
                </div>
                <a
                  href={provider.href}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost text-[10.5px]"
                >
                  Pegar a chave <ExternalLink size={12} />
                </a>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{provider.note}</p>
              <label className="mt-3 block">
                <span className="text-[10.5px] text-muted-foreground">
                  {state?.configured ? `Chave atual: ${state.hint} — cole outra para substituir` : provider.where}
                </span>
                <input
                  type="password"
                  value={stockValues[provider.id]}
                  onChange={event =>
                    setStockValues(current => ({ ...current, [provider.id]: event.target.value }))
                  }
                  placeholder="Cole a chave aqui"
                  className="studio-input mt-1 w-full font-mono text-[11.5px]"
                />
              </label>
            </section>
          );
        })}

        {stockError ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11.5px] text-red-200">
            {stockError}
          </p>
        ) : null}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveStock}
            disabled={stockSaving}
            className="btn-primary text-[12px]"
          >
            {stockSaving ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <Check size={14} />
            )}
            Salvar chaves das galerias
          </button>
          {stockSaved ? (
            <span className="text-[11px] text-emerald-300">Chaves salvas.</span>
          ) : null}
        </div>

        {error ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11.5px] text-red-200">
            {error}
          </p>
        ) : null}

        <div className="flex items-center gap-2">
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary text-[12px]">
            {saving ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
            Salvar chaves
          </button>
          {saved ? <span className="text-[11px] text-emerald-300">Chaves salvas.</span> : null}
        </div>

        <div className="panel p-4">
          <h2 className="text-[12.5px] font-medium">Não quer pagar nada?</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            O motor <strong className="text-foreground/80">Retrato Falante</strong> é gratuito, ilimitado e
            roda no seu navegador. A voz neural em português também é gratuita e sem cadastro. Você só
            precisa de chave se quiser clonar um corpo real ou gravar movimentos de estúdio.
          </p>
          <Link href="/avatar" className="btn-ghost mt-3 inline-flex text-[11.5px]">
            Voltar para o Avatar Studio
          </Link>
        </div>
      </main>
    </div>
  );
}
