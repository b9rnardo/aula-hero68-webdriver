# HERO 68 HE Web Driver

Driver WebHID não oficial do AULA HERO 68 HE (React 19, TypeScript, Vite, Tailwind 4, zustand).

- **Interface:** toda página ou função nova segue [docs/design-system.md](docs/design-system.md). Leia antes de mexer em `src/pages/` ou `src/components/`.
- **Protocolo:** o que se sabe do driver oficial está em [docs/analise.md](docs/analise.md).
- **Gravação no teclado:** uma função por vez, só depois de testar ida e volta no teclado real. Perfis, teclas avançadas e macros são só leitura. O curso ao vivo (0x98) só lê: nunca peça mais de 9 teclas por frame (28 reiniciaram o teclado).
- **Textos:** pt-BR e en em `src/i18n/messages.ts`; explicações vão no "i" (`InfoTip`), não na tela.
- **Antes de entregar:** `npm run typecheck && npm test && npm run build`.
