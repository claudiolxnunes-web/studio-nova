import { ArrowLeft, Download, Info, TriangleAlert } from "lucide-react";
import { Link } from "wouter";

type Block =
  | { type: "p"; text: string }
  | { type: "steps"; items: string[] }
  | { type: "list"; items: string[] }
  | { type: "table"; head: string[]; rows: string[][] }
  | { type: "note"; text: string; tone?: "info" | "warn" };

interface GuideSection {
  id: string;
  title: string;
  blocks: Block[];
}

const SECTIONS: GuideSection[] = [
  {
    id: "visao",
    title: "1. O que é o Studio Nova",
    blocks: [
      {
        type: "p",
        text: "O Studio Nova é um estúdio de criação que roda no navegador. Você monta a peça em **cenas** — cada cena é uma tela com textos, imagens, vídeos, formas e avatar — e o estúdio grava o resultado em **vídeo com áudio** ou gera **imagens PNG** para publicar.",
      },
      {
        type: "list",
        items: [
          "**Aula em vídeo** para Hotmart e YouTube, com narração em português brasileiro e legendas sincronizadas.",
          "**Post de feed, carrossel, capa de blog, chamada de live e anúncio** no formato certo para cada canal.",
          "**Avatar** de apresentador vetorial ou a partir de uma foto sua, com movimento de fala.",
          "Tudo salvo no seu navegador: nenhum projeto é enviado para servidor de terceiros.",
        ],
      },
      {
        type: "note",
        text: "A voz e a transcrição usam o servidor do próprio site. Os projetos, imagens e vídeos importados ficam apenas no seu navegador.",
      },
    ],
  },
  {
    id: "criar",
    title: "2. Criar o primeiro projeto",
    blocks: [
      {
        type: "steps",
        items: [
          "Abra a página inicial e dê um nome ao projeto no campo do topo (opcional — dá para renomear depois).",
          "Escolha um dos seis cartões: **Aula em vídeo**, **Post de feed**, **Carrossel**, **Capa de blog**, **Chamada de live** ou **Anúncio/Stories**.",
          "O projeto abre já no formato certo e com cenas de exemplo montadas.",
          "Troque os textos clicando neles no palco e editando na aba **Elemento**.",
        ],
      },
      {
        type: "table",
        head: ["Tipo", "Formato inicial", "Sai como"],
        rows: [
          ["Aula em vídeo", "1920×1080 (16:9)", "Vídeo MP4 com narração"],
          ["Post de feed", "1080×1350 (4:5)", "Imagem PNG"],
          ["Carrossel", "1080×1350 (4:5), 4 slides", "4 imagens PNG"],
          ["Capa de blog", "1200×630 (1.91:1)", "Imagem PNG"],
          ["Chamada de live", "1920×1080 (16:9)", "Imagem PNG ou vídeo curto"],
          ["Anúncio / Stories", "1080×1920 (9:16)", "Vídeo ou imagem vertical"],
        ],
      },
    ],
  },
  {
    id: "tela",
    title: "3. Mapa da tela do editor",
    blocks: [
      {
        type: "list",
        items: [
          "**Barra superior**: nome do projeto, formatos rápidos, desfazer/refazer e o botão **Exportar**.",
          "**Coluna de cenas** (esquerda): lista na ordem de reprodução. Use + para nova cena, e os ícones para duplicar, dividir no tempo atual e excluir.",
          "**Palco** (centro): a prévia real. Clique para selecionar um elemento, arraste para mover, use os cantos para redimensionar e a alça de cima para girar.",
          "**Barra do palco**: reproduzir, tempo, área segura para redes sociais, grade de terços, zoom e o tamanho do projeto.",
          "**Linha do tempo** (embaixo): cenas em blocos proporcionais à duração. Clique para pular, arraste para reordenar.",
          "**Painel** (direita): sete abas de edição — Cena, Camadas, Elemento, Voz, Legenda, Mídia e Ajustes.",
        ],
      },
      {
        type: "note",
        text: "No celular o painel vai para baixo do palco. As abas continuam todas acessíveis; role o painel para ver os controles.",
      },
    ],
  },
  {
    id: "abas",
    title: "4. O que cada aba faz",
    blocks: [
      {
        type: "list",
        items: [
          "**Cena**: modelos prontos (Capa, Tópico, 3 pontos, Checklist, Citação, Post de feed, Capa de blog, Chamada de live, Oferta), nome, duração, transição de entrada e fundo (cor, gradiente, imagem ou vídeo).",
          "**Camadas**: ordem de empilhamento. Subir/descer, ocultar, travar, duplicar e excluir.",
          "**Elemento**: tudo do item selecionado — alinhamento rápido, espelhar, posição, tamanho, rotação, opacidade, modo de mistura, filtros, borda, sombra e animação de entrada.",
          "**Voz**: roteiro da cena, escolha da voz, velocidade, tom, geração da narração, gravação pelo microfone e envio de áudio.",
          "**Legenda**: transcreve o áudio da cena e define estilo — posição, tamanho, cores, fundo, palavras por linha e destaque da palavra falada.",
          "**Mídia**: importa imagens, vídeos e áudios, gera imagem por IA e remove o que não usa mais.",
          "**Ajustes**: nome, formato de publicação, cor da marca, resumo do projeto e exclusão.",
        ],
      },
    ],
  },
  {
    id: "fluxo-aula",
    title: "5. Fluxo completo: aula em vídeo",
    blocks: [
      {
        type: "steps",
        items: [
          "Crie um projeto **Aula em vídeo**. A abertura já vem com título, subtítulo e avatar.",
          "Ajuste o texto da abertura e escreva o **roteiro** na aba Voz, como você falaria em aula.",
          "Escolha a voz (Francisca, Thalita ou Antônio), regule velocidade e tom e clique em **Gerar narração**.",
          "Clique em **Ajustar duração ao áudio** para a cena durar exatamente o tempo da fala.",
          "Repita nas outras cenas. Use **Duplicar cena** para manter o mesmo estilo e mudar só o texto.",
          "Abra a aba Legenda e clique em **Gerar legendas** em cada cena narrada.",
          "Aperte **Prévia** e assista à aula inteira antes de exportar.",
          "Clique em **Exportar**, escolha resolução, qualidade e fps, e mantenha a aba aberta até o fim.",
        ],
      },
      {
        type: "note",
        text: "A gravação acontece em tempo real: uma aula de 10 minutos leva cerca de 10 minutos para gravar. Você pode continuar navegando em outra aba, mas não feche esta.",
        tone: "warn",
      },
    ],
  },
  {
    id: "fluxo-post",
    title: "6. Fluxo completo: post e carrossel",
    blocks: [
      {
        type: "steps",
        items: [
          "Crie um projeto **Carrossel** (4 slides prontos) ou **Post de feed** (arte única).",
          "Em cada slide, troque o título e a linha de apoio. Use a aba Elemento para aumentar ou reduzir o texto.",
          "Se quiser foto no fundo, importe na aba Mídia e aplique em Cena → Fundo → Imagem, com desfoque e escurecimento.",
          "Ajuste a cor da marca em Ajustes para combinar com o seu perfil.",
          "Clique em **Exportar** → **Imagem PNG** → **Todas as cenas** para baixar o carrossel inteiro.",
        ],
      },
      {
        type: "p",
        text: "As imagens saem em dobro de resolução (por exemplo, 2160×2700 no carrossel), o que mantém o texto nítido depois da compressão do Instagram.",
      },
    ],
  },
  {
    id: "fluxo-blog",
    title: "7. Fluxo completo: capa de blog e live",
    blocks: [
      {
        type: "list",
        items: [
          "**Capa de blog**: projeto em 1200×630, com moldura, selo LEIA e espaço para foto. Exporte em PNG e suba no seu blog ou use como imagem de compartilhamento.",
          "**Chamada de live**: projeto em 16:9 com selo AO VIVO, título, data e apresentador. Serve como thumbnail do YouTube, capa de evento ou story de aviso.",
          "**Anúncio/Stories**: vertical com etiqueta, oferta, benefício e botão. Pode sair como imagem ou como vídeo de 5 a 15 segundos com narração.",
        ],
      },
    ],
  },
  {
    id: "voz",
    title: "8. Voz: como tirar o melhor resultado",
    blocks: [
      {
        type: "list",
        items: [
          "Escreva frases curtas, com ponto final. Vírgulas e pontos viram pausas naturais.",
          "Evite abreviações e símbolos: escreva “por cento” em vez de “%”, “número” em vez de “nº”.",
          "Números longos e siglas podem ser lidos errado — escreva por extenso quando importar.",
          "Use velocidade 0,9 a 1,1 para aula; 1,15 para Reels e Shorts.",
          "Prefere a sua voz? Grave pelo microfone na própria aba Voz, ou envie um áudio já gravado.",
        ],
      },
      {
        type: "note",
        text: "A geração de voz não tem limite de caracteres nem cobrança por uso: o servidor do site usa voz neural com cache e um provedor alternativo quando necessário.",
      },
    ],
  },
  {
    id: "avatar",
    title: "9. Avatar: apresentador ou sua foto",
    blocks: [
      {
        type: "p",
        text: "O avatar aparece nas cenas como qualquer elemento: dá para mover, redimensionar, espelhar e trocar de cor do anel. A boca e o balanço acompanham a narração da cena.",
      },
      {
        type: "list",
        items: [
          "**Apresentador**: quatro personagens vetoriais, leves e sempre nítidos em qualquer resolução.",
          "**Minha foto**: importe o retrato na aba Mídia, selecione o avatar e escolha a foto. O rosto é detectado e enquadrado automaticamente.",
        ],
      },
      {
        type: "note",
        text: "Para a foto funcionar bem: use um retrato frontal, com o rosto ocupando boa parte do quadro, luz uniforme e fundo simples. O movimento é uma animação de fala — não é reconstrução fotorrealista de vídeo.",
        tone: "warn",
      },
    ],
  },
  {
    id: "exportar",
    title: "10. Exportar para cada canal",
    blocks: [
      {
        type: "table",
        head: ["Canal", "Formato", "Saída"],
        rows: [
          [
            "Hotmart / área de membros",
            "16:9",
            "Vídeo 1080p, 30 fps, qualidade alta",
          ],
          ["YouTube", "16:9", "Vídeo 1080p, 30 fps"],
          ["Reels, TikTok, Shorts", "9:16", "Vídeo 1080p, 30 fps, com legenda"],
          ["Stories e anúncios", "9:16", "Vídeo curto ou PNG"],
          ["Feed e carrossel", "4:5", "PNG em dobro de resolução"],
          ["Capa de blog", "1.91:1", "PNG 2400×1260"],
          ["Thumbnail de live", "16:9", "PNG ou vídeo curto"],
        ],
      },
      {
        type: "list",
        items: [
          "**Vídeo**: escolha 1080p/720p/540p, qualidade e 30 ou 24 fps. O arquivo sai em MP4 quando o navegador suporta; caso contrário, WebM.",
          "**Imagem PNG**: exporte a cena atual ou todas as cenas de uma vez, sempre em dobro de resolução.",
          "O nome do arquivo vem do nome do projeto, sem acentos.",
        ],
      },
    ],
  },
  {
    id: "atalhos",
    title: "11. Atalhos de teclado",
    blocks: [
      {
        type: "table",
        head: ["Atalho", "Ação"],
        rows: [
          ["Espaço", "Reproduzir / pausar a prévia"],
          ["Setas", "Mover o elemento selecionado (Shift move 20 px)"],
          ["Delete ou Backspace", "Excluir o elemento selecionado"],
          ["Esc", "Desmarcar"],
          ["Ctrl/Cmd + Z", "Desfazer"],
          ["Ctrl/Cmd + Shift + Z", "Refazer"],
          ["Ctrl/Cmd + D", "Duplicar elemento"],
        ],
      },
    ],
  },
  {
    id: "roteiro",
    title: "12. Vídeo a partir do roteiro",
    blocks: [
      {
        type: "steps",
        items: [
          "Na página inicial, clique em **Colar roteiro e gerar vídeo** (ou no ícone de varinha dentro do editor).",
          "Cole o texto: **cada parágrafo separado por linha em branco vira uma cena**.",
          "Escolha voz, velocidade, formato, avatar e legendas.",
          "Clique em **Gerar vídeo completo** e acompanhe a barra de progresso.",
          "O projeto abre no editor para revisão e exportação.",
        ],
      },
      {
        type: "note",
        text: "O estúdio narra cada cena, ajusta a duração ao áudio e sincroniza as legendas palavra por palavra — sem limite de 10 segundos e sem juntar partes em outro programa.",
      },
    ],
  },
  {
    id: "camera",
    title: "13. Filmar e inserir",
    blocks: [
      {
        type: "p",
        text: "Em **Mídia → Filmar agora** você grava pela câmera do computador ou do celular e escolhe onde o clipe entra: como camada sobre o fundo ou ocupando a cena inteira.",
      },
      {
        type: "list",
        items: [
          "O áudio do microfone é gravado junto — a legenda pode ser gerada na aba Legenda.",
          "A gravação fica na biblioteca e pode ser reutilizada em outras cenas.",
          "É o caminho mais realista: você aparece com movimento e voz naturais.",
        ],
      },
    ],
  },
  {
    id: "cenarios",
    title: "14. Cenários realistas",
    blocks: [
      {
        type: "p",
        text: "Em **Mídia → Cenários realistas** há sete fundos fotorrealistas gerados por IA: cidade, campo, floresta, praia, montanha, interior e estúdio. O cenário entra já com movimento lento de câmera.",
      },
      {
        type: "list",
        items: [
          "Troque o movimento em **Cena → Fundo → Movimento da câmera** (Parado, Aproximar, Afastar).",
          "O mesmo movimento vale para fotos e vídeos importados.",
          "Para avatar realista use **Minha foto** ou gere um **retrato por IA** em Elemento → Avatar.",
        ],
      },
    ],
  },
  {
    id: "operacao",
    title: "15. Operacionalização do dia a dia",
    blocks: [
      {
        type: "list",
        items: [
          "**Onde ficam os dados**: projetos, imagens, vídeos e áudios ficam no IndexedDB do navegador. Não há login: quem usa outro navegador ou outro computador começa vazio.",
          "**Backup**: use **Duplicar** antes de mudanças grandes e exporte o vídeo/PNG final. Limpar dados do site no navegador apaga os projetos.",
          "**Navegador**: Chrome ou Edge atualizados. Safari e Firefox gravam em WebM e podem ter limitações de áudio.",
          "**Desempenho**: vídeos de apoio grandes deixam a prévia pesada. Prefira clipes de até 30 segundos e imagens de até 2000 px.",
          "**Gravação em tempo real**: para aulas longas, grave por partes (uma cena ou bloco) e junte depois no editor de vídeo do sistema.",
          "**Publicação**: o site publicado é atualizado quando um novo checkpoint é publicado; o código-fonte fica no repositório do GitHub conectado.",
        ],
      },
      {
        type: "note",
        text: "Trabalhe sempre em uma aba só do editor por projeto. Duas abas abertas no mesmo projeto podem sobrescrever a última alteração salva.",
        tone: "warn",
      },
    ],
  },
  {
    id: "checklist",
    title: "16. Checklist antes de publicar",
    blocks: [
      {
        type: "steps",
        items: [
          "Assisti à prévia inteira, sem cortes de áudio nem texto fora da área segura.",
          "Conferi nome do projeto, formato e cor da marca em Ajustes.",
          "Todas as cenas narradas têm legenda gerada e revisada.",
          "O avatar não cobre texto e o anel está na cor certa.",
          "Exportei o vídeo (ou as imagens) e assisti ao arquivo baixado.",
          "Salvei uma cópia do projeto (Duplicar) antes de começar a próxima versão.",
        ],
      },
    ],
  },
  {
    id: "problemas",
    title: "17. Problemas comuns",
    blocks: [
      {
        type: "table",
        head: ["Sintoma", "O que fazer"],
        rows: [
          [
            "Botão de gerar voz não conclui",
            "Verifique a conexão e tente novamente; o servidor alterna de provedor automaticamente.",
          ],
          [
            "Legenda não é gerada",
            "A cena precisa ter narração gerada ou áudio anexado antes de transcrever.",
          ],
          [
            "Exportação para em 0%",
            "Feche outras abas pesadas e confirme que o navegador permite gravação de tela/mídia.",
          ],
          [
            "Vídeo sai sem áudio",
            "Confira se a cena tem narração e se o volume do sistema não está mudo.",
          ],
          [
            "Texto cortado no celular",
            "Use a área segura (ícone de escudo) e mantenha textos a 8% das bordas.",
          ],
          [
            "Projeto sumiu",
            "Confirme o mesmo navegador e perfil; dados não são sincronizados entre dispositivos.",
          ],
        ],
      },
    ],
  },
];

