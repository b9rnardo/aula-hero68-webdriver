# Design system — HERO 68 HE Web Driver

Padrão visual e de interação do driver ("Grafite Violeta"). Toda página ou função nova segue este documento.
Se algo novo não couber aqui, atualize este arquivo no mesmo commit em vez de abrir uma exceção.

Onde está cada coisa:

| O quê | Arquivo |
| --- | --- |
| Tokens (cores, fontes) e todas as classes | `src/index.css` (`@theme` no topo, `@layer components` depois) |
| Componentes básicos | `src/components/ui.tsx` |
| Ícones (traço 24×24) | `src/components/icons.tsx` |
| Teclado no topo das páginas | `src/components/KeyboardStage.tsx` |
| Editor de milímetros | `src/components/MmControl.tsx` |
| Moldura: cabeçalho, menu, barra de gravação, aviso rápido, Ctrl K | `src/components/AppShell.tsx` |
| Páginas e menu lateral | `src/navigation.ts` |
| Rascunho, desfazer e gravação | `src/store/draft.ts` |
| Seleção de teclas e preferências do app | `src/store/ui.ts` |
| Textos (pt e en) | `src/i18n/messages.ts` |

## 1. Princípios

1. **Nada vai para o teclado sem passar pela barra de gravação.** Toda mudança entra no rascunho (`useDraft.edit`), aparece com um ponto violeta e só é gravada em "Gravar no teclado" (ou Ctrl/⌘ S). A exceção é a calibração: ela é uma ação feita junto com o teclado, começa e termina por um botão no próprio card e não passa pelo rascunho.
2. **Switch (interruptor) só para preferências do app.** Ajustes do teclado usam caixa de seleção (`Check`) ou controle segmentado (`Seg`). Assim fica claro o que é do navegador e o que é do teclado.
3. **Desfazer em vez de pedir confirmação.** Nada de "Tem certeza?". A ação acontece e o aviso rápido oferece "Desfazer". Ctrl/⌘ Z também desfaz.
4. **Avisos ficam junto do que explicam.** Um risco aparece como `Note` dentro do card do ajuste. Só o sucesso (e o "Desfazer") vira aviso rápido no canto. Erros de gravação também aparecem no canto, porque não têm um card só deles.
5. **Explicação vai no "i".** O texto que ensina mora no `InfoTip`. Na tela ficam só títulos, rótulos, valores, legendas curtas de estado e avisos curtos de risco.
6. **Mostrar o valor real.** Valores exibidos incluem as mudanças não gravadas (`current.*`). Quando o que está no teclado é diferente, a legenda diz isso ("No teclado: 1,00 mm").
7. **Função que ainda não grava fica visível, mas trancada.** Use `readOnly: true` em `navigation.ts` (cadeado no menu) e `ReadOnlyPill` no card.

## 2. Tokens

Use sempre os tokens: `var(--color-*)` no CSS ou as classes do Tailwind geradas pelo `@theme` (`bg-card`, `text-muted`, `border-line`, `text-accent-light`…). Não escreva hex solto em componentes.

### Superfícies (da mais escura para a mais clara)

| Token | Uso |
| --- | --- |
| `app` `#0e0c13` | fundo da página |
| `surface` `#131119` | menu lateral, placa do teclado, `Seg` |
| `card` `#18151f` | cards |
| `raised` / `raised-hover` | itens dentro de cards, linha selecionada, `Note` info |
| `key` `#231e2e` | teclas |
| `pop` `#2a2536` | dicas (`InfoTip`), menus, paleta Ctrl K |

### Bordas e texto

| Token | Uso |
| --- | --- |
| `line` | divisórias e borda de card (decorativa) |
| `field-line` | borda de controles: botão secundário, campo, chip, `Seg` |
| `hover-line` | borda no hover |
| `key-line` | borda das teclas |
| `fg` | texto principal |
| `fg-2` | texto de apoio |
| `muted` | legendas (`.cap`), rótulos de lista |
| `key-text` | valor dentro da tecla e texto das dicas |

### Destaque e estados

| Token | Uso |
| --- | --- |
| `accent` `#a48bff` | botão principal, seleção, ponto de "não gravado" |
| `accent-hover` | hover do botão principal |
| `accent-light` | links (`Lnk`), ícone de card, números em destaque |
| `accent-icon` | ícone de `Note` info e do aviso rápido |
| `accent-ring` | borda da tecla selecionada |
| `ink` | texto sobre fundo `accent` |
| `ok` / `warn` / `danger` | conectado e sucesso / atenção / erro |
| `release` | soltura no Rapid Trigger (gráfico) |

