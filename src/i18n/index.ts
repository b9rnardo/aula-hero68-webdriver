import type { Localized } from "../data/keycodes";
import { useDriver } from "../store/driver";
import { locale, translate, type MessageKey, type Vars } from "./core";

export * from "./core";

export function useI18n() {
  const lang = useDriver((state) => state.lang);
  return {
    lang,
    t: (key: MessageKey, vars?: Vars) => translate(lang, key, vars),
    /** Picks the current language from a { pt, en } pair. */
    l: (text: Localized) => text[lang],
    /** µm → "1,20" / "1.20" (mm, two decimals). */
    mm: (um: number) =>
      (um / 1000).toLocaleString(locale(lang), { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    number: (value: number) => value.toLocaleString(locale(lang)),
    date: (iso: string) => new Date(iso).toLocaleString(locale(lang), { dateStyle: "medium", timeStyle: "short" }),
  };
}