function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={index} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
}

function BlockView({ block }: { block: Block }) {
  if (block.type === "p") {
    return (
      <p className="text-[12.5px] leading-relaxed text-muted-foreground">
        <RichText text={block.text} />
      </p>
    );
  }
  if (block.type === "list") {
    return (
      <ul className="space-y-1.5">
        {block.items.map((item, index) => (
          <li
            key={index}
            className="flex gap-2 text-[12.5px] leading-relaxed text-muted-foreground"
          >
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--studio-accent)]" />
            <span>
              <RichText text={item} />
            </span>
          </li>
        ))}
      </ul>
    );
  }
  if (block.type === "steps") {
    return (
      <ol className="space-y-2">
        {block.items.map((item, index) => (
          <li
            key={index}
            className="flex gap-2.5 text-[12.5px] leading-relaxed text-muted-foreground"
          >
            <span className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full border border-[var(--studio-accent)]/40 bg-[var(--studio-accent)]/10 font-mono text-[10px] text-[#ffc59b]">
              {index + 1}
            </span>
            <span>
              <RichText text={item} />
            </span>
          </li>
        ))}
      </ol>
    );
  }
  if (block.type === "table") {
    return (
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full border-collapse text-left text-[12px]">
          <thead>
            <tr className="bg-white/[0.04]">
              {block.head.map(cell => (
                <th
                  key={cell}
                  className="px-2.5 py-2 font-semibold text-foreground/90"
                >
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-white/[0.06]">
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="px-2.5 py-2 align-top text-muted-foreground"
                  >
                    <RichText text={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  const warn = block.tone === "warn";
  return (
    <p
      className={`flex gap-2 rounded-xl border px-3 py-2 text-[12px] leading-relaxed ${
        warn
          ? "border-amber-400/30 bg-amber-400/10 text-amber-100/90"
          : "border-[var(--studio-teal)]/25 bg-[var(--studio-teal)]/10 text-[#b8efe8]"
      }`}
    >
      {warn ? (
        <TriangleAlert size={13} className="mt-0.5 shrink-0" />
      ) : (
        <Info size={13} className="mt-0.5 shrink-0" />
      )}
      <span>
        <RichText text={block.text} />
      </span>
    </p>
  );
}

export default function Help() {
  return (
    <div className="studio-shell min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#0b0b10]/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href="/" className="icon-btn" title="Voltar para os projetos">
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0">
            <p className="wordmark text-[15px] leading-tight">
              Tutorial do Studio Nova
            </p>
            <p className="text-[10.5px] text-muted-foreground">
              Uso do editor e operação no dia a dia
            </p>
          </div>
          <a
            href="/guia-studio-nova.pdf"
            download
            className="btn-ghost ml-auto !py-1.5 text-[11.5px]"
          >
            <Download size={13} /> Baixar em PDF
          </a>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="hidden lg:block">
          <div className="sticky top-24 space-y-1">
            <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Neste tutorial
            </p>
            {SECTIONS.map(section => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="block truncate rounded-lg px-2 py-1.5 text-[11.5px] text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
              >
                {section.title}
              </a>
            ))}
          </div>
        </nav>

        <div className="space-y-5">
          <section className="panel p-4 sm:p-5">
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              Este guia cobre o uso completo do Studio Nova — criação, edição,
              voz, avatar, legendas, exportação — e a operação do dia a dia:
              onde os dados ficam, como fazer backup, o que esperar de cada
              navegador e como o site publicado é atualizado.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[10.5px] text-muted-foreground">
              <span className="chip">17 seções</span>
              <span className="chip">atalhos incluídos</span>
              <span className="chip">checklist de publicação</span>
            </div>
          </section>

          {SECTIONS.map(section => (
            <section
              key={section.id}
              id={section.id}
              className="panel scroll-mt-24 p-4 sm:p-5"
            >
              <h2 className="wordmark text-[14px]">{section.title}</h2>
              <div className="mt-3 space-y-3">
                {section.blocks.map((block, index) => (
                  <BlockView key={index} block={block} />
                ))}
              </div>
            </section>
          ))}

          <section className="panel-quiet p-4 text-[11px] leading-relaxed text-muted-foreground">
            Dúvida que não está aqui? Volte para a página inicial, abra um
            projeto e use a aba correspondente — cada controle tem uma dica ao
            passar o mouse. O guia em PDF é gerado a partir deste mesmo
            conteúdo.
          </section>
        </div>
      </main>
    </div>
  );
}
