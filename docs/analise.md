# Análise do driver web oficial — AULA HERO 68 HE

Fonte analisada: https://hero.aulastar.com (link oficial do HERO 68 HE em aulastar.com/web-drive; build Vite publicado em 09/02/2026).
Análise estática do código JavaScript baixado. Nada foi enviado ao teclado nem a servidores.
Os números de linha (`app:NNN`) referem-se à versão formatada do bundle `app-CPb3bToC.js`.

---

## 1. Identificação do teclado

| Campo | Valor |
|---|---|
| Vendor ID | `0x372E` |
| Product ID | `0x103E` (uma versão wireless usa `0x10B0`) |
| Layout interno | `ARM32_HID_68` (JIS: `ARM32_HID_68_JP`) |
| Protocolo | `kb_by_v3_wired` |
| Report ID | 9 (output e input reports; feature reports não são usados) |
| Tamanho do pacote | 63 bytes |
| UUID do HERO 68 HE | `0x110000000003` |

Vários modelos usam o mesmo VID/PID: HERO 68 AIR, MINI, NEO, WIN68HE Ultra, JIS e HERO 84/87/99/100. O driver pergunta o UUID ao teclado (comando `0x82/0x01`) e escolhe o modelo por ele.

| Modelo | UUID |
|---|---|
| HERO 68 HE | `0x110000000003` |
| HERO 68 HE NEO | `0x11000000001A` |
| HERO 68 HE JIS | `0x110000000028` |
| HERO 68 AIR | `0x110000000014` |
| HERO 68 MINI | `0x11000000000F` |
| WIN68HE Ultra | `0x110000000015` |
| HERO 68 HE wireless | `0x120000000001` / `0x140000000003` |

---

## 2. Protocolo HID

### 2.1 Formato do pacote (63 bytes, sem contar o report ID)

| Byte | Significado |
|---|---|
| 0 | comando |
| 1 | subcomando, perfil/camada ou ID da configuração |
| 2 | subtipo (por exemplo, o tipo de tecla avançada) |
| 3 | total de pacotes da transferência |
| 4 | índice deste pacote |
| 5 | tamanho dos dados |
| 6–61 | dados (até 56 bytes) |
| 62 | checksum = `255 − ((9 + soma dos bytes 0..61) mod 256)`. O report ID entra na soma (`crc_sum`, app:112128) |

- A resposta chega como input report 9, no mesmo formato. O byte 0 repete o comando e os dados começam no byte 6.
- Valores de vários bytes são big-endian. Exceções: a versão do firmware e a tabela de offsets das macros são little-endian.
- O driver casa cada resposta com o pedido por `[0]=comando`, `[3]=total` e `[4]=índice`. Usa timeout de 200–1000 ms e reenvia de 2 a 5 vezes.
- Leituras usam comandos `0x8x`/`0x9x`. Escritas usam `0x0x`/`0x1x`.

### 2.2 Unidades

- O teclado informa a precisão com o comando `0x82/0x06` (padrão 10).
- O driver guarda distâncias em µm e envia `round(µm / precisão)`. Com precisão 10, cada unidade vale 0,01 mm.
- O curso dos switches vem da tabela `tl` (app:17426): a maioria tem 3400 µm, o branco tem 4000 µm e os Mini de 2800 a 3000 µm.

### 2.3 Comandos de escrita

