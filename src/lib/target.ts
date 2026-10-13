import { useMemo } from "react";
import { POSITIONS } from "../data/layout";
import { useI18n } from "../i18n";
import { useUi } from "../store/ui";

/** The keys a page summarizes: the selection, or every key when nothing is selected. */
export function useTarget() {
  const { t, lang } = useI18n();
  const selected = useUi((s) => s.selected);
  return useMemo(() => {
    const positions = selected.length ? selected : POSITIONS;
    return {
      positions,
      count: positions.length,
      isSelection: selected.length > 0,
      label: positions.length === 1 ? t("target.key") : t("target.keys", { n: positions.length }),
    };
    // t changes with lang only.
  }, [selected, lang]);
}

export interface Spread {
  min: number;
  max: number;
  mixed: boolean;
}

export function spread(values: number[]): Spread | null {
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max, mixed: min !== max };
}

/** Groups positions by a value, sorted by value. Positions with no value are skipped. */
export function groupBy<T extends number | string>(positions: number[], valueOf: (pos: number) => T | undefined) {
  const groups = new Map<T, number[]>();
  for (const pos of positions) {
    const value = valueOf(pos);
    if (value === undefined) continue;
    groups.set(value, [...(groups.get(value) ?? []), pos]);
  }
  return [...groups.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

export const hex = ({ r, g, b }: { r: number; g: number; b: number }) =>
  "#" + [r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("");

/**
 * Screen color for an LED value. The firmware stores the LED drive level, so a stored (25, 24, 25)
 * still lights up white; scaling to full intensity shows the hue the user actually sees. Off stays black.
 */
export function ledHex({ r, g, b }: { r: number; g: number; b: number }) {
  const max = Math.max(r, g, b);
  if (max === 0) return "#000000";
  const scale = (value: number) => Math.round((value * 255) / max);
  return hex({ r: scale(r), g: scale(g), b: scale(b) });
}
