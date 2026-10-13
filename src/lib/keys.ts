import { describeKey, type KeyCategory } from "../data/keycodes";
import { keyByPos } from "../data/layout";
import { useI18n, type MessageKey } from "../i18n";
import { byOrder } from "./selection";

/** Fn and Fn2: the keys that reach the other layers. */
export const isLayerKey = (value: number | undefined) => value !== undefined && value >>> 24 === 0x0d;

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

/** Names of physical keys ("W", "Espaço") and short lists of them. */
export function useKeyNames() {
  const { t } = useI18n();
  const name = (pos: number) => keyByPos.get(pos)?.label || t("key.space");
  /** "W, A, S e mais 3", in keyboard order. */
  const list = (positions: number[], max = 8) => {
    const names = [...positions].sort(byOrder).map(name);
    return names.length > max ? t("list.more", { list: names.slice(0, max).join(", "), n: names.length - max }) : names.join(", ");
  };
  return { name, list };
}