### Medidas

| | Valor |
| --- | --- |
| Raio | tecla 7 · controle 8–10 · card 14 · card da tela inicial 16 · pílula 999 |
| Espaçamento | múltiplos de 4; entre cards 16; padding do card 20; laterais da página 24 (16 no celular) |
| Altura de controle | 36 (`sm` 32, `lg` 48); alvo de toque mínimo 24×24 |
| Largura | conteúdo até 1160; `narrow` 760; teclado até 740 |

### Tipografia

Fonte Geist (texto) e Geist Mono (números em mm, bytes, códigos).

| Classe | Tamanho/altura | Uso |
| --- | --- | --- |
| `.h1` | 22/28, 600 | título da página (`.h1.s` 18/24 no topo com teclado) |
| `.ct` | 16/22, 600 | título de card |
| corpo | 14/20 | texto normal |
| `.lab` | 13/18, 500 | rótulo de grupo dentro de card |
| `.cd`, `.note`, dicas | 13/19 | texto de apoio |
| `.cap` | 12/16, `muted` | legenda; **12 px é o mínimo** |
| `.stat` | 28/34, 600 | número de resumo (visão geral, `Kpi`) |
| `.big` | 36/40, 600 | valor principal de um editor |

Regras de número:

- Distâncias em mm usam **mono** (`font-mono`) com 2 casas e vírgula em pt (`mm()` do `useI18n`).
- Contagens, Hz e porcentagens usam a fonte normal com `tabular-nums` (`number()` do `useI18n`).
- A unidade vem ao lado, menor e em `muted`.

## 3. Acessibilidade (WCAG 2.2 AA)

- Texto com contraste ≥ 4,5:1. O que mostra estado (anel de seleção, foco, caixa marcada, trilho do slider, ponto de "não gravado") ≥ 3:1. Controles sem texto precisam ser reconhecíveis pelo ícone e pelo nome acessível, não só pela borda. Ao criar uma cor nova, meça.
- **Seleção** = anel violeta. **Foco do teclado** = contorno branco de 2 px (`:focus-visible`, global). **Mudança não gravada** = ponto violeta. Os três nunca se confundem, e nenhum depende só de cor: a tecla também diz "não gravado" no nome acessível.
- Todo botão só com ícone tem `aria-label`. Ícones decorativos ficam com `aria-hidden` (padrão do `Icon`).
- Cada tecla tem nome falado com o valor (`KeyCap.desc`), por exemplo "W, 0,40 mm, não gravado".
- Esc fecha a dica, o menu ou o aviso; só depois limpa a seleção.
- Progresso usa `role="progressbar"` com `aria-valuenow`; estados que mudam sozinhos usam `role="status"`.
- Nada de `title=` como única explicação: use `InfoTip`.

## 4. Explicações: `InfoTip`

```tsx
<Card title={t("act.title")} info={t("act.info")}>…</Card>          // "i" ao lado do título do card
<Title as="span" info={t("act.presetsInfo")} infoLabel={t("info.presets")}>{t("common.presets")}</Title>
<InfoTip label={t("selection.howLabel")}>{t("selection.how")}</InfoTip>
```

- O texto da dica pode ter `**negrito**` (renderizado por `Rich`). Use para o nome do conceito.
- Chave de tradução com sufixo `Info` (`act.info`, `rt.continuousInfo`…).
- No máximo 2–3 frases. Se precisar de mais, divida entre os "i" dos subtítulos.
- Perto da borda direita, use `end` para a dica abrir para a esquerda.

Fica **visível** (fora do "i"): título, rótulo, valor, legenda curta de estado ("No teclado: 1,00 mm", "Valores em Hz"), aviso curto de risco (`Note tone="warn"`).

## 5. Estrutura das páginas

Cada página é registrada em `src/navigation.ts` (`page(id, icon, needsData, stage, readOnly)`), ganha `nav.<id>` nas traduções e entra em `DATA_PAGES` no `App.tsx` se precisar de dados do teclado. Sem dados, o app mostra a tela de boas-vindas no lugar.

### Página com teclado (ajuste por tecla)

