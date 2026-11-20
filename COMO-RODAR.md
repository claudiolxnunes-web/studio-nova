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

## ComfyUI — geração de imagens local (opcional)

Se você tem uma máquina com **GPU NVIDIA**, pode usar o seu próprio ComfyUI para
gerar capas, cenários, retratos e imagens do editor, sem fila e sem custo por
imagem.

1. Na máquina com GPU, inicie o ComfyUI aceitando conexões:

```bash
python main.py --listen 0.0.0.0 --port 8188
```

2. Abra **Ajustes** no Studio Nova e preencha:
   - **URL do ComfyUI**: `http://IP-DA-MAQUINA:8188` (ou `http://127.0.0.1:8188`
     se for a mesma máquina);
   - **Token do proxy**: só se você colocou o ComfyUI atrás de um proxy com
     autenticação;
   - **Checkpoint**: use **Listar modelos** para escolher um checkpoint instalado.

3. Clique em **Testar conexão** e depois em **Salvar ComfyUI**.

O Studio Nova usa um grafo SDXL padrão. Se você precisa de Flux, vídeo, img2img
ou outro fluxo, exporte o workflow em **Save (API Format)** e cole em
**Workflow API**, usando os placeholders:

```text
{{PROMPT}} {{NEGATIVE}} {{SEED}} {{WIDTH}} {{HEIGHT}} {{STEPS}} {{CFG}} {{CHECKPOINT}}
```

O navegador nunca acessa a porta 8188 diretamente: o servidor local do Studio Nova
faz a ponte. O ComfyUI não tem login nativo — proteja a porta com firewall, VPN ou
proxy autenticado. Sem GPU, o ComfyUI funciona, mas a geração fica lenta demais
para uso profissional.

## Nano Banana (Google) — imagens com IA

O Nano Banana é o gerador de imagens do Gemini. A integração usa uma chave do
**Google AI Studio**, que fica só no servidor local.

1. Crie a chave em https://aistudio.google.com/apikey.
2. Abra **Ajustes → Nano Banana**.
3. Cole a chave, escolha o modelo e a resolução e clique em **Salvar Nano Banana**.

Modelos disponíveis:

- **Nano Banana 2.1** — melhor qualidade;
- **Nano Banana 2 Lite** — mais barato/rápido, boa opção para esticar a cota;
- **Nano Banana 2**, **Pro** e o **legado 2.5**.

A geração consome a cota da sua conta Google. Se a cota gratuita não cobrir o
modelo escolhido, o Studio Nova avisa e cai automaticamente no ComfyUI ou no
gerador gratuito de reserva. Para consultar os nomes e o status de todas as
ferramentas, abra **Ferramentas** na home.

## Tripo 3D — objetos 3D

O Tripo gera modelos 3D a partir de texto e entrega **GLB** com preview.

1. Crie a chave em https://developers.tripo3d.ai/en/keys.
2. Abra **Ajustes → Tripo 3D** e cole a chave.
3. Abra **Tripo 3D** na home (ou `/tripo`), descreva o objeto e clique em
   **Gerar modelo 3D**.

O laboratório mostra o progresso, o preview interativo e o botão de download do
GLB. Cada modelo consome créditos da Tripo (1 crédito = US$ 0,01; text-to-3D
custa de 10 a 20 créditos). É ideal para válvulas, bombas, EPI, esteiras,
equipamentos e diagramas técnicos — não para o apresentador falando.

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

### Importar uma foto específica do Unsplash

Na aba **Mídia**, cole um link ou ID do Unsplash no campo
**“Colar link ou ID do Unsplash”** e clique em **Importar**. O Studio Nova consulta
`/photos/{id}` com a sua chave, mostra a foto e permite adicioná-la à biblioteca.
O nome do arquivo importado inclui o crédito do fotógrafo; o link de download
aciona o endpoint de download exigido pelo Unsplash. Exemplo de ID:
`pFqrYbhIAXs`.

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

## Atalho na área de trabalho

O arquivo `abrir-studio-nova.sh` inicia o servidor se ele ainda não estiver
rodando e abre o Studio Nova no navegador. O atalho **Studio Nova** na Área de
Trabalho usa esse script. Se o atalho não abrir no GNOME, clique com o botão
direito → **Permitir execução**.

## Instalar como aplicativo (PWA)

O Studio Nova já tem manifest, ícones e service worker. Para instalar:

1. Gere a versão de produção:

```bash
pnpm build
pnpm start
```

2. Abra:

```text
http://localhost:3000
```

3. Clique em **Instalar app** no topo da home ou use o ícone de instalação do
   Chrome/Edge na barra de endereço.

4. Escolha **Instalar Studio Nova**.

O app abre em uma janela própria e fica no menu de aplicativos do sistema.
No Android use **Adicionar à tela inicial**; no iPhone, **Compartilhar →
Adicionar à Tela de Início**.

> A instalação exige `localhost` ou HTTPS. Para instalar no celular, publique o
> Studio Nova em um endereço HTTPS (por exemplo, com um túnel seguro) ou use um
> servidor com domínio próprio. O service worker guarda a interface, mas voz,
> IA e exportação continuam precisando do servidor rodando.

## Login com Gmail

O login com Gmail não é necessário para instalar o app. Ele será usado para
sincronizar projetos e mídias na nuvem via **Supabase Auth + Google OAuth**.
Para ativar, será preciso criar um projeto no Supabase, habilitar o provedor
Google e informar o Client ID/Secret do Google Cloud. O Studio Nova continua
funcionando localmente sem login.

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