| Cmd | Sub | Função | Dados |
|---|---|---|---|
| `0x03` | perfil | mapear teclas | por tecla: `pos u16` + `keycode u32` (até 9 teclas por pacote). Macro: `pos u16, 0x03, modo, repetições, índice` |
| `0x04` | `0x01` | iluminação principal | `modo, mix (7 = arco-íris, 0 = cor fixa), r, g, b, brilho, velocidade` |
| `0x04` | `0x06` | luz lateral | mesmo formato |
| `0x04` | `0x11` | modo Mac | `0/1` |
| `0x04` | `0x13` | tempo de suspensão | nível |
| `0x04` | `0x15` | trava da tecla Win | `0/1` |
| `0x04` | `0x17` | polling rate | nível 0–6 |
| `0x04` | `0x18` | "debounce" (`key_combo_enable`) | `0/1` |
| `0x04` | `0x19` | calibração adaptativa | `0/1` |
| `0x04` | `0x1D` / `0x1E` | debounce de switch mecânico (modo / µs) | não se aplica ao HE |
| `0x05` | – | tabela de macros | blocos de 56 bytes; ver 2.6 |
| `0x06` | – | RGB por tecla | `pos u16, r, g, b` (até 11 teclas por pacote) |
| `0x10` | – | trocar perfil ativo | `perfil` |
| `0x11` | perfil | resetar camada / restaurar fábrica | – |
| `0x12` | perfil | teclas avançadas; o byte 2 é o tipo | ver 2.5 |
| `0x13` | perfil | ponto de atuação | `pos u16, distância u16, global u8` |
| `0x15` | – | tipo de switch por tecla | `pos u16, tipo u8` |
| `0x16` | perfil | zonas mortas | `pos u16, topo u16, fundo u16, global u8, ativo u8` |
| `0x19` | perfil | Rapid Trigger | `pos u16, ativo u8, pressionar u16, soltar u16, global u8` |
| `0x1A` | perfil | nome do perfil | `tamanho, utf8…` |
| `0x94` | `0x00`/`0x04` | iniciar/parar calibração | o início é reenviado a cada 1 s |
| `0x98` | `0x00`/`0x01`/`0x02` | curso ao vivo: iniciar / lista de teclas / sair | – |

### 2.4 Comandos de leitura

| Cmd | Sub | Retorna |
|---|---|---|
| `0x82` | `0x01` | UUID (6 bytes) |
| `0x82` | `0x02` | versão do firmware (u16 LE) |
| `0x82` | `0x03` | bitfield dos tipos de switch suportados |
| `0x82` | `0x04` | bitfield das teclas avançadas suportadas (bits 0–5 = TGL, MT, DKS, SOCD, MPT, END) |
| `0x82` | `0x06` | precisão (com `[1]=8`: precisão da atuação) |
| `0x82` | `0x09` | suporte a ritmo musical (byte 17) |
| `0x83` | perfil | keymap: `pos u16, keycode u32` (até 9 por pedido) |
| `0x84` | mesmos subcomandos de `0x04` | valor da configuração |
| `0x86` | – | RGB por tecla |
| `0x87` | – | bateria |
| `0x90` | – | perfil ativo |
| `0x92` | perfil | teclas avançadas: lista de posições (sem dados) ou uma tecla (`pos`) |
| `0x93` | – | atuação |
| `0x94` | `0x05` | faixa de calibração: `pos u16, máx u16, mín u16` |
| `0x95` | – | tipo de switch por tecla |
| `0x96` | – | zonas mortas |
| `0x99` | – | Rapid Trigger |
| `0x9A` | perfil | nome do perfil (`0xFF` = sem nome); são 3 perfis |

Quirk: o `fetch_sleep_level` oficial envia uma escrita (`0x04/0x13`) com o valor atual e lê a resposta como `0x84`.

**Mensagens que o teclado envia sozinho (input report 9):**
- `[0]=0x94, [1]=0x02`: progresso da calibração. São 6 bytes por tecla: `pos, atual (bit 15 = pressionada), mínimo`.
- `[0]=0x98, [1]=0x01`: curso ao vivo. São 6 bytes por tecla: `pos, distância, AD (bit 15 = pressionada)`. Serve para um visualizador de curso em tempo real.
- `[0]=0xFE, [1]=0x05`: bateria (só wireless).
- Pacote de 19 bytes com `[4]=2`: teclado conectou ou desconectou.

