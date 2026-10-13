import { describeKey, type KeyCategory } from "../data/keycodes";
import { useI18n, type MessageKey } from "../i18n";

/** Human-readable text for 32-bit key function values, in the current language. */
export function useKeyText() {
  const { t, l } = useI18n();

  function name(value: number): string {
    const described = describeKey(value);
    switch (described.kind) {
      case "known":
        return described.fn.name ? l(described.fn.name) : described.fn.label;
      case "macro": {
        const { mode, repeat, index } = described.macro;
        const how =
          mode === 1 ? t("remap.macroMode1", { n: repeat }) : mode === 2 ? t("remap.macroMode2") : mode === 4 ? t("remap.macroMode4") : "";
        return [t("remap.macro", { n: index + 1 }), how].filter(Boolean).join(" · ");
      }
      default:
        return described.label;
    }
  }

  function category(value: number): string {
    const described = describeKey(value);
    const key: MessageKey =
      described.kind === "known" ? (`category.${described.fn.category satisfies KeyCategory}` as MessageKey) : `category.${described.kind}`;
    return t(key);
  }

  return { name, category };
}
