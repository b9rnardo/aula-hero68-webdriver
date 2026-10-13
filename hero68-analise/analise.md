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

## 5. Pontos ainda não confirmados (validar no teclado real)

1. O valor de precisão que o seu teclado retorna. Se não for 10, as unidades mudam.
2. Se pressionar/soltar do Rapid Trigger estão na ordem certa no protocolo. A interface oficial usa nomes invertidos.
3. O significado exato dos 4 bytes de ação do DKS.
4. Se teclas avançadas funcionam nas camadas 1 e 2.
5. Se o comando de suspensão funciona no HERO 68 HE com fio.
6. O comportamento do teclado depois de mudar o polling. O driver oficial recarrega a página, provavelmente porque o teclado reconecta.