### 2.5 Teclas avançadas (`0x12` escreve, `0x92` lê; o byte 2 é o tipo)

| Tipo | Nome | Dados |
|---|---|---|
| 0 | apagar | `pos u16, 0` |
| 1 | TGL (toggle) | `pos, keycode u32, tempo u16` |
| 2 | MT (toque/segurar) | `pos, keycode ao segurar u32, keycode ao tocar u32, tempo u16` |
| 3 | DKS (dynamic keystroke) | `pos, 4 distâncias u16`, depois 4 blocos `{keycode u32, 4 bytes de ação}` |
| 4 | SOCD (snap tap) | `n, n × pos u16, modo` |
| 5 | MPT (multi-point) | `pos, n, n × {keycode u32, distância u16}` |
| 6 | END | `pos, keycode u32` (dispara ao soltar) |

Modos de SOCD: 1 = última tecla vence (padrão), 3 = tecla 1 sempre vence, 4 = tecla 2 sempre vence, 0 = as duas se anulam.

### 2.6 Macros (`0x05`)

- **Estrutura do blob:**
  - Primeiro, uma tabela com 4 bytes por macro (`offset u16 LE, tamanho u16 LE`).
  - Depois, para cada macro: `[tamanho do nome, nome utf8, eventos…]`.
- **Cada evento tem 4 bytes:** `[(ação & 0xF0) | (atraso >> 16 & 0x0F), atraso >> 8, atraso & 0xFF, código]`.
  - O atraso tem 20 bits, ou seja, no máximo 1.048.575 ms.
  - Ações: tecla 0/128, modificador 16/144, mouse 32/160 (tabela `l4`, app:16836).
- **Ligação a uma tecla:** a tecla aponta para a macro pelo índice, com o modo 1 = loop N vezes, 2 = até apertar outra tecla, 4 = enquanto segurar.
- **Limites:** até 150 eventos por macro.
- **Não há comando para ler as macros do teclado.** O driver oficial guarda as macros só no navegador.

### 2.7 Keycodes (32 bits, `0xTTMMKKKK`)

| TT | Tipo |
|---|---|
| `0x00` | teclado: MM = máscara de modificadores, KK = uso HID |
| `0x01` | botão do mouse |
| `0x02` | consumer/multimídia (uso HID de 16 bits) |
| `0x03` | macro |
| `0x07` | sistema (Win `0x0700000E`, Mac `0x0700000F`) |
| `0x0D` | camada Fn (`0x0D000000` = Fn, `0x0D010000` = Fn1) |

- `0` significa nenhuma função e `0xFFFFFFFF` significa desconhecido.
- A tabela completa, com 184 entradas, está em `dados/hero68-keycodes.json`.

---

## 3. Layout e dados

### 3.1 Teclas

- `dados/hero68-layout.json`: as 68 teclas, cada uma com rótulo, `pos` do protocolo, linha/coluna, geometria (px e unidades u) e o keymap padrão das 3 camadas.
- `dados/hero68-jis-layout.json`: a versão JIS, com 72 teclas.

Numeração das teclas (`pos`):

