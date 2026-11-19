# O que mudou no Studio Nova

## 1. Avatar Studio (novo)

Página `/avatar` — apresentadores que falam o seu roteiro:

- **6 apresentadores fotorrealistas** prontos (Ana, Bruno, Carla, Diego, Elisa, Fábio),
  gerados por IA e livres de direitos, com rostos enquadrados automaticamente.
- **Use uma foto sua**: o rosto é detectado e o enquadramento se ajusta sozinho.
- **Retrato Falante**, o motor próprio e gratuito: roda no navegador, pisca, respira,
  mexe a boca junto com o áudio e grava o vídeo (MP4/WebM) sem enviar nada para a nuvem.
- **Voz neural em português** (Francisca, Thalita, Antônio) com velocidade e tom.
- **Vídeo pronto** para baixar em 1:1, 9:16 ou 16:9.

## 2. Motores profissionais (opcional)

Em `/ajustes` você cola a chave de um provedor e o estúdio passa a usá-lo pelo servidor
local — a chave nunca vai para o navegador:

| Motor | Para quê |
| --- | --- |
| HeyGen | avatares de estúdio com corpo e gestos (melhor qualidade) |
| D-ID | transforma uma foto em apresentador falante |
| Tavus | replicas de vídeos longos |

A fila de render, o status e o download são tratados pelo próprio estúdio
(`data/avatars/`).

## 3. Avatares do editor deixaram de ser "primários"

- A aba **Avatar** do editor agora tem uma faixa de **apresentadores prontos**: um
  clique e o avatar vira uma pessoa de verdade, já enquadrada.
- O renderizador de retrato foi reescrito (`client/src/engine/portrait.ts`):
  - pontos faciais reais com MediaPipe (olhos, boca) — nada de adivinhar a posição;
  - movimento por linhas em vez de recorte com máscara: **sem o "disco" fantasma**;
  - piscada, respiração, balanço de cabeça, vinheta e fundo desfocado;
  - o mesmo código desenha a prévia e o vídeo exportado.

## 4. Inteligência artificial gratuita

- **Imagem por IA** agora usa um gerador aberto (Flux, sem cadastro) com fila e espera
  automática quando o plano gratuito pede. O serviço pago anterior virou opcional.
- **Narração neural gratuita** via `edge-tts` (veja o passo do Python no `COMO-RODAR.md`).

## 6. Galerias grátis de fotos e vídeos (novo)

Na aba **Mídia** do editor, a seção **Galerias grátis** traz um buscador integrado a
quatro bancos gratuitos:

- **Openverse** — sem chave, funciona de fábrica; fotos Creative Commons para uso comercial.
- **Pixabay** — fotos e vídeos, busca em português.
- **Pexels** — fotos e vídeos em alta resolução.
- **Unsplash** — fotografia autoral em alta resolução.

Recursos:

- Alterna entre provedor e tipo (Fotos / Vídeos; vídeos só no Pixabay e Pexels).
- Filtro de orientação: tudo, horizontal, vertical ou quadrado.
- Sugestões rápidas (natureza, escritório, cidade, praia, tecnologia, sala de aula).
- Grade de miniaturas; clique para baixar em alta resolução e importar para a biblioteca.
- Paginação ("Carregar mais") e contagem de resultados.
- Se faltar uma chave, um aviso aponta para `/ajustes` com o link de cadastro.

As chaves ficam em `data/studio-config.json` (permissão 600) e nunca vão para o navegador.
O servidor faz a busca e o download. Cada arquivo devolvido pela busca carrega uma
assinatura HMAC, então o proxy só baixa URLs que o próprio estúdio emitiu (proteção
contra SSRF) — necessário porque o Openverse espalha as fotos por vários CDNs.

## 7. Criar vídeo — um clique e pronto (novo)

Nova página `/criar-video` com o fluxo mais simples possível: escolha o apresentador, cole o roteiro, clique em gerar e baixe o MP4. A narração em português é criada automaticamente (voz neural, grátis) e o retrato fala sozinho no navegador — nada é enviado para a nuvem.

## 8. Arquivos novos

```
client/src/lib/stockApi.ts           cliente das galerias (busca + download de arquivo)
client/src/components/studio/StockGallery.tsx  UI da seção Galerias grátis
server/stockRoutes.ts                Pixabay/Pexels/Unsplash/Openverse + proxy assinado
server/studioConfig.ts               chaves pexelsKey / pixabayKey / unsplashKey
                                     (+ env PEXELS_API_KEY / PIXABAY_API_KEY / UNSPLASH_ACCESS_KEY)
client/src/pages/CriarVideo.tsx       página "um clique e pronto" (avatar fala o texto)
client/src/pages/Settings.tsx        campos de chave dos bancos + aviso do Openverse
client/src/components/studio/tabs/MediaTab.tsx  integra a seção Galerias grátis
```

Arquivos anteriores desta lista (portrait, talkingVideo, faceAnchors, AvatarStudio,
Settings, avatarRoutes, studioConfig, freeImage, avatars, mediapipe, models) continuam
validos e inalterados.

## Como rodar

```bash
cd ~/studio-nova
pnpm dev
```

Abra http://localhost:3000 → **Avatar Studio** no topo da página inicial.
