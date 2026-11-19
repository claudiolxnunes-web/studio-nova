# Auditoria e plano de evolução — Studio Nova

**Data:** 19/11/2026  
**Escopo:** código em `client/`, `server/`, `shared/`, configuração, build, testes e documentação.  
**Método:** leitura do código, `tsc --noEmit`, `vitest run`, `vite build`, inspeção de rotas, modelo de dados, renderização e exportação.

---

## 1. Resumo executivo

O Studio Nova é hoje **um protótipo funcional muito acima da média**: entrega sete telas, seis tipos de projeto, oito formatos de publicação, renderização em canvas compartilhada entre prévia e exportação, narração neural em pt-BR, avatares, legendas, galerias gratuitas e geração de imagens por IA.

O problema não é falta de funcionalidade. É **confiabilidade de produção**. A promessa “meu vídeo/aula fica pronto e seguro” ainda não está garantida por quatro motivos principais:

1. **Exportação em tempo real** com `MediaRecorder`: vídeos longos dependem de a aba ficar aberta, podem ser afetados por throttling do navegador e acumulam o arquivo inteiro na memória.
2. **Persistência frágil**: projetos ficam só no IndexedDB, sem backup, sem versionamento, sem arquivo de projeto e sem flush ao fechar a aba.
3. **Ciclo de vida de mídia inseguro**: duplicar projeto compartilha os mesmos blobs; excluir mídia em um pode quebrar o outro; excluir projeto deixa lixo no armazenamento.
4. **Bugs funcionais em recursos centrais**: dividir cena repete a narração, vídeo de fundo não toca, PNG com vídeo pode sair no quadro errado e sombra de imagem não aparece.

### Nota ilustrativa

| Dimensão | Nota | Comentário |
|---|---:|---|
| Produto e proposta | 8,5/10 | Escopo amplo, bem posicionado, pt-BR e local-first. |
| Funcionalidades | 8/10 | Muitas funções reais, mas algumas com bugs de acabamento. |
| Experiência de edição | 7/10 | Boa para cenas; falta timeline profissional, áudio e timing por camada. |
| Confiabilidade | 5/10 | Exportação e persistência ainda não suportam uso sério. |
| Performance | 5/10 | Clonagem total do projeto, MediaPipe em toda imagem e canvas em resolução cheia. |
| Segurança | 4/10 | Servidor em `0.0.0.0`, endpoints sensíveis sem autenticação e chaves copiadas para Docker. |
| Testes e manutenção | 4/10 | 6 testes, todos de template; nenhum teste do editor. Sem Git, lint ou CI. |
| **Visão geral** | **6,5/10** | Excelente base; falta a camada de produto confiável. |