| Teclas | pos |
|---|---|
| Esc | 1 |
| ` | 14 |
| 1 a = | 15–26 |
| Backspace | 27 |
| Tab | 28 |
| Q a ] | 29–40 |
| \ | 41 |
| Caps | 42 |
| A a ' | 43–53 |
| Enter | 54 |
| LShift | 55 |
| Z a / | 56–65 |
| RShift | 66 |
| LCtrl, Win, LAlt | 67–69 |
| Espaço | 70 |
| RAlt, Fn, RCtrl | 71–73 |
| Setas | 74–77 |
| Ins, Del | 98–99 |
| Home, End | 100–101 |
| PgUp, PgDn | 102–103 |

### 3.2 Camadas e perfis

- Cada perfil tem 3 camadas (0 = base, 1 = Fn, 2 = Fn1). Há 3 perfis gravados no teclado.
- Fn padrão: 1 a = viram F1–F12, A ativa o modo Win, S o modo Mac, [ vira Home e ] vira End.
- Fn1 padrão: atalhos de multimídia e aplicativos.

### 3.3 Valores padrão e limites

| Ajuste | Faixa | Padrão |
|---|---|---|
| Atuação | 0,1 mm até o curso do switch (no máximo 4,0 mm) | 1,0 mm |
| Rapid Trigger (pressionar/soltar) | 0,01–4,0 mm, separados ou juntos | desligado, 0,1/0,1 mm |
| Zonas mortas (topo/fundo) | 0–0,5 mm | desligadas, 0,1/0,1 mm |
| DKS | 4 distâncias, 0,1–4,0 mm | 1,0 / 3,0 / 3,0 / 1,0 mm |
| MT/TGL | tempo de 0–1000 ms | 200 ms |
| Polling rate | nível 0=1000, 1=500, 2=250, 3=125, 4=8000, 5=4000, 6=2000 Hz | nível 3 |
| Suspensão | 0 = nunca, 1 = 30 s … 120 = 60 min | 6 = 3 min |

### 3.4 Iluminação

- **Principal:** 20 modos. 0 = off, 1 = fixo, 2 = respiração, 3 = neon … 18 = tempestade, 19 = personalizado (RGB por tecla).
  - Brilho 0–20 e velocidade 0–4.
  - Cada modo tem cor própria e opção arco-íris.
- **Lateral:** modos off 0, fixo 3, fluxo 1, respiração 4, neon 2, corrida 5. Brilho e velocidade 0–4.
- **Ritmo musical:** só no Windows. Depende de um programa local (`HEROMusicServe.exe`) que conversa com a página via `ws://localhost:5170`.

### 3.5 Recursos detectados ao conectar (não fixos por modelo)

- **Tipos de switch suportados:** se houver algum, aparece a aba Performance.
- **Tipos de tecla avançada suportados:** definem quais tipos aparecem na aba de teclas avançadas.
- **Suporte a ritmo:** define se a aba Ritmo aparece.

---

## 4. Interface do driver oficial

**Abas:**

| Aba | O que faz |
|---|---|
| Teclado | remapear arrastando a função até a tecla, nas 3 camadas |
| Iluminação | luz principal e lateral |
| Macro | gravar e editar macros |
| Performance | atuação, Rapid Trigger, zonas mortas, tipo de switch, calibração e curso ao vivo |
| Teclas avançadas | DKS, MT, TGL, SOCD, MPT, END |
| Dispositivo | polling, trava Win, modo Mac, debounce, calibração adaptativa |
| Ritmo | efeitos de luz que reagem à música |

**Telas avulsas:** boas-vindas, setup, lista de dispositivos e configurações (idioma, tema, firmware, reset de fábrica).

**Perfis:** troca e renomeação dos 3 perfis, e exportação/importação em JSON.

**Firmware:** a página só consulta `hubx.pro/api/v1/firmware/fetch` e baixa um `.exe` de Windows. Nada é gravado pelo navegador.

**Idiomas:** 11, incluindo pt-BR, mas as traduções são automáticas e ruins (por exemplo, "Ganhe o bloqueio da chave"). Os catálogos estão em `dados/i18n-*.json`.

### Problemas encontrados (o que não repetir)

**Arquitetura**
- Bundle de 4,6 MB com quatro bibliotecas de UI misturadas (Quasar, Element Plus, Naive UI e Vuetify).
- Inclui código de mouses e de outras marcas.

**Layout e navegação**
- Tela fixa de no mínimo 1920×919 px.
- O teclado é um PNG com divs posicionadas em pixel por cima.
- Não há modo escuro: "sistema" na prática significa claro.
- A página inteira recarrega ao trocar de perfil, importar uma configuração ou mudar o polling.

