import { MESSAGES, type Lang, type MessageKey } from "./messages";

export type { Lang, MessageKey };
export type Vars = Record<string, string | number>;

export function translate(lang: Lang, key: MessageKey, vars?: Vars): string {
  const text = MESSAGES[lang][key] ?? MESSAGES.pt[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match)) : text;
}

export function detectLang(): Lang {
  const languages = typeof navigator === "undefined" ? [] : navigator.languages ?? [navigator.language];
  return languages.some((code) => code?.toLowerCase().startsWith("pt")) ? "pt" : "en";
}

export const locale = (lang: Lang) => (lang === "pt" ? "pt-BR" : "en-US");
