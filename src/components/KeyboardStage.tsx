import { useEffect, useMemo, useRef, type MouseEvent, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { LAYOUT, LAYOUT_HEIGHT, LAYOUT_WIDTH, type LayoutKey } from "../data/layout";
import { useI18n } from "../i18n";
import { useKeyNames } from "../lib/keys";
import { ALL, LETTERS, ORDER, sameSet, WASD } from "../lib/selection";
import { useUi } from "../store/ui";
import { Chip, cx, InfoTip, Kbd, Switch, Button } from "./ui";

/** What a key shows on the stage. */
export interface KeyCap {
  legend: string;
  /** Second line: the key's value on this page. Hidden when "Values" is off. */
  value?: string;
  /** Background tint encoding the value. */
  bg?: string;
  /** Legend in violet: the key does something else than its print (remap). */
  alt?: boolean;
  /** Has an unsaved change. */
  dirty?: boolean;
  dim?: boolean;
  /** Live travel: how far the key is down, 0–1, drawn as a fill from the top. */
  fill?: number;
  /** Live travel: the keyboard counts the key as pressed. */
  hot?: boolean;
  /** Marked like a selected key when the stage picks instead of selecting. */
  on?: boolean;
  /** Spoken value, for the key's accessible name. */
  desc: string;
}

export interface QuickChip {
  label: string;
  positions: number[];
}

// Tints are mixed from the key color toward a hue, so the value reads at a glance.
const KEY_RGB = [35, 30, 46];
const VIOLET = [164, 139, 255];
const STEEL = [92, 110, 150];
export const mixColor = (color: number[], alpha: number) =>
  `rgb(${KEY_RGB.map((base, i) => Math.round(base + (color[i] - base) * alpha)).join(", ")})`;
/** Actuation: violet when more sensitive than 1 mm, steel when firmer. */
export function actTint(um: number) {
  const v = um / 1000;
  if (v < 1) return mixColor(VIOLET, ((1 - v) / 0.9) * 0.42);
  if (v > 1) return mixColor(STEEL, Math.min(1, (v - 1) / 3) * 0.55 + 0.08);
  return undefined;
}
/** Rapid Trigger on: stronger violet for more sensitive presses. */
export const rtTint = (pressUm: number) => mixColor(VIOLET, 0.16 + (1 - Math.min(pressUm / 1000, 1)) * 0.24);
export const hexRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/**
 * The sticky keyboard at the top of editing pages: page title, quick selections, the keys and the
 * selection summary. Click selects, drag paints, Shift + click adds a range, double click picks every
 * key with the same value. With `pick`, a click only picks that key and the selection tools are hidden.
 */
export function KeyboardStage({
  title,
  extra,
  render,
  sameValue,
  chips = [],
  legend,
  values,
  pick,
  status,
}: {
  title: string;
  /** Next to the title: layer or mode switcher. */
  extra?: ReactNode;
  render: (key: LayoutKey) => KeyCap;
  /** Value compared on double click. */
  sameValue?: (pos: number) => string | number | undefined;
  /** Page-specific quick selections, after Letters. */
  chips?: QuickChip[];
  legend?: ReactNode;
  /** Offer the "Values" switch. */
  values?: boolean;
  /** Clicking a key calls this instead of selecting it (live travel). */
  pick?: (pos: number) => void;
  /** Replaces the selection summary while picking. */
  status?: string;
}) {
  const { t } = useI18n();
  const names = useKeyNames();
  const { selected, select, showValues, setShowValues } = useUi(
    useShallow((s) => ({ selected: s.selected, select: s.select, showValues: s.showValues, setShowValues: s.setShowValues })),
  );
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const drag = useRef<{ add: boolean; start: number } | null>(null);
  const moved = useRef(false);

  useEffect(() => {
    const end = () => {
      drag.current = null;
      setTimeout(() => (moved.current = false), 0);
    };
    window.addEventListener("mouseup", end);
    return () => window.removeEventListener("mouseup", end);
  }, []);

  const paint = (pos: number) => {
    const current = drag.current;
    if (!current) return;
    moved.current = true;
    select([current.start, pos], current.add ? "add" : "remove");
  };

  const click = (pos: number, event: MouseEvent) => {
    if (moved.current) {
      moved.current = false;
      return;
    }
    const { anchor, setAnchor, toggle } = useUi.getState();
    if (event.shiftKey && anchor !== null) {
      const [a, b] = [ORDER.get(anchor)!, ORDER.get(pos)!].sort((x, y) => x - y);
      select(
        LAYOUT.slice(a, b + 1).map((key) => key.pos),
        "add",
      );
    } else toggle(pos);
    setAnchor(pos);
  };

  const pickSame = (pos: number) => {
    if (!sameValue) return;
    const value = sameValue(pos);
    if (value === undefined) return;
    select(ALL.filter((p) => sameValue(p) === value));
  };

  const quick: QuickChip[] = [
    { label: t("selection.all"), positions: ALL },
    { label: "W A S D", positions: WASD },
    { label: t("selection.letters"), positions: LETTERS },
    ...chips,
  ];

  const n = selected.length;
  const summary =
    n === 0
      ? t("selection.none")
      : n === ALL.length
        ? t("selection.everything", { n })
        : `${t(n === 1 ? "selection.one" : "selection.many", { n })}: ${names.list(selected, 10)}`;

  return (
    <section className="stage" aria-label={t("stage.label")}>
      <div className="page-wrap">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3.5">
            <h1 className="h1 s">{title}</h1>
            {extra}
          </div>
          {!pick && (
          <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label={t("selection.quick")}>
            <span className="cap hide-s mr-0.5">{t("selection.select")}</span>
            {quick.map((chip) => (
              <Chip
                key={chip.label}
                on={chip.positions.length > 0 && sameSet(selected, chip.positions)}
                disabled={chip.positions.length === 0}
                onClick={() => select(chip.positions)}
              >
                {chip.label}
              </Chip>
            ))}
            <Chip on={false} onClick={() => select(ALL.filter((pos) => !selectedSet.has(pos)))}>
              {t("selection.invert")}
            </Chip>
            <Button variant="gh" sm onClick={() => useUi.getState().clear()} disabled={n === 0}>
              {t("selection.clear")} <Kbd>Esc</Kbd>
            </Button>
          </div>
          )}
        </div>

        <div className="plate">
          <div className="kb" role="group" aria-label={t("stage.keys")} style={{ aspectRatio: `${LAYOUT_WIDTH} / ${LAYOUT_HEIGHT}` }}>
            {LAYOUT.map((key) => {
              const cap = render(key);
              const on = pick ? !!cap.on : selectedSet.has(key.pos);
              return (
                <div
                  key={key.pos}
                  className="kw"
                  style={{
                    left: `${(key.x / LAYOUT_WIDTH) * 100}%`,
                    top: `${(key.y / LAYOUT_HEIGHT) * 100}%`,
                    width: `${(key.w / LAYOUT_WIDTH) * 100}%`,
                    height: `${(key.h / LAYOUT_HEIGHT) * 100}%`,
                  }}
                >
                  <button
                    type="button"
                    className={cx("key", on && "sel", cap.alt && "alt", cap.dim && "dim", cap.fill !== undefined && "lv", cap.hot && "hot")}
                    style={cap.bg ? { backgroundColor: cap.bg } : undefined}
                    aria-pressed={on}
                    aria-label={`${names.name(key.pos)}, ${cap.desc}${cap.dirty ? `, ${t("stage.unsaved")}` : ""}`}
                    onMouseDown={(event) => {
                      if (event.button !== 0 || pick) return;
                      drag.current = { add: !on, start: key.pos };
                      moved.current = false;
                    }}
                    onMouseEnter={() => paint(key.pos)}
                    onClick={(event) => (pick ? pick(key.pos) : click(key.pos, event))}
                    onDoubleClick={() => !pick && pickSame(key.pos)}
                  >
                    {!!cap.fill && <span className="kfill" style={{ height: `${Math.min(cap.fill, 1) * 100}%` }} />}
                    <span className="lg">{cap.legend}</span>
                    <span className="vl">{values && !showValues ? "" : cap.value}</span>
                    {cap.dirty && <span className="dot" aria-hidden="true" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mx-auto flex max-w-[740px] flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="ttl">
            {!pick && <InfoTip label={t("selection.howLabel")}>{t("selection.how")}</InfoTip>}
            <p className="selt" role="status" aria-live="polite">
              {pick ? status : summary}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {legend}
            {!pick && (
              <span className="legend">
                <span className="ldot" />
                {t("stage.unsavedLegend")}
              </span>
            )}
            {values && (
              <span className="legend">
                {t("stage.values")}
                <Switch on={showValues} onChange={setShowValues} label={t("stage.valuesLabel")} />
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