### Validações executadas

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit` | Passou, sem erros. |
| `npx vitest run` | 2 arquivos, 6 testes, todos passando. |
| `npx vite build` | Passou. 1.748 módulos; JS de 838 KB (247 KB gzip); CSS de 150 KB. |
| Tamanho de `client/public` | 33 MB (MediaPipe + modelo facial + avatares). |
| Controle de versão | A pasta **não é um repositório Git**. |

---

## 2. O que já está forte

- **Um único renderizador para prévia e exportação** (`client/src/engine/render.ts`). Isso é a decisão arquitetural mais importante e está correta.
- **Modelo de dados rico** em `shared/editor.ts`: camadas, textos, imagens, vídeos, formas, avatares, filtros, transições, legendas e formatos.
- **Templates e tipos de projeto** que cobrem aula, post, carrossel, blog, live e anúncio.
- **Local-first**: projetos e mídias no navegador; boa promessa de privacidade.
- **Stack gratuita e sem dependência obrigatória de chave**: Edge TTS, Pollinations, Openverse, Pixabay/Pexels/Unsplash.
- **Base visual consistente** com React 19, Tailwind e Radix.
- **Exportação de imagem** por cena ou em lote, o que já atende carrossel, capa e thumbnail.
- **Documentação de uso** acima da média (`COMO-RODAR.md`, `GUIA-STUDIO-NOVA.md`, `Help.tsx`).

---

## 3. Achados prioritários

Legenda de severidade: **P0** quebra a promessa principal; **P1** risco de dados/segurança; **P2** experiência ou qualidade; **P3** arquitetura e manutenção.

### P0 — Bugs que quebram a promessa

| ID | Problema | Onde | Impacto | Correção sugerida |
|---|---|---|---|---|
| B01 | Dividir cena duplica a narração inteira e as palavras nas duas metades. A segunda metade toca o áudio desde o início. | `client/src/store/editor.tsx:519-548`, `client/src/engine/audio.ts:143-161` | Áudio repete e sai fora de sincronia; legendas erradas. | Adicionar `offset`/`trim` na narração e no player; fatiar `words`; ajustar `startAt` dos vídeos. |
| B02 | Narração não é interrompida no fim da cena nem no fim da timeline. | `client/src/engine/audio.ts:143-172` | Voz de uma cena invade a próxima e continua depois do fim. | Agendar `source.stop()` no fim da cena e chamar `stop()` no `onEnded`. |
| B03 | Vídeo de fundo nunca é reproduzido nem sincronizado. `syncVideoLayers` só olha camadas `kind === "video"`. | `client/src/engine/media.ts:191-226`, `client/src/engine/render.ts:323-327` | Fundo de vídeo fica congelado no primeiro quadro. | Sincronizar também `scene.background.mediaId` quando `background.type === "video"`. |
| B04 | Exportar PNG desenha o quadro antes de buscar o tempo do vídeo e não espera o `seeked`. | `client/src/engine/export.ts:243-247` | Carrossel/thumbnail com vídeo pode sair no quadro errado ou preto. | Buscar o tempo, aguardar `seeked`, garantir mídias e só então desenhar. |
| B05 | Exportar PNG não chama `mediaRegistry.ensureAll`. | `client/src/engine/export.ts:226-254` | Imagem recém-importada pode sair vazia. | `await mediaRegistry.ensureAll(project.media)` antes de renderizar. |
| B06 | Duplicar projeto compartilha os mesmos IDs de mídia. Excluir uma mídia em um projeto apaga o blob usado pelo outro. | `client/src/pages/Projects.tsx:62-72`, `client/src/store/editor.tsx:927-949`, `client/src/lib/storage.ts:84-95` | Perda silenciosa de mídia em projeto duplicado. | Referência contada por blob ou cópia dos blobs ao duplicar; nunca apagar blob ainda referenciado. |
| B07 | Excluir projeto não apaga as mídias dele. | `client/src/pages/Projects.tsx:74-77`, `client/src/lib/storage.ts:70-72` | IndexedDB cresce sem limite; cota estoura. | Coleta de lixo de blobs órfãos após excluir/editar. |
| B08 | Autosave com debounce de 550 ms não tem flush em `pagehide`/`visibilitychange`. | `client/src/store/editor.tsx:195-209` | Últimos 0,5 s de edição podem ser perdidos ao fechar a aba. | Flush síncrono/assíncrono ao sair e ao trocar de cena; indicador “salvo às HH:MM”. |
| B09 | `CriarVideo` baixa sempre com extensão `.mp4`, mesmo quando o navegador gravou WebM. | `client/src/pages/CriarVideo.tsx:127-130` | Arquivo baixado pode não abrir em players. | Usar `rendered.extension` retornado por `renderTalkingVideo`. |
| B10 | Sombra de imagem é configurada depois do `ctx.clip()`, então é recortada e não aparece. | `client/src/engine/render.ts:221-229` | O controle “sombra” não tem efeito visível. | Desenhar sombra fora do clip ou desenhar uma silhueta atrás antes de recortar. |
| B11 | Fundo de texto usa `layer.w + paddingX` em vez de `layer.w + paddingX * 2`. | `client/src/engine/render.ts:150-160` | Fundo de texto fica cortado no lado direito. | Corrigir a largura e alinhar o texto ao padding. |
| B12 | Barra colorida da cena na timeline é sempre 100%. | `client/src/components/studio/Timeline.tsx:75-84` | Ilustração sem significado; não comunica duração relativa. | Usar proporção real ou remover a barra. |
| B13 | Exportação longa acumula todos os chunks em memória e depende de `requestAnimationFrame`. | `client/src/engine/export.ts:99-180` | Aula de 30–60 min pode travar, dessincronizar ou estourar memória. | Renderização determinística com WebCodecs/worker; gravar em disco via File System Access; fallback MediaRecorder. |
| B14 | Toda imagem importada dispara análise facial com MediaPipe (33 MB de wasm/modelo). | `client/src/engine/media.ts:122-134` | Importar uma foto de fundo carrega modelo e usa GPU sem necessidade. | Análise facial sob demanda, apenas para avatar com foto. |

### P1 — Dados, segurança e operação

| ID | Problema | Onde | Impacto | Correção sugerida |
|---|---|---|---|---|
| S01 | `navigator.storage.persist()` nunca é chamado. | `client/src/lib/storage.ts` | O navegador pode despejar projetos/mídias sob pressão de cota. | Pedir persistência na primeira criação e mostrar uso/cota. |
| S02 | Não há `schemaVersion` nem migrações no projeto. | `shared/editor.ts:298-310` | Qualquer mudança futura no modelo quebra projetos antigos. | Adicionar versão e migradores por versão. |
| S03 | Não existe arquivo de projeto para backup/transferência. | `client/src/lib/storage.ts` | “Tudo no navegador” sem exportar projeto = risco de perda total. | Exportar/importar `.nova.zip` com `project.json` + mídias. |
| S04 | `Dockerfile` faz `COPY . .` e `.dockerignore` não ignora `data/`. | `Dockerfile:7`, `.dockerignore` | Chaves de API em `data/studio-config.json` podem ser embutidas na imagem. | Ignorar `data/`, `.manus-logs`, `dist`, `coverage`; rodar como usuário não-root. |
| S05 | Servidor escuta em `0.0.0.0` e endpoints de configuração/TTS/IA não têm autenticação. | `server/_core/index.ts:46`; `server/mediaRoutes.ts`, `server/avatarRoutes.ts`, `server/stockRoutes.ts` | Em rede compartilhada, qualquer um usa TTS/IA e altera chaves. | Padrão `127.0.0.1`; token local opcional para LAN; rate limit. |
| S06 | Rota de arquivo de avatar lê o MP4 inteiro na memória e anuncia `Accept-Ranges` sem implementar Range. | `server/avatarRoutes.ts:583-600` | Vídeo grande consome memória e o player não consegue buscar. | `createReadStream` + implementação real de `Range`. |
| S07 | Proxy de galerias segue redirecionamento e aceita host de destino se o token da URL original for válido; não há timeout. | `server/stockRoutes.ts:638-652` | SSRF limitado e requisições penduradas. | Validar host final sempre, limitar redirecionamentos, timeout e limite de bytes em streaming. |
| S08 | Transcrição real depende de `MANUS_API_URL`/`MANUS_API_KEY`; sem isso, `/api/transcribe` falha. A documentação sugere transcrição gratuita. | `server/mediaRoutes.ts:24-37`, `client/src/pages/Help.tsx:100` | Legendas “palavra por palavra” não funcionam em instalação local padrão. | Whisper local (`faster-whisper`/`whisper.cpp`) como padrão e provedor pago como opcional. |
| S09 | TTS usa endpoints não oficiais (Edge/Google), sem cache apesar do TODO prometer cache. | `server/_core/tts.ts` | Risco de indisponibilidade/ToS e custo de latência repetido. | Cache por hash(texto, voz, rate, pitch); interface de provedores; opção Azure/ElevenLabs/Piper. |
| S10 | `express.json({ limit: "50mb" })` global e endpoints sem limite específico/rate limit. | `server/_core/index.ts:16-17` | Consumo de memória e abuso local. | Limites por rota, rate limit, validação de tamanho. |
| S11 | Não é um repositório Git. | raiz do projeto | Sem histórico, sem reversão, sem CI, risco de perda. | `git init`, primeiro commit, `.gitattributes`; nunca versionar `data/`. |
| S12 | `.manus-logs` contém 456 KB de console, rede e session replay no projeto. | `.manus-logs/` | Pode conter dados sensíveis e confundir o pacote. | Remover do repositório/imagem e documentar que é artefato de desenvolvimento. |

### P2 — Experiência e qualidade de edição

| ID | Problema | Onde | Impacto | Correção sugerida |
|---|---|---|---|---|
| U01 | Cada tecla digitada no roteiro cria um passo de undo e clona o projeto inteiro. | `client/src/components/studio/tabs/VoiceTab.tsx:90-95`, `client/src/store/editor.tsx:211-229` | Ctrl+Z desfaz letra por letra; digitação pesada em projetos grandes. | Agrupar histórico por campo/foco ou debounce de 500 ms; patches em vez de clone total. |
| U02 | Histórico não é limpo ao trocar de projeto. | `client/src/store/editor.tsx` (efeito de carga por `projectId`) | Undo pode restaurar conteúdo do projeto anterior em navegação direta. | Resetar `historyRef` no `projectId` e ao abrir. |
| U03 | Excluir mídia não pede confirmação e remove de todas as cenas silenciosamente. | `client/src/components/studio/tabs/MediaTab.tsx:255` | Perda acidental de camadas e narração. | Diálogo com “usada em N cenas” e opção de substituir. |
| U04 | Cards de projeto não têm thumbnail real. | `client/src/pages/Projects.tsx` (capa mostra só cor/gradiente) | Dificuldade de reconhecer projetos. | Gerar thumbnail da primeira cena no save e armazenar em data URL. |
| U05 | Não há editor de legenda por palavra/linha, nem importação/exportação SRT/VTT. | `client/src/engine/captions.ts` | Legendas só globais por projeto; revisão limitada; não publica em plataformas. | Editor de transcrição, SRT/VTT sidecar e burn-in opcional. |
| U06 | Não existe faixa de música, SFX, volume, fade ou ducking. | `shared/editor.ts` (`Narration` é o único áudio de cena) | Vídeos soam amadores; impossível trilha sonora. | Mixer com barramentos de voz/música/SFX, fades, LUFS e ducking. |
| U07 | Camadas não têm tempo de entrada/saída dentro da cena. | `BaseLayer` em `shared/editor.ts` | Tudo aparece a cena inteira; não dá para revelar item por item. | `in`/`out` por camada e trilhas na timeline. |
| U08 | Timeline mostra apenas cenas; não há zoom, scrub por arraste, marcadores ou waveform. | `client/src/components/studio/Timeline.tsx` | Edição de precisão limitada. | Timeline multi-trilha com zoom, ímã, régua, waveforms e marcadores. |
| U09 | Sem multi-seleção, copiar/colar, agrupar, alinhar/distribuir. | `Stage.tsx`, `LayerTab.tsx` | Composições com muitos elementos ficam lentas. | Seleção múltipla, clipboard interno, grupos e distribuição. |
| U10 | Sem gravação de tela, teleprompter ou importação de slides/PDF. | páginas atuais | Principal lacuna para “aulas”. | Gravação de tela com cursor/zoom/PiP; teleprompter; importar PPT/PDF. |
| U11 | Sem exportação em lote por variante (16:9 + 9:16 + 1:1) nem ZIP de carrossel. | `ExportDialog.tsx` | Repetição manual para cada rede. | “Exportar para todas as redes” com fila e ZIP. |
| U12 | Sem publicação direta (YouTube, TikTok, Instagram, Hotmart, Teachable). | — | O fluxo termina no download. | Integrações OAuth e agendamento; ou pelo menos metadados/chapters. |
| U13 | Fonte externa do Google Fonts. | `client/index.html:11-15` | Offline/instalação local pode renderizar com fonte diferente do preview. | Auto-hospedar Inter/Space Grotesk e embutir fallback. |
| U14 | `window.alert` para erro de microfone e atualização vazia de narração no erro. | `client/src/components/studio/tabs/VoiceTab.tsx` | UX ruim e passo de undo inútil. | Toast inline e não alterar o projeto no catch. |
| U15 | Documentação promete “sem limite” de caracteres, mas TTS limita 4.000 e CriarVideo 1.200. | `TODO.md`, `COMO-RODAR.md`, `server/_core/tts.ts:230`, `CriarVideo.tsx` | Expectativa quebrada. | Documentar limites ou dividir automaticamente o texto em partes. |
| U16 | Código morto/template: `Home.tsx`, `ComponentShowcase.tsx`, tRPC/Drizzle/auth não usados pelo produto. | `client/src/pages`, `server/routers.ts`, `server/db.ts` | Bundle, superfície de ataque e confusão. | Remover ou isolar em “modo plataforma”. |

### P3 — Arquitetura, performance e engenharia

| ID | Problema | Onde | Impacto |
|---|---|---|---|
| A01 | Exportação em tempo real, não determinística. | `client/src/engine/export.ts` | Tempo de export = tempo do vídeo; sensível a aba em segundo plano. |
| A02 | `structuredClone` do projeto inteiro a cada edição, com até 40 clones no histórico. | `client/src/store/editor.tsx:211-229` | Travamentos em projetos grandes. |
| A03 | Canvas sempre na resolução final do projeto, mesmo em prévia pequena. | `client/src/components/studio/Stage.tsx:60-95` | GPU/CPU alta em 1080p/4K. |
| A04 | MediaPipe importado estaticamente e analisado em toda imagem. | `client/src/engine/media.ts:11`, `122-134` | Bundle maior e carregamento de 33 MB sem necessidade. |
| A05 | Rotas e páginas sem `React.lazy`/code splitting. | `client/src/App.tsx` | JS inicial grande; editor carrega junto com páginas auxiliares. |
| A06 | Testes só de template; `vitest` inclui apenas `server/**`. | `vitest.config.ts` | Nenhuma proteção para o núcleo do produto. |
| A07 | Sem ESLint, CI, pre-commit ou checagem de formatação. | raiz | Regressões entram sem aviso. |
| A08 | Dependências não usadas (`drizzle`, `mysql2`, `@aws-sdk`, vários componentes UI) e `add` em devDependencies. | `package.json` | Instalação pesada e superfície desnecessária. |
| A09 | Sem observabilidade de erro de exportação/renderização. | `client/src` | Difícil diagnosticar falhas do usuário. |
| A10 | Sem feature flags, telemetria local ou métricas de funil. | — | Não se sabe onde o usuário desiste. |

---

## 4. Diagnóstico por fluxo

### 4.1 Criar uma aula
Funciona bem: modelo inicial, cenas, narração, legendas e exportação. Fragilidades: duração inicial não acompanha a narração até gerar o áudio; dividir cena quebra o áudio; não há slides, gravação de tela ou teleprompter — exatamente o que um professor precisa.

### 4.2 Criar um Reels/TikTok
O formato vertical existe e a área segura aparece. Falta o mais importante: **reenquadramento automático** de um projeto 16:9 para 9:16 com detecção de assunto, legendas virais, música e exportação em lote. Hoje o usuário refaz a composição manualmente.

### 4.3 Criar carrossel/post
A exportação PNG por cena funciona. Faltam ZIP do carrossel, texto alternativo, legendas para a publicação, capa/thumbnail A/B e modelos de marca.

### 4.4 Criar aula longa
É o fluxo mais prejudicado pela exportação em tempo real. Uma aula de 40 minutos exige 40 minutos de gravação, aba visível e memória para o arquivo inteiro. Sem renderização determinística/em segundo plano, o produto não compete com ferramentas de produção.

### 4.5 Publicar
O fluxo termina no download. Para ser “o melhor criador de aulas e publicações”, precisa gerar os artefatos de publicação: SRT, capítulos, título/descrição, thumbnail, cortes verticais e, idealmente, publicar/agendar.

---

## 5. Propostas de evolução

A recomendação estratégica é **não tentar ser um CapCut genérico**. O diferencial defensável é:

> **“Do roteiro à aula publicada, em português, no seu computador, sem mensalidade e sem equipe.”**

Isso justifica priorizar educação, pt-BR, render local confiável e reaproveitamento multi-formato — não efeitos virais infinitos.

### Pilar 1 — Renderização e exportação confiáveis (prioridade máxima)

1. **Novo motor de exportação determinístico**
   - WebCodecs (`VideoEncoder` + `AudioEncoder`) + muxer MP4 (ex.: `mp4-muxer`) em Web Worker com `OffscreenCanvas`.
   - Renderizar quadro a quadro pelo relógio, não em tempo real.
   - Fallback automático para `MediaRecorder` em navegadores sem WebCodecs.
   - Meta: exportar uma aula de 10 min em menos de 3 min, com aba em segundo plano.

2. **Fila de render**
   - Estados: na fila, renderizando, pausado, concluído, erro.
   - Retomar após fechar/reabrir; histórico de exports.
   - Gravação em disco via File System Access API para vídeos longos.

3. **Exportação em lote**
   - Um clique para 16:9, 9:16, 1:1 e 4:5.
   - ZIP de carrossel, PNGs + legendas + metadados.
   - Nomeação automática por projeto, formato e data.

4. **Legendas publicáveis**
   - SRT/VTT ao lado do vídeo.
   - Burn-in opcional com estilos salvos.
   - Capítulos e descrição gerados do roteiro.

5. **Qualidade de áudio**
   - Normalização para −14 LUFS (redes) ou −16/−23 LUFS (aula).
   - Fade in/out, ducking da música sob a voz e limitador.
   - Exportar faixa de áudio separada.

### Pilar 2 — Timeline e edição profissional

1. **Timeline multi-trilha**: cenas, camadas, narração, música, SFX, legendas e marcadores.
2. **Timing por camada**: `in`/`out`, duração, loop, velocidade.
3. **Keyframes** para posição, escala, rotação, opacidade, volume e filtros, com curvas de easing.
4. **Waveform** da narração e da música; scrub por arraste; zoom; ímã; régua.
5. **Operações**: split em todas as trilhas, ripple delete, slip/slide, copiar/colar, multi-seleção, grupo, alinhar/distribuir.
6. **Edição baseada em texto** (diferencial do Descript): apagar uma frase no roteiro remove o trecho correspondente do áudio/vídeo.
7. **Prévia em proxy** (540p) e render final em resolução cheia.

### Pilar 3 — Persistência, biblioteca e recuperação

1. **Arquivo de projeto `.nova.zip`** com JSON + mídias, para backup e transferência.
2. **Persistência real**: `navigator.storage.persist()`, indicador de cota, OPFS para arquivos grandes.
3. **Versionamento**: snapshots automáticos (últimos 20), restaurar versão, “histórico do projeto”.
4. **Mídia profissional**:
   - Hash para deduplicar.
   - Proxy e thumbnail por vídeo.
   - Referência contada por blob.
   - Coleta de lixo de órfãos.
   - Transcodificação de formatos não suportados (ffmpeg.wasm ou servidor).
5. **Schema versionado** e migrações.
6. **Nuvem opcional**: login, workspace, projetos no Postgres, mídia em S3/R2, sync local-first.

### Pilar 4 — IA que economiza tempo de verdade

1. **Legendas locais gratuitas** com Whisper (`faster-whisper` ou `whisper.cpp`), timestamps por palavra, sem chave e sem nuvem.
2. **Timestamps exatos do Edge TTS**: usar `WordBoundary`/`--write-subtitles` em vez de distribuir palavras por estimativa.
3. **Assistente de roteiro**: gancho, estrutura, cortes, sugestões de B-roll, títulos, descrição, hashtags e capítulos.
4. **B-roll automático**: casar frases do roteiro com vídeos do Pexels/Pixabay.
5. **Auto-reframe 16:9 → 9:16** com tracking de rosto/assunto.
6. **Corte automático de silêncios e vícios de linguagem**.
7. **Tradução e dublagem** para EN/ES, com legendas separadas.
8. **Clonagem de voz com consentimento** e avatar realista opcional.
9. **Provider abstraction + cache** para imagem, voz, transcrição e avatar; trocar de provedor sem mudar a UI.

### Pilar 5 — Educação e publicação

1. **Importar slides** (PPTX/PDF/Google Slides) como cenas.
2. **Gravação de tela** com cursor destacado, zoom e webcam PiP.
3. **Teleprompter** integrado à câmera.
4. **Estrutura de aula**: objetivos, capítulos, materiais, quiz, CTA, certificado.
5. **Exportar SCORM/xAPI** para LMS.
6. **Publicação**: YouTube, Vimeo, Hotmart, Teachable, Instagram/TikTok (quando viável), com agendamento.
7. **Kit de marca**: fontes, cores, logo, lower thirds, molduras.
8. **Marketplace de templates** por nicho (educação, saúde, finanças, idiomas).
9. **Blog**: exportar Markdown/HTML com vídeo embutido e imagem Open Graph.
10. **Live**: contagem regressiva, lower third, capa e lembrete.

### Pilar 6 — Colaboração

1. Contas, workspaces e papéis (dono, editor, revisor).
2. Link de revisão com comentários por timestamp.
3. Aprovação com status.
4. Co-edição em tempo real (Yjs) e presença.
5. Biblioteca compartilhada de mídia e marca.
6. Log de auditoria e histórico de versões.

### Pilar 7 — Engenharia e confiança

1. **Git + CI**: `check`, `test`, `build`, lint e Playwright em cada PR.
2. **Testes do núcleo**:
   - `splitScript`, `estimateWordTimings`, `buildCaptionLines`.
   - Store: undo/redo, split de cena, formato, remoção de mídia.
   - Exportação: frames golden com node-canvas.
   - Persistência: cota, migração, GC.
3. **E2E**: criar → editar → narrar → exportar → baixar.
4. **Observabilidade**: logs estruturados, Sentry, diagnóstico de exportação.
5. **Performance**: patches em vez de clone, lazy routes, MediaPipe dinâmico, canvas em proxy.
6. **Segurança**: localhost por padrão, token local opcional, helmet/CSP, rate limit, segredos fora da imagem, dependências mínimas.
7. **Acessibilidade**: ARIA, foco visível, contraste, atalhos documentados, redução de movimento.
8. **i18n**: pt-BR padrão, EN/ES depois.

---

## 6. Roadmap sugerido

### Sprint 0 — Estabilização (1–2 dias)

- Corrigir B01–B12.
- `navigator.storage.persist()` + flush no `pagehide`.
- `.dockerignore` com `data/` e `.manus-logs`.
- Servidor em `127.0.0.1` por padrão.
- `git init` + primeiro commit + CI mínimo.
- Corrigir extensão do vídeo em `CriarVideo`.
- Remover análise facial de imagens que não são avatar.

**Critério de saída:** criar, editar, fechar, reabrir e exportar sem perda; nenhum bug conhecido de mídia.

### Sprint 1 — Exportação v2 e persistência (1–2 semanas)

- WebCodecs + worker + fallback.
- Fila de export e histórico.
- Exportação em lote e ZIP.
- SRT/VTT.
- Arquivo `.nova.zip` import/export.
- GC e referência de mídia.
- Schema version + migração.

**Critério de saída:** aula de 20 min exporta em segundo plano, com áudio, legenda e arquivo recuperável.

### Sprint 2 — Áudio e timeline v2 (2–3 semanas)

- Mixer com música/SFX, fades, ducking, normalização.
- Timeline multi-trilha com zoom, scrub, waveform e marcadores.
- Timing por camada + keyframes.
- Multi-seleção, copiar/colar, grupo, alinhar/distribuir.
- Undo agrupado por campo.

**Critério de saída:** edição de uma aula com trilha, três camadas animadas e legendas sem sair da timeline.

### Sprint 3 — Educação e IA local (3–4 semanas)

- Gravação de tela + teleprompter.
- Importação de slides/PDF.
- Whisper local + timestamps Edge TTS.
- Assistente de roteiro e B-roll.
- Auto-reframe 9:16.
- Kit de marca e templates.

**Critério de saída:** gravar uma aula com slides, tela e apresentador; gerar cortes verticais automaticamente.

### Sprint 4 — Publicação e colaboração (4–8 semanas)

- Publicação/agendamento YouTube e Hotmart/Teachable.
- Metadados, capítulos, thumbnails A/B.
- Link de revisão e comentários.
- Workspace, papéis e biblioteca compartilhada.
- Sync em nuvem opcional.

**Critério de saída:** uma equipe cria, revisa, aprova e publica uma aula sem baixar arquivo.

---

## 7. Backlog priorizado (impacto × esforço)

| Prioridade | Item | Impacto | Esforço |
|---|---|---|---|
| P0 | Corrigir bugs B01–B14 | Muito alto | Baixo |
| P0 | Git + CI + testes do núcleo | Alto | Baixo |
| P0 | Persistência segura e flush | Muito alto | Baixo |
| P1 | Exportação WebCodecs em worker | Muito alto | Alto |
| P1 | Referência de mídia + GC + arquivo de projeto | Alto | Médio |
| P1 | SRT/VTT + legendas publicáveis | Alto | Baixo |
| P1 | Mixer de áudio (música, fade, ducking) | Muito alto | Médio |
| P1 | Timeline multi-trilha + timing por camada | Muito alto | Alto |
| P2 | Keyframes e curvas | Alto | Alto |
| P2 | Gravação de tela + teleprompter | Muito alto (educação) | Médio |
| P2 | Importação de slides/PDF | Alto | Médio |
| P2 | Whisper local + timestamps Edge | Alto | Médio |
| P2 | Auto-reframe 16:9 → 9:16 | Muito alto (social) | Alto |
| P2 | Exportação em lote + ZIP | Alto | Baixo |
| P2 | Thumbnails reais nos projetos | Médio | Baixo |
| P3 | Publicação YouTube/Hotmart | Muito alto | Alto |
| P3 | Colaboração e revisão | Alto | Muito alto |
| P3 | Cloud sync/workspace | Alto | Muito alto |
| P3 | Marketplace de templates | Médio | Alto |

---

## 8. Métricas de sucesso

| Métrica | Meta inicial |
|---|---|
| Taxa de exportação bem-sucedida | > 99% |
| Tempo de exportação / duração do vídeo | < 0,5× |
| Sessões sem crash | > 99,5% |
| Projetos recuperados após fechar a aba | 100% |
| Abertura de projeto (p95) | < 2 s |
| Primeiro vídeo publicado | < 10 min desde o cadastro |
| Projetos com legendas geradas | > 60% |
| Projetos exportados / criados | > 40% |
| Retenção semanal de criadores ativos | > 35% |

---

## 9. Checklist de quick wins (baixo esforço, alto retorno)

- [ ] Corrigir split de cena com offset de áudio e palavras.
- [ ] Sincronizar vídeo de fundo.
- [ ] Garantir mídia e `seeked` antes do PNG.
- [ ] Referência de mídia + GC ao excluir projeto.
- [ ] Flush de autosave em `pagehide`.
- [ ] Corrigir extensão do vídeo em `CriarVideo`.
- [ ] `navigator.storage.persist()` + indicador de cota.
- [ ] `.dockerignore` com `data/` e `.manus-logs`.
- [ ] Servidor em `127.0.0.1` por padrão.
- [ ] Lazy MediaPipe e análise facial só para avatar.
- [ ] Thumbnail real nos cards de projeto.
- [ ] Exportar SRT/VTT.
- [ ] Agrupar undo de digitação.
- [ ] Auto-hospedar fontes.
- [ ] `git init` + CI com `check`, `test` e `build`.

---

## 10. Conclusão

O Studio Nova já tem o mais difícil: **uma visão de produto clara, um modelo de edição rico e um renderizador único**. O que separa o projeto de ser “o melhor editor e criador de aulas, vídeos e publicações” não é adicionar mais botões; é transformar a base em uma ferramenta **confiável, rápida e recuperável**, e depois aprofundar os fluxos que só um estúdio de educação em pt-BR faz bem:

1. exportar vídeos longos sem sofrimento;
2. editar áudio e timeline com precisão;
3. nunca perder um projeto;
4. transformar uma aula em cortes, posts, carrosséis e capítulos;
5. publicar com metadados e revisão.

Se a ordem acima for respeitada, o produto deixa de ser um protótipo promissor e passa a ser um estúdio que um criador profissional usa todos os dias.

---

## 11. Sprint 0 executado

**Data da execução:** 19/11/2026

### O que foi corrigido no código

- **Split de cena:** a segunda metade agora guarda `narration.offset` e as palavras são fatiadas; camadas de vídeo e vídeo de fundo também recebem o deslocamento.
- **Áudio:** a narração é limitada à duração da cena e o player para as fontes no fim da timeline.
- **Vídeo de fundo:** `syncVideoLayers` passou a sincronizar `scene.background` do tipo vídeo, com loop e pausa quando inativo.
- **PNG com vídeo:** a exportação garante as mídias e aguarda o `seeked` antes de desenhar o quadro.
- **Mídia:** excluir um projeto agora coleta blobs órfãos; remover uma mídia não apaga mais o blob (preserva undo e projetos duplicados).
- **Autosave:** flush em `pagehide`/`visibilitychange`; histórico limpo ao trocar de projeto; `navigator.storage.persist()` solicitado.
- **Undo:** digitação em roteiro, texto de camada e nome do projeto é agrupada em um único passo.
- **Criar vídeo:** extensão do download agora segue o container real (`.mp4` ou `.webm`).
- **Sombra de imagem:** passou a ser desenhada fora do clip, com cache de silhueta.
- **Fundo de texto:** largura corrigida para incluir os dois lados do padding.
- **Timeline:** a barra agora representa a cobertura da narração, não 100% fixo.
- **MediaPipe:** importação dinâmica e análise facial apenas para avatar com foto. Bundle inicial caiu de ~838 KB para ~699 KB e o chunk do MediaPipe (~144 KB) só carrega quando necessário.
- **Segurança/operação:** servidor escuta em `127.0.0.1` por padrão; Docker usa `HOST=0.0.0.0` explicitamente, roda como `node`, tem healthcheck e ignora `data/`/`.manus-logs`.
- **Arquivos de avatar:** rota usa `createReadStream` e implementa `Range`.
- **Galeria:** download externo ganhou timeout.
- **Confirmações:** exclusão de projeto e remoção de mídia pedem confirmação.
- **Git + CI:** repositório inicializado e workflow em `.github/workflows/ci.yml` rodando typecheck, testes e build.

### Novos testes

- `client/src/lib/timing.test.ts` — distribuição de palavras.
- `client/src/engine/captions.test.ts` — agrupamento, pontuação e fallback.
- `client/src/lib/scriptVideo.test.ts` — divisão de roteiro.
- `shared/editor.test.ts` — presets e formatos.
- `vitest.config.ts` agora inclui testes de `client/` e `shared/`.

### Validação final

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit` | Passou. |
| `npx vitest run` | 6 arquivos, **17 testes**, todos passando. |
| `pnpm build` | Passou (client + server). |
| Servidor de produção | `/api/health` e `/` respondem 200 em `127.0.0.1`. |
| Git | Primeiro commit criado; árvore limpa após o Sprint 0. |

### O que ficou para o Sprint 1

Exportação WebCodecs em worker, fila de render, arquivo `.nova.zip`, SRT/VTT, referência de mídia mais sofisticada, schema versionado e exportação em lote.
