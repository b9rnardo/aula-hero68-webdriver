# HERO 68 HE Web Driver

Driver WebHID não oficial do AULA HERO 68 HE (React 19, TypeScript, Vite, Tailwind 4, zustand).

- **Interface:** toda página ou função nova segue [docs/design-system.md](docs/design-system.md). Leia antes de mexer em `src/pages/` ou `src/components/`.
- **Protocolo:** o que se sabe do driver oficial está em [docs/analise.md](docs/analise.md).
- **Gravação no teclado:** uma função por vez, só depois de testar ida e volta no teclado real. Tipo de switch (0x15), calibração (0x94) e curso ao vivo (0x98) continuam desligados; iluminação, perfis, teclas avançadas e macros são só leitura.
- **Textos:** pt-BR e en em `src/i18n/messages.ts`; explicações vão no "i" (`InfoTip`), não na tela.
- **Antes de entregar:** `npm run typecheck && npm test && npm run build`.