**Bugs**
- Os listeners de evento nunca são removidos e se acumulam a cada navegação.
- O aviso de Rapid Trigger nunca dispara, porque compara µm com mm.
- O tooltip da zona morta inferior mostra o valor da superior.
- Os rótulos de dois tipos de macro estão trocados.
- O atraso de macro acima de cerca de 1.048 s é truncado sem aviso.
- A exportação de perfil perde o brilho da luz principal.
- A restauração do RGB personalizado verifica o modo 277 em vez de 19.
- Teclas avançadas:
  - O limite de 40 não é aplicado.
  - Só funcionam na camada 0.
  - Não dá para salvar nada na tecla Esc.
- A decodificação de `pos` soma bytes em vez de calcular `hi × 256 + lo` (app:111288 e app:111859). Funciona por sorte, porque nenhuma posição passa de 255.
- O reset de fábrica mostra uma barra de progresso falsa.

**Funções escondidas e textos**
- O tempo de suspensão existe no protocolo, mas não tem controle na interface.
- Alguns textos ficaram em chinês, fixos no código (modos de debounce, importação).
- Ficaram comandos `debugger;` e muito log no código.

**Dados**
- As macros existem só no localStorage: o botão "limpar dados" apaga todas.

---

## 5. Validação no teclado real (13/10/2026)

Leitura completa feita com o código do app (`readSnapshot`) por node-hid. O teclado era um HERO 68 HE com fio, firmware 0x0317. Resultado: 26 etapas, 174 pacotes, 182 ms e nenhum erro.