```tsx
<>
  <KeyboardStage
    title={t("nav.minhaPagina")}
    values                       // mostra o interruptor "Valores"
    sameValue={valorDe}          // clique duplo seleciona teclas com o mesmo valor
    render={(key) => ({ legend: legend(key), value, bg, dirty: key.pos in draft.x, desc })}
    legend={…}                   // legenda da cor das teclas
  />
  <PageBody>
    <div className="grid2">
      <Card title=… info=… aside={selected.length > 0 && <Pill>{count(selected.length)}</Pill>}>
        {!lido ? <Empty title={t("common.notReadTitle")}>…</Empty> : !keys.length ? <SelectionEmpty /> : editor}
      </Card>
      <Card title=… info=…>visualização + <ValueRows /> ("Valores em uso")</Card>
    </div>
  </PageBody>
</>
```

- Card da esquerda (`grid2` é 1,3 : 1): o editor da seleção. Card da direita: diagrama ou gráfico e "Valores em uso".
- Os três estados do card de edição, sempre nesta ordem: **não lido** (`Empty`) → **nada selecionado** (`SelectionEmpty`) → **editor**.
- Seletor de camada ou modo vai em `extra` do `KeyboardStage`, como `Seg`.
- **Teclado que só aponta uma tecla** (curso ao vivo): passe `pick={(pos) => …}` e `status`. Para um teclado que só mostra (calibração), passe um `pick` que não faz nada. O clique escolhe a tecla em vez de selecionar, e somem os atalhos de seleção e a legenda "Não gravada". A tecla escolhida vem com `on: true` no `render`; `fill` (0–1) e `hot` desenham quanto a tecla desceu e se está acionada.

### Página sem teclado (ajustes gerais)

```tsx
<PageBody>               {/* className="narrow" para páginas de uma coluna */}
  <PageHeader title={t("nav.x")}>{ações da página: Button sm}</PageHeader>
  <div className="grid2">…cards…</div>
</PageBody>
```

### Layouts

| Classe | Uso |
| --- | --- |
| `grid2` | duas colunas (1,3 : 1); vira uma coluna abaixo de 980 px |
| `bento` | cards de resumo de mesmo peso (visão geral) |
| `stack` | cards empilhados com 16 de espaço |
| `grid3` | três opções lado a lado dentro de um card |
| `narrow` | limita a 760 px (Interface, Ajuda) |

## 6. Componentes

| Componente | Quando usar |
| --- | --- |
| `Card {title, info, sub, aside}` | todo bloco de conteúdo. `sub` = legenda curta de estado, não explicação. `aside` = pílula, contagem ou ação pequena |
| `Button variant="pri" \| "sec" \| "gh"` | `pri`: **uma** ação principal por área. `sec`: padrão. `gh`: ação discreta (Limpar, Sair). Tamanhos `sm`, `lg`; `ico` para só ícone (com `aria-label`) |
| `Seg` | escolha única entre 2–7 opções curtas (camada, polling rate, modo) |
| `Check` | ajuste do teclado ligado/desligado |
| `Switch` | **só** preferência do app (idioma, mostrar valores) |
| `Chip` | seleção rápida de teclas e filtros |
| `Pill` / `ReadOnlyPill` | contagem, estado (`ok`, `hot`), "Somente leitura" |
| `ChangedTag` | ao lado de um ajuste geral com mudança não gravada |
| `Note tone="info" \| "warn" \| "bad"` | aviso dentro do card: `warn` para risco, `bad` para erro ou falta de suporte |
| `Empty` / `SelectionEmpty` | estado vazio com ícone e título curto |
| `ValueRows` | "Valores em uso": uma linha por valor, clique seleciona as teclas |
| `MmCaption`, `MmField`, `MmSlider` + `useMm` | qualquer valor em milímetros |
| `Select` | escolha única entre muitas opções (efeitos de luz). Para 2–7 opções curtas, use `Seg` |
| `LevelSlider` | nível inteiro sem unidade (brilho, velocidade), com a marca do valor gravado |
| `ColorField` | cor: seletor do sistema, código hex e cores rápidas. `value` nulo = cores misturadas |
| `Kpi`, `Dl`, `Lnk`, `Kbd`, `Swatch` | número com rótulo, lista rótulo/valor, link para outra página, tecla de atalho, amostra de cor |

Não crie variações locais (outro raio, outra borda, outro botão). Se faltar algo, crie o componente em `ui.tsx`, a classe em `index.css` e registre aqui.

### Ícones

Traço 24×24 em `icons.tsx`, `stroke-width` 1,75, pontas arredondadas. Tamanhos: 18 (padrão), `s` 16, `xs` 14. Ícone de página igual ao do menu. `info` é o "i" sem círculo, usado dentro do botão redondo do `InfoTip`; `note` é o "i" com círculo, usado em `Note` e no aviso rápido.

