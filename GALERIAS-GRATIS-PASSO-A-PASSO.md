# Galeria de Fotos e Vídeos Grátis — Passo a Passo

Estúdio: **Studio Nova**  
Aba: **Mídia → Galerias grátis**  
URL local: http://localhost:3000

---

## O que é

Uma seção dentro da aba **Mídia** do estúdio que busca fotos e vídeos em bancos gratuitos e importa direto para a biblioteca do seu projeto. Não tem marca d'água e os arquivos ficam salvos no seu navegador.

Você pode começar a usar **sem cadastrar nada** (Openverse) ou cadastrar chaves gratuitas para acessar mais acervo (Pixabay, Pexels, Unsplash).

---

## Passo 1 — Abra o estúdio

No seu computador, com o Studio Nova rodando:

1. Abra o navegador em **http://localhost:3000**.
2. Se ainda não tiver um projeto, clique em **Novo projeto** e dê um nome (ex.: "Minha aula").
3. O editor abre com a linha do tempo, a cena principal e os painéis laterais.

---

## Passo 2 — Abra a aba Mídia

1. No painel direito do editor, clique na aba **Mídia** (ícone de imagem).
2. Você verá as seções: *Importar mídia*, *Filmar agora*, *Cenários realistas*, *Imagem com IA* e **Galerias grátis**.

A seção **Galerias grátis** fica no topo da aba Mídia.

---

## Passo 3 — Escolha o banco de imagens

No topo da seção **Galerias grátis**, há um menu suspenso com os bancos disponíveis:

| Banco | Precisa de chave? | O que tem |
|-------|-------------------|-----------|
| **Openverse · sem chave** | **Não** — já funciona | Fotos com licença Creative Commons (uso comercial) |
| Pixabay | Sim (grátis) | Fotos, vídeos e ilustrações, busca em português |
| Pexels | Sim (grátis) | Fotos e vídeos em alta resolução |
| Unsplash | Sim (grátis) | Fotografia autoral em alta resolução |

**Recomendação para começar:** deixe em **Openverse · sem chave**. Você busca na hora, sem cadastro.

---

## Passo 4 — Busque o que você quer

1. Digite no campo de busca o que procura (ex.: *natureza*, *escritório*, *cidade*, *praia*, *tecnologia*, *sala de aula*).
2. Clique em **Buscar** (ou aperte Enter).

Aparecem até 20 miniaturas por página, com o nome do autor e o banco de origem.

> Se você escolheu Pixabay, Pexels ou Unsplash e ainda não colocou a chave, aparece um aviso: *"Falta a chave do X"*. Clique em **Abrir Ajustes** e siga o Passo 5.

---

## Passo 5 (opcional) — Configure uma chave gratuita

Só necessário se quiser usar **Pixabay, Pexels ou Unsplash**. O Openverse não precisa.

### No estúdio
1. Clique no botão voltas/seta ou acesse diretamente **http://localhost:3000/ajustes**.
2. Role até a seção de **galerias de fotos e vídeos** (abaixo das chaves de avatar HeyGen/D-ID/Tavus).
3. Você verá campos para:
   - **Pixabay** — cole a chave obtida em https://pixabay.com/api/docs/
   - **Pexels** — cole a chave obtida em https://www.pexels.com/api/
   - **Unsplash** — cole a *Access Key* obtida em https://unsplash.com/developers
4. Cole a chave e clique em **Salvar chaves das galerias**.

As chaves ficam só no seu computador (`data/studio-config.json`, permissão restrita) e nunca são enviadas ao navegador.

> Todas as chaves são gratuitas e pedem apenas cadastro por e-mail. Não é necessário cartão de crédito.

---

## Passo 6 — Filtre os resultados (opcional)

Você pode refinar a busca com:

- **Tipo**: Fotos / Vídeos (vídeos só aparecem no Pixabay e Pexels).
- **Orientação**: Tudo / Horizontal / Vertical / Quadrado.
  - *Horizontal*: fundo de apresentação, YouTube (16:9).
  - *Vertical*: Stories, Reels, TikTok (9:16).
  - *Quadrado*: post do Instagram (1:1).
- **Sugestões rápidas**: clique em um dos botões abaixo da busca (*natureza, escritório, cidade…*) para buscar aquele termo instantaneamente.
- **Carregar mais**: vê os próximos resultados do mesmo termo.

---

## Passo 7 — Importe uma miniatura para a biblioteca

1. Passe o mouse sobre uma miniatura para ver o título e o autor.
2. Clique na miniatura que quiser.
3. Aparece um ícone de **check verde** quando a importação termina.
4. O arquivo entra na lista **Biblioteca · X** abaixo da galeria.

> Cada clique baixa o arquivo em alta resolução pelo servidor local e adiciona ao seu projeto. Pode demorar alguns segundos dependendo do tamanho da imagem/vídeo.

---

## Passo 8 — Use o arquivo na sua cena

1. Na seção **Biblioteca** da aba Mídia, localize o arquivo importado.
2. Clique no botão **Usar** abaixo da miniatura.
   - Se for **imagem**: ela vira uma camada de imagem na cena.
   - Se for **vídeo**: ela vira uma camada de vídeo na linha do tempo.
3. Ajuste posição, tamanho e duração normalmente no editor.

---

## Checklist rápido

- [ ] Abri http://localhost:3000 e criei um projeto
- [ ] Abri a aba **Mídia**
- [ ] Escolhi **Openverse** (sem chave) ou configurei uma chave em **Ajustes**
- [ ] Digitei um termo e cliquei em **Buscar**
- [ ] Cliquei em uma miniatura e vi o check verde
- [ ] O arquivo apareceu na **Biblioteca**
- [ ] Cliquei em **Usar** e o arquivo entrou na cena

---

## Solução de problemas

| Problema | O que fazer |
|----------|-------------|
| "Falta a chave do Pixabay/Pexels/Unsplash" | Vá em **Ajustes**, cole a chave gratuita e salve. Ou troque o banco para **Openverse** (não precisa de chave). |
| Busca não retorna nada | Digite pelo menos 2 letras. Tente outro termo ou outro banco. |
| Miniatura não importa | Pode ser falha momentânea do servidor de imagens. Tente clicar novamente ou escolher outra miniatura. |
| Vídeo não aparece na biblioteca | Vídeos só estão disponíveis no **Pixabay** e **Pexels**. |
| Quer usar no celular (Stories/Reels) | Use o filtro de orientação **Vertical**. |

---

## Onde ficam os arquivos

Tudo é salvo no IndexedDB do seu navegador. Se quiser levar o projeto para outro computador, exporte o vídeo final ou as imagens pelo botão **Exportar**.

O arquivo de configuração com as chaves (se você as adicionou) fica em:

```
data/studio-config.json
```

---

Pronto! Agora você tem um acervo de milhões de fotos e vídeos grátis dentro do seu Studio Nova. Qualquer problema, é só chamar.
