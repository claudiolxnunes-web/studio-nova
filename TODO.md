# TODO — Studio Nova

## 1. Projetos de aula (criar, salvar, abrir, duplicar, excluir)
- [x] Tela inicial lista as aulas com nome, formato, duração total e data de edição.
- [x] Criar aula nova a partir de modelo inicial de 3 cenas (abertura, conteúdo, encerramento).
- [x] Abrir, renomear, duplicar e excluir aulas; conteúdo salvo automaticamente no navegador e recuperado ao reabrir.

## 2. Biblioteca de mídia (imagens, vídeos, áudios)
- [x] Importar imagens, vídeos e áudios por seleção de arquivo ou arrastar e soltar, com nome, tipo, dimensões e duração.
- [x] Mídia permanece disponível após recarregar a página.
- [x] Remover item da biblioteca e reutilizar o mesmo arquivo em várias cenas.
- [x] Gerar imagem por IA a partir de descrição e usar direto na cena.

## 3. Edição por cenas com linha do tempo
- [x] Adicionar, duplicar, dividir, excluir e reordenar cenas; cada cena tem duração própria.
- [x] Linha do tempo mostra as cenas em sequência proporcional à duração, com seleção e arraste para reordenar.
- [x] Transições entre cenas: nenhuma, fade, deslizar e zoom, com duração ajustável.
- [x] Camadas por cena: texto, imagem, vídeo, forma e avatar, com seleção, arraste, redimensionamento, rotação, opacidade, ordem, duplicação e exclusão.
- [x] Encaixe automático no centro e nas bordas ao arrastar, atalhos de teclado (espaço, setas, Del, Esc, Ctrl+Z/Ctrl+Shift+Z, Ctrl+D), zoom da prévia e grade de terços.
- [x] Modelos de cena prontos (Capa, Tópico, 3 pontos, Checklist, Citação, Chamada final) que se adaptam ao formato do projeto.

## 4. Imagens e vídeos ajustáveis
- [x] Enquadramento cover/contain, cantos arredondados, sombra e movimento Ken Burns nas imagens.
- [x] Vídeos de apoio tocam dentro da cena, com ponto de início, enquadramento e recorte.
- [x] Fundo da cena em cor sólida, gradiente, imagem ou vídeo, com desfoque e escurecimento.
- [x] Textos com família, tamanho, peso, cor, alinhamento, entrelinha, espaçamento entre letras, caixa alta, fundo, sombra, contorno e palavra em destaque com cor própria.

## 5. Narração por voz neural em português brasileiro
- [x] Escrever/colar o roteiro de cada cena e gerar áudio narrado em pt-BR.
- [x] Escolher voz (Francisca, Thalita, Antônio), velocidade e tom.
- [x] Áudio gerado fica salvo na cena, pode ser ouvido, regerado, substituído por gravação do microfone ou por arquivo enviado.
- [x] Duração da cena pode ser ajustada automaticamente ao tamanho da narração.
- [x] Uso sem limite de caracteres e sem cota de terceiros: a rota do servidor usa voz neural com cache e fallback, sem chave paga por uso.

## 6. Avatares animados sincronizados
- [x] Escolher avatar de apresentador (presets) ou usar foto própria.
- [x] Avatar anima boca, olhos e balanço de cabeça acompanhando a narração da cena, com anel de destaque opcional.
- [x] Avatar pode ser posicionado, redimensionado, espelhado e reutilizado nas cenas.
- [x] Avatar a partir de foto: detecção de rosto, enquadramento automático, respiração e movimento de mandíbula sincronizado com a voz (sem depender do HeyGen).

## 7. Legendas automáticas em português
- [x] Transcrever a narração da cena e gerar legendas com tempo por palavra.
- [x] Escolher posição, tamanho, cor, destaque da palavra falada, fundo com opacidade, palavras por linha e margem.
- [x] Legendas aparecem na prévia e no vídeo exportado, com destaque karaokê da palavra atual.

## 8. Prévia e exportação
- [x] Player de prévia reproduz a aula inteira com áudio, transições, animações, avatares e legendas.
- [x] Exportar vídeo com escolha de resolução (1080p/720p/540p), qualidade e 30/24 fps, com barra de progresso, prévia e download do arquivo.
- [x] Presets de publicação: Hotmart/YouTube (16:9), Reels/TikTok/Shorts (9:16), Stories (9:16), Feed (4:5) e Quadrado (1:1), com guia de área segura para redes sociais.
- [x] Arquivo exportado inclui a faixa de áudio da narração e tem a extensão corrigida conforme o container real (MP4 ou WebM).

## 9. Painel de edição completo
- [x] Aba Cena: modelos, nome, duração, transição, fundo e resumo da cena.
- [x] Aba Camadas: empilhamento, seleção, subir/descer, ocultar, travar, duplicar e excluir.
- [x] Aba Elemento: alinhamento rápido, espelhar/inverter, posição, tamanho, rotação, opacidade, modo de mistura, filtros (brilho, contraste, saturação, desfoque, preto e branco), borda, sombra projetada e animação de entrada.
- [x] Aba Voz, aba Legenda, aba Mídia e aba Ajustes do projeto (nome, formato, cor da marca, resumo e exclusão com confirmação).

## 10. Lives, blogs e redes sociais (mesmo editor)
- [x] Seis tipos de projeto na tela inicial: aula em vídeo, post de feed, carrossel, capa de blog, chamada de live e anúncio/stories.
- [x] Cada tipo abre com formato e cenas prontas: carrossel com 4 slides, capa de blog 1200×630, live 16:9 com selo AO VIVO, anúncio vertical com botão.
- [x] Novos modelos de cena: Post de feed, Capa de blog, Chamada de live e Oferta/anúncio.
- [x] Formatos adicionais: Capa de blog (1.91:1, 1200×630) e Pinterest (2:3, 1000×1500).
- [x] Exportação em imagem PNG (2× de resolução) da cena atual ou de todas as cenas de uma vez, para post, carrossel, capa e thumbnail.
- [x] O diálogo de exportação oferece Vídeo (com áudio) ou Imagem PNG, mantendo a exportação de vídeo já existente.

## 11. Roteiro, câmera e cenários reais
- [x] Página /roteiro: colar o texto e gerar o vídeo inteiro (cenas, narração, duração e legendas) sem limite de 10s e sem juntar partes em outro editor.
- [x] Gravação pela câmera (aba Mídia → Filmar agora), como camada ou fundo da cena, com áudio do microfone.
- [x] Sete cenários fotorrealistas por IA (cidade, campo, floresta, praia, montanha, interior, estúdio) com movimento de câmera.
- [x] Movimento de câmera (parado/aproximar/afastar) para fundos de imagem e vídeo.
- [x] Avatar realista: retrato por IA a partir de descrição, foto própria e ilustração redesenhada (olhos, mandíbula e pescoço mais adultos).
- [x] Guia e ajuda atualizados com as novas seções; PDF regerado.
