import { useMemo, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import type { KeyCap } from "../components/KeyboardStage";
import { cx, Swatch } from "../components/ui";
import { keyLegend } from "../data/keycodes";
import type { LayoutKey } from "../data/layout";
import { switchById } from "../data/switches";
import type { KeyboardSnapshot } from "../hid/snapshot";
import { useI18n, type MessageKey } from "../i18n";
import { sameSet } from "../lib/selection";
import { groupBy } from "../lib/target";
import { current, useDraft, type Draft } from "../store/draft";
import { canWrite, useDriver } from "../store/driver";
import { useUi } from "../store/ui";

// Shared by the editing pages: the draft, the selection and per-key facts.

/** Fallback when the switch type was not read: the longest travel in the catalog. */
export const DEFAULT_TRAVEL_UM = 4000;

/** Switch of a key; with a draft, also one picked but not written yet. */
const typeOf = (snapshot: KeyboardSnapshot, pos: number, draft?: Draft) =>
  draft ? current.sw(draft, snapshot, pos) : snapshot.keys[pos]?.switchType;

export const travelOf = (snapshot: KeyboardSnapshot, pos: number, draft?: Draft) =>
  switchById.get(typeOf(snapshot, pos, draft) ?? -1)?.travelUm ?? DEFAULT_TRAVEL_UM;

/** Total travel of the most common switch among the keys, or an estimate. */
export function switchTravel(snapshot: KeyboardSnapshot, positions: number[], draft?: Draft) {
  const groups = groupBy(positions, (pos) => typeOf(snapshot, pos, draft)).sort((a, b) => b[1].length - a[1].length);
  const sw = groups.length ? switchById.get(groups[0][0]) : undefined;
  return sw ? { travelUm: sw.travelUm, name: sw.name, estimated: false } : { travelUm: DEFAULT_TRAVEL_UM, name: null, estimated: true };
}

/** Smallest step the keyboard stores, in µm. */
export const stepOf = (snapshot: KeyboardSnapshot) => snapshot.device.precision?.distance || 10;

/** Draft, selection and write access for an editing page. */
export function useEditor() {
  const { draft, edit } = useDraft(useShallow((s) => ({ draft: s.draft, edit: s.edit })));
  const selected = useUi((s) => s.selected);
  const driverReady = useDriver((s) => canWrite(s) && !s.writing);
  const saving = useDraft((s) => !!s.saving);
  const writable = driverReady && !saving;
  return { draft, edit, selected, writable };
}

/** Legend of a key on the base layer, following remaps (also unsaved ones). */
export function useLegend(snapshot: KeyboardSnapshot) {
  const draft = useDraft((s) => s.draft);
  return (key: LayoutKey) => keyLegend(current.fn(draft, snapshot, 0, key.pos) ?? key.defaults[0]);
}

export type CapRender = (key: LayoutKey) => KeyCap;

/** Name of a read step: "keymap.1" → "Mapeamento · Fn". */
export function useStepLabel() {
  const { t } = useI18n();
  return (id: string) => {
    const [step, layer] = id.split(".");
    return t(`progress.step.${step}` as MessageKey) + (layer ? ` · ${t(`layers.${layer}` as MessageKey)}` : "");
  };
}

/** "N teclas" pill text for the selection. */
export function useCount() {
  const { t } = useI18n();
  return (n: number) => (n === 1 ? t("target.key") : t("target.keys", { n }));
}

/** "Values in use": one row per value; a click selects the keys with it. */
export function ValueRows<T extends string | number>({
  positions,
  valueOf,
  render,
  swatch,
  label,
}: {
  positions: number[];
  valueOf: (pos: number) => T | undefined;
  render: (value: T) => ReactNode;
  swatch?: (value: T) => string | undefined;
  /** Accessible name of a row. */
  label: (value: T, count: number) => string;
}) {
  const count = useCount();
  const { selected, select } = useUi(useShallow((s) => ({ selected: s.selected, select: s.select })));
  const groups = useMemo(() => groupBy(positions, valueOf), [positions, valueOf]);
  return (
    <div className="flex flex-col gap-0.5">
      {groups.map(([value, keys]) => (
        <button key={String(value)} type="button" className={cx("row", sameSet(selected, keys) && "on")} onClick={() => select(keys)} aria-label={label(value, keys.length)}>
          {swatch && <Swatch color={swatch(value) ?? "var(--color-key)"} />}
          <span className="font-mono tabular-nums">{render(value)}</span>
          <span className="flex-1" />
          <span className="cap">{count(keys.length)}</span>
        </button>
      ))}
    </div>
  );
}