**Confirmado**
- A interface de configuração é a 2 (páginas de uso `0xFF00` e `0xFF60`). As interfaces 0 e 1 são teclado, mídia e mouse.
- O uuid `0x110000000003` identifica o HERO 68 HE.
- O firmware vem em little-endian: `17 03` = 0x0317, igual ao bcdDevice do USB.
- A precisão do sub 6 é 10, e o sub 8 responde 0, então o app usa 10. A unidade é 0,01 mm, e os valores lidos (0,70 mm e 0,40 mm) fazem sentido.
- O comando de suspensão (`0x84 0x13`) responde no modelo com fio. O valor lido foi 0.
- O GET de teclas avançadas responde com tamanho 0 quando não há nenhuma configurada.
- A camada Fn de fábrica tem funções que não estão na tabela do driver oficial. Elas batem com o manual:
  - **`0x07` sistema:**
    - `01` trava da tecla Win (Fn+Win);
    - `04` restaurar padrão de fábrica (Fn+Espaço por 5 s);
    - `0b` provavelmente liga/desliga a luz (Fn+Ins).
  - **`0x08 PP SS TT` iluminação.** PP: 00 efeito, 02 cor, 03 brilho, 04 velocidade. SS: 00 alterna, 01 aumenta, 02 diminui. TT: 00 luz principal, 01 luz lateral.
    - Luz principal: PgUp (efeito), Del (cor), ↑ e ↓ (brilho), → e ← (velocidade).
    - Luz lateral: RAlt (efeito), X (cor), C (brilho), Z (velocidade).
  - **`0x09 00 00 0N`** em V, B e N. Função desconhecida, talvez perfis 1–3.
  - **Outras teclas:** Fn+Esc = `` ` ``. RCtrl vira Fn2 nas camadas 1 e 2.
- O `hero68-layout.json` do app foi atualizado com esses padrões de fábrica.
- Conferido pelo dono olhando o teclado:
  - a trava da tecla Win lida como ligada está certa;
  - a atuação de 0,40 mm e o RT de 0,20 mm em C e B foram configurados por ele, então as posições estão certas;
  - o modo de luz 1 é "Fixo", com o teclado todo branco e uniforme.
- A cor da luz guarda o nível do LED. O driver oficial lê e grava r, g, b sem conversão. O valor `25, 24, 25` aparece como branco no teclado, então o app mostra as cores normalizadas para a intensidade máxima e deixa o valor bruto no texto.
- A ordem do Rapid Trigger foi conferida na tecla V. No driver oficial ficou pressionar 0,84 mm e soltar 1,51 mm, e o teclado devolveu `00 54` (84) e depois `00 97` (151). O primeiro campo (`rt_up`) é pressionar e o segundo (`rt_down`) é soltar, como na tabela do comando `0x19`. A versão anterior do app tinha os dois trocados.
- As cores por tecla só valem no efeito Personalizado (19). No modo Fixo elas continuam gravadas, mas não aparecem.

**Gravação da atuação (`0x13`), validada**
- O frame é o mesmo do driver oficial (`sync_distance`): sub 0, total 1, índice 0 e registros de 5 bytes `[pos u16, passos u16, global u8]`, até 11 por frame. O passo é a precisão (10 µm).
- O driver oficial reenvia o `global` lido do teclado (1 quando não há valor). Todas as teclas leram `global = 1`. O app lê os flags antes de gravar e mantém cada um.
- O teclado responde ecoando o frame. Não existe comando separado para salvar: o driver oficial não envia nada depois do `0x13`.
- Teste de ida e volta na tecla V, que estava em 0,10 mm:
  - gravou 0,50 mm (`13 00 00 01 00 05 00 3b 00 32 01`);
  - a releitura das 68 teclas mostrou só V alterada, com 0,50 mm;
  - voltou para 0,10 mm, e a releitura ficou igual à de antes do teste.
- No app, o valor gravado é confirmado relendo o teclado. Se a releitura não bater, o app avisa.

**Gravação do Rapid Trigger (`0x19`), validada**
- O frame segue o do driver oficial: sub 0, total 1, índice 0 e registros de 8 bytes `[pos u16, ativo u8, pressionar u16, soltar u16, global u8]`, até 6 por frame. O passo é a precisão `rt` (10 µm), e o mínimo aceito é um passo.
- O driver oficial manda `global` como o valor lido, trocando 0 por 1. O app faz o mesmo. Todas as teclas leram `global = 1`.
- O driver oficial tenta até 3 vezes, esperando 1 s pela resposta. O app também. O teclado responde ecoando o frame, e não há comando de salvar.
- Sem o "valores separados" (`rt_split`), o driver oficial grava soltar igual a pressionar. O app grava os dois campos; a opção "Mesmo valor para pressionar e soltar" só preenche os dois com o mesmo número.
- Teste de ida e volta na tecla V, que estava ligada com 0,84 / 1,51 mm:
  - gravou 0,30 / 0,50 mm (`19 00 00 01 00 08 00 3b 01 00 1e 00 32 01`), e a releitura das 68 teclas mostrou só V alterada;
  - desligou (`… 00 3b 00 00 1e 00 32 01`), e de novo só V mudou;
  - voltou para 0,84 / 1,51 mm (`… 00 3b 01 00 54 00 97 01`), e a releitura ficou igual à de antes do teste;
  - a atuação das teclas não mudou em nenhuma etapa.
- No app, só os campos alterados são gravados: o restante de cada tecla vem da leitura feita logo antes. Depois o app relê e avisa se algo não bateu.

**Gravação das zonas mortas (`0x16`), validada**
- O frame segue o do driver oficial: sub 0, total 1, índice 0 e registros de 8 bytes `[pos u16, topo u16, fundo u16, global u8, ativo u8]`, até 6 por frame. O passo é a precisão `distance` (10 µm). Os limites são os do driver oficial: de 0 a 0,50 mm em cada zona.
- No driver oficial, `global = 1` é o modo por tecla e 0 segue os ajustes globais. Ele manda o valor lido, trocando 0 por 1, e o app faz o mesmo. Todas as teclas leram `global = 1`.
- Mesma espera e tentativas do Rapid Trigger (1 s, até 3 vezes). O teclado responde ecoando o frame, e não há comando de salvar.
- Antes do teste, todas as teclas estavam desligadas com 0,10 / 0,10 mm (topo / fundo).
- Teste de ida e volta na tecla V:
  - ligou com 0,20 / 0,30 mm (`16 00 00 01 00 08 00 3b 00 14 00 1e 01 01`), e a releitura das 68 teclas mostrou só V alterada;
  - desligou (`… 00 3b 00 14 00 1e 01 00`), e de novo só V mudou;
  - voltou para 0,10 / 0,10 mm (`… 00 3b 00 0a 00 0a 01 00`), e a releitura ficou igual à de antes do teste;
  - a atuação e o Rapid Trigger não mudaram em nenhuma etapa.
- O texto do driver oficial explica para que servem: a zona superior reduz toques acidentais, e a inferior evita que a tecla solte sozinha com um leve tremor do dedo no fundo do curso.
- No app, como no Rapid Trigger, só os campos alterados são gravados, e o app relê o teclado para confirmar.

**Gravação dos ajustes gerais (`0x04`), validada**
- O frame é o do driver oficial: `04 id 00 01 00 01 valor`, um byte de dado. Os ids são os mesmos da leitura (`0x84`): modo Mac `0x11`, trava Win `0x15`, polling `0x17`, debounce `0x18` e calibração adaptativa `0x19`.
- Nos ajustes liga/desliga o teclado responde ecoando o frame, e não há comando de salvar.
- Teste de ida e volta em cada um (trava Win, modo Mac, debounce e calibração): cada valor foi invertido e depois restaurado. Por exemplo, a trava Win desligada foi `04 15 00 01 00 01 00`. Em cada etapa só o ajuste do teste mudou, e a atuação das 68 teclas ficou igual.
- **Polling:** níveis 0 = 1000, 1 = 500, 2 = 250, 3 = 125, 4 = 8000, 5 = 4000 e 6 = 2000 Hz. A interface oficial do modelo com fio oferece os 7.
  - Depois de `04 17 00 01 00 01 01`, o teclado não ecoa. Ele se desconecta na hora e volta em cerca de 1,5 s, já com o novo valor. O driver oficial manda o usuário para a lista de dispositivos e recarrega a página.
  - Teste: 1000 → 500 → 1000 Hz. Depois de cada reconexão a leitura mostrou o nível novo, e no fim todos os ajustes estavam iguais aos de antes.
  - No app, a troca de polling espera o teclado voltar e relê tudo sozinho. Se ele não voltar em 8 s, o app mostra o aviso de desconectado.
- A suspensão não aparece na interface oficial do modelo com fio, então o app só a mostra.

**Gravação do mapeamento (`0x03`), validada**
- O frame segue o do driver oficial: o sub é a camada (0 a 2), total 1, índice 0 e registros de 6 bytes `[pos u16, função u32]`, até 9 por frame. A função usa o formato da seção 2.7.
- O teclado responde ecoando o frame, e não há comando de salvar.
- Teste de ida e volta na tecla V (posição 59) da camada principal:
  - trocou V por B (`03 00 00 01 00 06 00 3b 00 00 00 05`), e a releitura das 3 camadas mostrou só `L0:59` alterada;
  - voltou para V (`… 00 3b 00 00 00 19`), e as 3 camadas ficaram iguais às de antes do teste.
- No app, o mapeamento grava na camada aberta e relê as teclas gravadas para confirmar. Ao trocar uma tecla Fn, o app avisa que as camadas Fn deixam de ser acessíveis pelo teclado.

**Curso ao vivo (`0x98`), validado**
- Três frames, todos com total 1 e índice 0:
  - `98 00` liga o modo de medição, e o teclado ecoa;
  - `98 01` pede teclas: o byte 5 é 2 × n, e os dados são as posições (`pos u16`);
  - `98 02` sai do modo, e o teclado ecoa. Depois disso não chega mais nenhuma leitura.
- Cada pedido recebe um frame `98 01` com até 9 teclas, 6 bytes cada: `[pos u16, distância u16, leitura u16]`. O bit 15 da leitura indica tecla acionada, e os outros 15 são o valor do sensor.
- A distância vem em passos da precisão `rt` (10 µm), como o driver oficial calcula. Em repouso ela fica em 0 ou 1 passo, e o sensor marca entre 9100 e 10270.
- Mesmo sem pedido, o teclado manda sozinho um frame com uma tecla a cada 50 ms, mais ou menos. No primeiro teste foi C, a última tecla apertada antes de ligar o modo.
- **Limite:** pedir 9 teclas funciona, e pedir 10 devolve só 9. Um pedido com 28 teclas fez o teclado reiniciar: ele se desconectou e voltou sozinho. A releitura completa mostrou a atuação e o Rapid Trigger das 68 teclas iguais aos de antes. O app nunca pede mais de 9.
- O modo de medição não muda nenhum ajuste: a atuação e o Rapid Trigger das 68 teclas ficaram iguais antes e depois de cada teste.
- O driver oficial pede `[tecla atual]` a cada 100 ms. Ele começa pela primeira tecla que chega e troca para outra quando ela aparece acionada enquanto a atual está solta.
- No app:
  - pede a cada 100 ms a tecla acompanhada e as que ainda estão descendo, até 9;
  - clicar numa tecla da tela fixa o acompanhamento nela;
  - sai do modo ao fechar a aba, esconder a página, desconectar, reler ou antes de qualquer gravação;
  - as leituras ficam fora do registro de pacotes, que senão se encheria em segundos.
- Testado pelo dono no teclado real, pelo app.

**Tipo de switch (`0x15`), validado**
- Frame do driver oficial (`sync_key_type`): `15 00 00 01 00 len`, com `[pos u16, tipo u8]` por tecla, até 18 teclas por frame. O teclado ecoa o frame inteiro, e o driver oficial manda até 3 vezes, esperando 1 s pelo eco.
- A leitura é a `0x95`, com o mesmo registro de 3 bytes.
- O teclado de teste informa 11 modelos compatíveis, todos com 3,4 mm de curso: Jade Pro, Uranus Gaming, Wing Chun, Magneto King, Black King, Meteor, Jade King, Dragon King, Jade, Pink King e Jade Emperor. As 68 teclas vêm de fábrica com Jade King (`14`).
- Teste de ida e volta na tecla V (`59`): Jade King → Jade Pro (`1`) → Jade King. Só o tipo da V mudou, e voltou. A atuação, o Rapid Trigger e as zonas mortas das 68 teclas ficaram iguais, e a leitura em repouso da V (0 a 10 µm, sensor perto de 10020) não mudou com o tipo.
- Ao escolher um switch, a tela do driver oficial traz a atuação para dentro do curso do novo modelo (`distance > sw.distance ? sw.distance : distance`) e grava o tipo antes da atuação. O app faz o mesmo no rascunho e grava o tipo primeiro. Com os modelos deste teclado, todos de 3,4 mm, isso nunca acontece.
- O app só oferece os modelos que o próprio teclado informa.

**Ainda não confirmado**
1. Se a atuação, o Rapid Trigger, as zonas mortas e o mapeamento gravados continuam depois de desconectar o cabo. O driver oficial não manda comando de salvar, então devem continuar. O polling já continua depois da reconexão.
2. O significado dos 4 bytes de ação do DKS e as teclas avançadas nas camadas 1 e 2. Nenhuma estava configurada, e isso ficou para quando a gravação for implementada.
3. O que o valor 0 de suspensão significa na prática.
4. Se o tipo de switch muda a conversão da leitura do sensor em distância. Entre Jade King e Jade Pro, de mesmo curso, a leitura em repouso não mudou; falta comparar modelos de curso diferente, que este teclado não aceita.
