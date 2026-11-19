# Studio Nova — como rodar na sua máquina

Este pacote é o Studio Nova: um estúdio de criação completo (aulas, reels, carrosséis,
posts, thumbs) com **apresentadores que falam o seu roteiro**. Roda no seu computador,
sem conta e sem mensalidade.

## O que você precisa

- Node.js 20 ou superior (`node -v`)
- pnpm 9 ou superior (`npm i -g pnpm`)
- Python 3 com o pacote de voz neural (**grátis**):

```bash
python3 -m pip install --user --break-system-packages edge-tts
```

Sem o Python o estúdio continua funcionando, mas a narração cai para uma voz
robótica de reserva. Com ele você tem as vozes neurais em português brasileiro.

## Instalar e abrir

```bash
pnpm install
pnpm dev
```

Abra http://localhost:3000. Para usar outra porta: `PORT=4000 pnpm dev`.

## Build de produção

```bash
pnpm build
pnpm start
```

Por padrão o servidor escuta apenas em `127.0.0.1` (o seu computador). Para abrir
na rede local de propósito, use `HOST=0.0.0.0 pnpm start` — mas saiba que as
rotas de voz, IA e chaves ficam acessíveis para quem estiver na mesma rede. Em
Docker o `HOST=0.0.0.0` já vem configurado e a porta é publicada explicitamente.

## O que você ganha de graça (sem chave nenhuma)

| Ferramenta | Como funciona |
| --- | --- |
| **Avatar Studio** (`/avatar`) | Seu retrato ou um apresentador da biblioteca fala o roteiro. O motor *Retrato Falante* roda no navegador: pisca, respira, mexe a boca junto com o áudio e exporta vídeo. |
| **Voz neural PT-BR** | Vozes Francisca, Thalita e Antônio, com controle de velocidade e tom. |
| **Legendas automáticas** | Sincronizadas pelo tempo do áudio, direto na cena. |
| **Imagens por IA** | Gerador aberto (Flux) sem cadastro. O plano gratuito libera 1 imagem a cada ~45s; o estúdio espera a fila sozinho. |
| **Editor completo** | Cenas, camadas, formas, gradientes, Ken Burns, transições, carrossel, thumb, exportação de vídeo e PNG. |
| **Exportação rápida** | MP4 com H.264 via WebCodecs em worker, mais rápido que o tempo real. Em navegadores sem os codecs, cai automaticamente para a gravação em tempo real. |
| **Backup `.nova.zip`** | Exporte e importe o projeto completo com todas as mídias e legendas. |
| **Legendas publicáveis** | Baixe `.srt` e `.vtt` com o tempo da timeline, prontos para YouTube, Hotmart e LMS. |
| **Pacote de publicação** | ZIP com todas as cenas em PNG nos formatos 16:9, 9:16, 1:1, 4:5, blog ou Pinterest + legendas. |

## Motores de avatar profissionais (opcional)

Se quiser clonar um corpo real ou ter iluminação de estúdio, conecte uma chave em
**Chaves de API** (`/ajustes`):

- **HeyGen** — avatares de estúdio, melhor qualidade.
- **D-ID** — transforma uma foto em apresentador falante.
- **Tavus** — replicas de vídeos longos.

As chaves ficam em `data/studio-config.json` (permissão 600) e nunca são enviadas ao
navegador. O estúdio fala com o provedor pelo servidor local.

## Bancos de imagens grátis

Na aba **Mídia** do editor você encontra a seção **Galerias grátis**, que busca fotos e
vídeos em bancos gratuitos e importa para a biblioteca do projeto, sem marca d'água:

- **Openverse** — funciona **sem chave nenhuma**, já de fábrica. Fotos com licença
  Creative Commons liberadas para uso comercial.
- **Pixabay** — fotos, vídeos e ilustrações, busca em português.
- **Pexels** — fotos e vídeos em alta resolução, ótimos para fundos e B-roll.
- **Unsplash** — fotografia autoral em alta resolução.

As chaves do Pixabay, Pexels e Unsplash são gratuitas (cadastro por e-mail) e ficam só
na sua máquina, em `data/studio-config.json`:

- **Pixabay**: https://pixabay.com/api/docs/
- **Pexels**: https://www.pexels.com/api/
- **Unsplash**: https://unsplash.com/developers → New application → Access Key

A galeria tem filtro de orientação (horizontal, vertical, quadrado), sugestões rápidas e
paginação. Cada clique em uma miniatura baixa o arquivo em alta resolução pelo servidor
local e adiciona à biblioteca. As chaves nunca vão para o navegador.

## Criar vídeo — um clique e pronto

Na página inicial, clique em **Avatar fala o texto** (ou acesse diretamente http://localhost:3000/criar-video). Essa é a tela mais simples do estúdio:

1. Escolha um dos 6 apresentadores da biblioteca.
2. Cole o roteiro que ele vai falar.
3. Escolha a voz neural em português (Francisca, Thalita ou Antônio).
4. Clique em **Gerar vídeo pronto**.

A narração é criada automaticamente e o vídeo é renderizado no seu navegador — sem servidor externo, sem créditos, sem precisar editar nada. Ao terminar, baixe o MP4.

## Postagem pronta a partir do roteiro

Na página inicial, clique em **Colar roteiro e gerar post** (ou acesse
http://localhost:3000/postagem):

1. Cole o texto que você quer publicar.
2. Escolha **Post único**, **Carrossel** ou **Story**.
3. Escolha o formato: Feed 4:5, Quadrado 1:1, Stories 9:16, Pinterest 2:3 ou capa
   de blog.
4. Se quiser, informe um tema para as imagens (ex.: “produtividade”, “estudos”,
   “finanças”).
5. Clique em **Gerar postagem pronta**.

O estúdio monta a capa, os slides, a chamada final, busca fotos gratuitas no
Openverse (e Pexels/Pixabay se você configurou as chaves), gera a legenda e as
hashtags. No fim, você baixa um ZIP com todos os PNGs + `legenda.txt` +
`hashtags.txt` + `textos-alternativos.txt` e pode abrir o projeto no editor para
ajustar o que quiser.

## Estrutura

```
client/                  interface (React + Vite)
  src/engine/            renderização, retrato falante, áudio, legendas, exportação
  src/engine/portrait.ts motor do Retrato Falante (warp com máscara suave)
  src/pages/AvatarStudio.tsx
  src/components/studio/ palco, linha do tempo e painéis
  public/avatars/        biblioteca de apresentadores fotorrealistas
server/                  Express: voz, imagem, avatares e transcrição
  avatarRoutes.ts        HeyGen / D-ID / Tavus + fila de render
  _core/freeImage.ts     geração de imagem gratuita (Pollinations)
data/                    chaves e vídeos renderizados (criado sozinho)
```

## Onde ficam os projetos

Tudo é salvo no IndexedDB do navegador. Use **Exportar projeto** no card do projeto
para baixar um `.nova.zip` com o JSON, todas as mídias e as legendas — esse é o
backup portátil e também serve para abrir o projeto em outro computador pelo botão
**Importar**. Os vídeos gerados pelos motores pagos ficam em `data/avatars/`.

## Testes rápidos

```bash
pnpm check    # tipos
pnpm test     # testes
```
