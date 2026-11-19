import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Images,
  KeyRound,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { fetchEngines, saveAvatarConfig, type AvatarConfigView } from "@/lib/avatarApi";
import { fetchStockStatus, saveStockKeys, type StockStatus } from "@/lib/stockApi";

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

  useEffect(() => {
    void fetchEngines()
      .then(payload => setConfig(payload.config))
      .catch(() => undefined);
    void fetchStockStatus()
      .then(next => setStock(next))
      .catch(() => undefined);
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
            <section key={provider.id} className="panel p-4">
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
