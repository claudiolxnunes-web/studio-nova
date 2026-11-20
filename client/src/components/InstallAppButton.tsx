import { useState } from "react";
import { Download, MonitorDown, Smartphone, X } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

export default function InstallAppButton() {
  const { canInstall, installed, install } = useInstallPrompt();
  const [helpOpen, setHelpOpen] = useState(false);

  if (installed) return null;

  const handleClick = async () => {
    if (canInstall) {
      const result = await install();
      if (result !== "unavailable") return;
    }
    setHelpOpen(true);
  };

  return (
    <>
      <button
        type="button"
        className="btn-ghost whitespace-nowrap !px-2 !py-1.5 text-[11.5px]"
        onClick={() => void handleClick()}
        title="Instalar o Studio Nova como aplicativo"
      >
        <Download size={13} />{" "}
        <span className="hidden md:inline">Instalar app</span>
      </button>

      {helpOpen ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-3 backdrop-blur-sm">
          <div className="panel w-full max-w-md p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="wordmark text-[15px]">Instalar o Studio Nova</h2>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  O app abre em uma janela própria e fica no menu de aplicativos.
                </p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setHelpOpen(false)}
                aria-label="Fechar"
              >
                <X size={15} />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-[11.5px] leading-relaxed text-muted-foreground">
              <div className="flex gap-2.5">
                <MonitorDown size={16} className="mt-0.5 shrink-0 text-[var(--studio-accent)]" />
                <div>
                  <p className="font-medium text-foreground/90">
                    Chrome / Edge no computador
                  </p>
                  <p>
                    Abra o Studio Nova em <code>http://localhost:3000</code>, clique
                    no ícone de instalação na barra de endereço e escolha{" "}
                    <strong>Instalar Studio Nova</strong>.
                  </p>
                </div>
              </div>
              <div className="flex gap-2.5">
                <Smartphone size={16} className="mt-0.5 shrink-0 text-[var(--studio-accent)]" />
                <div>
                  <p className="font-medium text-foreground/90">Celular</p>
                  <p>
                    No Android, use “Adicionar à tela inicial”. No iPhone, toque em
                    Compartilhar → “Adicionar à Tela de Início”.
                  </p>
                </div>
              </div>
              <p className="rounded-lg bg-white/[0.04] p-2.5 text-[10.5px]">
                Para o navegador liberar a instalação, o app precisa estar em{" "}
                <strong>localhost</strong> ou em um endereço <strong>HTTPS</strong>.
                O servidor precisa estar rodando para usar voz, IA e exportação.
              </p>
            </div>

            <button
              type="button"
              className="btn-primary mt-4 w-full"
              onClick={() => setHelpOpen(false)}
            >
              Entendi
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
