/**
 * Nomes, papéis e status das ferramentas de IA do Studio Nova.
 */
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Box,
  Cpu,
  ImageIcon,
  Loader2,
  Sparkles,
  UserRound,
  Wand2,
} from "lucide-react";
import { Link } from "wouter";
import { fetchEngines, type AvatarConfigView } from "@/lib/avatarApi";
import { fetchComfyStatus, type ComfyStatus } from "@/lib/comfyApi";
import { fetchNanoStatus, type NanoStatus } from "@/lib/nanoApi";
import { fetchTripoStatus, type TripoStatus } from "@/lib/tripoApi";

interface ToolCard {
  name: string;
  role: string;
  description: string;
  status: "on" | "off" | "ready";
  statusLabel: string;
  href: string;
  action: string;
  icon: typeof Box;
}

export default function Tools() {
  const [nano, setNano] = useState<NanoStatus | null>(null);
  const [tripo, setTripo] = useState<TripoStatus | null>(null);
  const [comfy, setComfy] = useState<ComfyStatus | null>(null);
  const [avatar, setAvatar] = useState<AvatarConfigView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.allSettled([
      fetchNanoStatus().then(setNano),
      fetchTripoStatus().then(setTripo),
      fetchComfyStatus().then(setComfy),
      fetchEngines().then(payload => setAvatar(payload.config)),
    ]).finally(() => setLoading(false));
  }, []);

  const tools: ToolCard[] = [
    {
      name: "Nano Banana",
      role: "Imagens Google",
      description:
        "Gemini/Nano Banana gera e edita imagens com a sua chave do Google AI Studio. Usa a cota da conta; se acabar, cai no próximo provedor.",
      status: nano?.configured ? "on" : "off",
      statusLabel: nano?.configured ? "configurado" : "não configurado",
      href: "/ajustes#nano",
      action: nano?.configured ? "Revisar chave" : "Configurar",
      icon: Sparkles,
    },
    {
      name: "Tripo 3D",
      role: "Objetos 3D",
      description:
        "Texto → modelo 3D em GLB, com preview interativo. Ideal para equipamentos, EPI, peças e diagramas técnicos de BPF.",
      status: tripo?.configured ? "on" : "off",
      statusLabel: tripo?.configured ? "configurado" : "não configurado",
      href: tripo?.configured ? "/tripo" : "/ajustes#tripo",
      action: tripo?.configured ? "Abrir laboratório" : "Configurar",
      icon: Box,
    },
    {
      name: "ComfyUI",
      role: "Imagens e vídeo local/online",
      description:
        "Seu próprio servidor ComfyUI, com GPU local ou remota. Usa workflows API e aceita placeholders de prompt, seed e tamanho.",
      status: comfy?.online ? "on" : comfy?.configured ? "off" : "off",
      statusLabel: comfy?.online
        ? "online"
        : comfy?.configured
          ? "offline"
          : "não configurado",
      href: "/ajustes#comfy",
      action: "Configurar",
      icon: Cpu,
    },
    {
      name: "HeyGen",
      role: "Apresentador fotorrealista",
      description:
        "Avatar de estúdio com corpo, gestos e lip sync. É o motor indicado para o padrão de qualidade do vídeo BPF.",
      status: avatar?.engines.heygen.configured ? "on" : "off",
      statusLabel: avatar?.engines.heygen.configured
        ? "configurado"
        : "não configurado",
      href: "/ajustes#heygen",
      action: "Configurar",
      icon: UserRound,
    },
    {
      name: "Pollinations",
      role: "Reserva grátis de imagens",
      description:
        "Fallback gratuito e sem chave. Entra automaticamente quando Nano Banana, ComfyUI ou o provedor preferido não estão disponíveis.",
      status: "ready",
      statusLabel: "sempre disponível",
      href: "/ajustes#nano",
      action: "Ver preferências",
      icon: ImageIcon,
    },
    {
      name: "Roteiro e postagem",
      role: "Automação de conteúdo",
      description:
        "Transforma um script em aula, carrossel, post ou story com narração, b-roll, legendas e pacote de publicação.",
      status: "ready",
      statusLabel: "pronto",
      href: "/roteiro",
      action: "Criar do roteiro",
      icon: Wand2,
    },
  ];

  return (
    <div className="studio-shell min-h-screen">
      <header className="border-b border-white/8 bg-[#0A0A0F]/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1100px] items-center gap-3 px-4">
          <Link href="/" className="btn-ghost h-8 w-8 p-0" aria-label="Voltar">
            <ArrowLeft size={15} />
          </Link>
          <div>
            <p className="wordmark text-[14px] leading-none">
              Ferramentas de IA
            </p>
            <p className="mt-1 text-[10.5px] text-muted-foreground">
              Como cada motor se chama, o que faz e onde configurar
            </p>
          </div>
          <Link href="/ajustes" className="btn-ghost ml-auto text-[11.5px]">
            Abrir Ajustes <ArrowUpRight size={12} />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-4 py-6">
        <div className="mb-4 rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,122,26,0.12),rgba(10,10,13,0.4)_55%,rgba(108,92,231,0.12))] p-5">
          <h1 className="wordmark text-[22px]">Um estúdio, vários motores</h1>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-muted-foreground">
            O Studio Nova orquestra ferramentas diferentes: Nano Banana e ComfyUI
            para imagens, Tripo para 3D, HeyGen para apresentador e Pollinations
            como reserva gratuita. As chaves ficam só na sua máquina.
          </p>
        </div>

        {loading ? (
          <div className="panel flex items-center gap-2 p-5 text-[12px] text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Verificando as
            ferramentas…
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {tools.map(tool => {
              const Icon = tool.icon;
              return (
                <article
                  key={tool.name}
                  className="panel flex flex-col gap-3 p-4 transition hover:border-white/20"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-[var(--studio-accent)]">
                      <Icon size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h2 className="text-[13.5px] font-semibold">
                          {tool.name}
                        </h2>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] ${
                            tool.status === "on"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : tool.status === "ready"
                                ? "bg-sky-500/15 text-sky-300"
                                : "bg-white/8 text-muted-foreground"
                          }`}
                        >
                          {tool.statusLabel}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10.5px] text-[var(--studio-teal)]">
                        {tool.role}
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {tool.description}
                  </p>
                  <Link
                    href={tool.href}
                    className="btn-ghost mt-auto w-full !py-1.5 text-[11px]"
                  >
                    {tool.action} <ArrowUpRight size={12} />
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
