# HERO 68 HE — driver web

Driver web não oficial para o teclado magnético **AULA HERO 68 HE (com fio)**. Roda no navegador via WebHID, sem instalar nada.

> **Fase 2: gravação aos poucos.** Esta versão lê tudo do teclado e gera um backup em JSON. Por enquanto grava o **ponto de atuação** e o **Rapid Trigger**. Cada ajuste só passa a ser gravado depois de testado no teclado real (ver `docs/analise.md`, seção 5).

## O que já faz

Interface inspirada no Wootility: barra de ícones, menu lateral por seção, teclado no topo da página e cartões de ajuste embaixo. Clique ou arraste sobre as teclas para selecionar várias; os cartões passam a mostrar só os valores delas.

- Conecta pelo WebHID (Chrome ou Edge, em HTTPS ou localhost) e reconecta sozinho se o teclado já foi autorizado.
- **Ajustes rápidos:** resumo de atuação, Rapid Trigger, iluminação, polling rate e identificação.
- **Ponto de atuação, Rapid Trigger e zonas mortas:** valor de cada tecla, distribuição clicável e o curso do switch.
- **Gravar a atuação:** escolha as teclas, ajuste o valor (de 0,10 mm até o curso do switch) e clique em Aplicar. O app relê o teclado para confirmar.
- **Gravar o Rapid Trigger:** liga e desliga por tecla e ajusta a sensibilidade de pressionar e soltar (de 0,01 mm até o curso do switch), juntas ou separadas. Um gráfico simula a tecla com os valores escolhidos. O app relê o teclado para confirmar.
- **Mapeamento:** as 3 camadas (principal, Fn, Fn2), teclas diferentes do padrão de fábrica e biblioteca de funções com busca.
- **Teclas avançadas:** DKS, MT, TGL, SOCD, MPT e END de cada camada.
- **Iluminação:** efeito, cor, brilho e velocidade da luz principal e lateral, e as cores por tecla.
- **Meus perfis:** perfis do teclado, baixar backup em JSON e abrir um backup salvo sem o teclado.
- **Ajustes:** polling rate, trava Win, modo Mac, debounce, calibração adaptativa, suspensão, idioma e log dos pacotes HID.
- **Demonstração:** mostra a interface com valores de exemplo, sem teclado.
- Português e inglês.

## Rodar

```bash
npm install
npm run dev
```

Abra http://localhost:5173 no Chrome ou no Edge.

```bash
npm test          # testes do protocolo
npm run build     # gera dist/ (site estático)
```

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/hid/` | protocolo (frames, checksum), transporte WebHID, API do teclado, leitura completa |
| `src/data/` | layout das 68 teclas, keycodes, switches, efeitos de luz |
| `src/store/` | estado do app (zustand) |
| `src/i18n/` | textos em pt-BR e inglês |
| `src/pages/`, `src/components/` | interface (React + Tailwind) |
| `docs/` | análise do driver oficial e dados extraídos |

## Publicar

O `npm run build` gera um site estático em `dist/` com caminhos relativos. Serve em GitHub Pages, Vercel, Netlify ou Cloudflare Pages. Precisa de HTTPS, porque o WebHID não funciona em HTTP.

---

Unofficial web driver for the AULA HERO 68 HE (wired). Read-only for now: it reads the full configuration over WebHID and exports a JSON backup. Chrome or Edge required. Not affiliated with AULA.