## 7. Dados e edição

- **Ler:** `snapshot` vem por props (páginas em `DATA_PAGES`). Valores atuais com rascunho: `current.act / rt / dz / fn / setting(draft, snapshot, …)`.
- **Editar:** `const { draft, edit, selected, writable } = useEditor()`, depois `edit("tipo", (d) => { … })`. Edições do mesmo tipo em menos de 800 ms viram um só passo de desfazer (arrastar o slider).
- **Bloquear:** controles ficam `disabled={!writable}` (sem teclado, gravando ou só leitura).
- **Selecionar teclas:** `useUi` (`selected`, `select`). Gestos do teclado: clique alterna, Shift + clique pega intervalo, arrastar marca várias, clique duplo pega as de mesmo valor.
- **Milímetros:** sempre em µm no estado, convertidos só na tela com `mm()`. `useMm` arredonda para a precisão do teclado (`stepOf(snapshot)`).
- **Aviso rápido:** `showToast({ tone: "ok" | "bad" | "info", text, undo? })`. Só para resultado de ação (gravou, descartou, copiou, falhou).

## 8. Gravar uma função nova no teclado

1. Implemente o comando no driver (`src/store/driver.ts` / `src/hid/`) **com leitura de volta** do que foi gravado.
2. Teste ida e volta no teclado real, uma função de cada vez. Só depois libere na interface.
3. Adicione o tipo no `Draft`, em `normalize`, em `pendingOf` e um passo em `save()` com rótulo `save.step.<tipo>`.
4. Até lá, a página fica `readOnly` com `ReadOnlyPill`.

Perfis, teclas avançadas e macros seguem só leitura. A iluminação (luzes principal e lateral e cores por tecla) e a calibração estão liberadas.

O curso ao vivo (0x98) está liberado: ele só lê e não muda ajuste nenhum. Regras dele (`src/store/live.ts`): no máximo 9 teclas por pedido (28 fizeram o teclado reiniciar); o modo de medição começa por um botão e termina sozinho ao sair da aba, esconder a página, desconectar, reler ou gravar, sempre mandando a saída antes de qualquer gravação.

A calibração (0x94) está liberada e segue as mesmas regras de início e fim (`src/store/calibration.ts`): começa por um botão, termina em "Concluir" ou sozinha ao trocar de modo ou de página, esconder a aba, desconectar, reler ou gravar. Enquanto calibra, a página ignora o teclado (para as teclas apertadas não rolarem a página nem acionarem botões). Ao concluir, relê a faixa das teclas que terminaram e confere com o que o teclado informou. Ela não tem como ser desfeita, só refeita.

## 9. Textos (i18n)

- Toda chave existe em `pt` **e** `en` (`en` é `Record<MessageKey, string>`: faltar uma chave não compila).
- Português do Brasil simples e curto. Verbos no imperativo nos botões ("Gravar no teclado", "Abrir backup"). Sem jargão quando houver palavra comum; termos do mercado ficam como são (Rapid Trigger, polling rate).
- Chaves montadas em tempo de execução (`` `nav.${id}` as MessageKey ``) precisam existir para todos os valores possíveis: procure por `as MessageKey` ao adicionar uma.
- Plurais: chaves `…One` / `…Many`. Números e mm sempre por `number()` e `mm()`.

## 10. Responsivo

- ≤ 1180 px: menu lateral só com ícones e busca sem texto.
- ≤ 980 px: `grid2` vira uma coluna.
- ≤ 640 px: menu vira gaveta (botão ☰), valores somem das teclas, busca vira só ícone, idioma fica na página Interface, laterais 16 px.
- Altura ≤ 820 px: o teclado deixa de ficar fixo no topo.
- Nada de rolagem horizontal da página. Teste em 390 px de largura.

## 11. Checklist antes de entregar

- [ ] Segue a estrutura da seção 5 e usa só componentes e tokens existentes.
- [ ] Explicações no "i"; na tela só título, rótulo, valor, estado e risco.
- [ ] Mudanças passam pelo rascunho; nada grava direto.
- [ ] Textos em pt e en; nenhuma chave dinâmica faltando.
- [ ] Teclado: Tab chega em tudo, foco visível, Esc fecha, botões só com ícone têm nome.
- [ ] Conferido em 1440 px, 1100 px e 390 px.
- [ ] `npm run typecheck && npm test && npm run build` sem erros.
