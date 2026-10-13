import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Icon } from "../components/icons";
import { KeyboardStage } from "../components/KeyboardStage";
import { Button, Card, Chip, cx, Empty, InfoTip, Note, PageBody, Pill, Seg } from "../components/ui";
import { describeKey, KEY_FUNCTIONS, keyLegend, type KeyCategory } from "../data/keycodes";
import { keyByPos, LAYOUT, POSITIONS } from "../data/layout";
import { LAYER_COUNT } from "../hid/hero68";
import type { KeyboardSnapshot } from "../hid/snapshot";
import { useI18n, type MessageKey } from "../i18n";
import { isLayerKey, useKeyNames, useKeyText } from "../lib/keys";
import { byOrder } from "../lib/selection";
import { current } from "../store/draft";
import { useUi } from "../store/ui";
import { useEditor } from "./common";

const rawHex = (value: number) => `0x${(value >>> 0).toString(16).padStart(8, "0")}`;
const LAYERS = Array.from({ length: LAYER_COUNT }, (_, layer) => layer);
const layerName = (layer: number) => `layers.${layer}` as MessageKey;
const CATEGORIES = [...new Set(KEY_FUNCTIONS.map((fn) => fn.category))];
const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
/** Rows shown in the multi-key summary. */
const LIST_MAX = 12;

type Category = KeyCategory | "others";

export function RemapPage({ snapshot }: { snapshot: KeyboardSnapshot }) {
  const { t, l: localize } = useI18n();
  const keyText = useKeyText();
  const names = useKeyNames();
  const { draft, edit, selected, writable } = useEditor();
  const { layer, setLayer, select } = useUi(useShallow((s) => ({ layer: s.layer, setLayer: s.setLayer, select: s.select })));
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("letters");
  const [nudge, setNudge] = useState(false);

  const read = snapshot.layers[layer] !== undefined;
  const def = (l: number, pos: number) => keyByPos.get(pos)!.defaults[l];
  const fnOf = (l: number, pos: number) => current.fn(draft, snapshot, l, pos);
  const saved = (pos: number) => snapshot.layers[layer]?.[pos];
  const keys = [...selected].sort(byOrder).filter((pos) => fnOf(layer, pos) !== undefined);
  const n = keys.length;
  const first = keys[0];
  const pending = n === 1 && first in draft.map[layer];

  const assign = (value: number) => {
    if (!n) return setNudge(true);
    edit("map", (d) => {
      for (const pos of keys) d.map[layer][pos] = value;
    });
  };
  const restore = (l: number, positions: number[]) =>
    edit("map.restore", (d) => {
      for (const pos of positions) d.map[l][pos] = def(l, pos);
    });
  const revert = (positions: number[]) =>
    edit("map.revert", (d) => {
      for (const pos of positions) delete d.map[layer][pos];
    });

  const changed = LAYERS.flatMap((l) =>
    LAYOUT.filter((key) => {
      const value = fnOf(l, key.pos);
      return value !== undefined && (value !== key.defaults[l] || key.pos in draft.map[l]);
    }).map((key) => ({ layer: l, pos: key.pos, value: fnOf(l, key.pos)!, pending: key.pos in draft.map[l] })),
  );
  const changedHere = changed.filter((row) => row.layer === layer).map((row) => row.pos);
  const losesFn = keys.some((pos) => isLayerKey(saved(pos)) && !isLayerKey(fnOf(layer, pos)));
  const isDefault = keys.every((pos) => fnOf(layer, pos) === def(layer, pos));
  const noDraft = !keys.some((pos) => pos in draft.map[layer]);

  // Combos, macros and unknown values in use on this layer, so they can be put back on other keys.
  const others = useMemo(
    () => [...new Set(POSITIONS.map((pos) => current.fn(draft, snapshot, layer, pos)))].filter((value): value is number => value !== undefined && describeKey(value).kind !== "known"),
    [draft, snapshot, layer],
  );
  const words = fold(query).split(/\s+/).filter(Boolean);
  const matches = (text: string) => words.every((word) => fold(text).includes(word));
  const items = words.length
    ? [
        ...KEY_FUNCTIONS.filter((fn) => matches(`${fn.label} ${fn.name?.pt ?? ""} ${fn.name?.en ?? ""}`)).map((fn) => fn.value),
        ...others.filter((value) => matches(`${keyLegend(value)} ${keyText.name(value)}`)),
      ]
    : category === "others"
      ? others
      : KEY_FUNCTIONS.filter((fn) => fn.category === category).map((fn) => fn.value);
  const currentFns = new Set(keys.map((pos) => fnOf(layer, pos)));
  const target = names.list(keys, 4);

  return (
    <>
      <KeyboardStage
        title={t("nav.remap")}
        extra={
          <div className="flex items-center gap-1.5">
            <Seg label={t("remap.layer")} value={layer} onChange={setLayer} options={LAYERS.map((l) => ({ value: l, label: t(layerName(l)) }))} />
            <InfoTip label={t("remap.layerInfoLabel")}>{t("remap.layerInfo")}</InfoTip>
          </div>
        }
        sameValue={(pos) => fnOf(layer, pos)}
        chips={[{ label: t("remap.chipChanged"), positions: changedHere }]}
        legend={
          <span className="legend">
            <span className="font-semibold text-accent-light">Aa</span>
            {t("remap.legendChanged")}
          </span>
        }
        render={(key) => {
          const value = fnOf(layer, key.pos);
          if (value === undefined) return { legend: key.label, dim: true, desc: t("common.notRead") };
          return {
            legend: keyLegend(value),
            alt: value !== key.defaults[layer],
            dirty: key.pos in draft.map[layer],
            desc: keyText.name(value),
          };
        }}
      />
      <PageBody>
        {!read && (
          <div className="mb-4">
            <Empty title={t("common.notReadTitle")}>{t("remap.notRead")}</Empty>
          </div>
        )}
        <div className="grid2">
          <div className="stack">
            <Card
              title={n === 0 ? t("remap.noneTitle") : n === 1 ? t("remap.keyTitle", { name: names.name(first) }) : t("selection.many", { n })}
              sub={n === 1 ? t("remap.factory", { fn: keyText.name(def(layer, first)) }) : undefined}
              aside={<Pill>{t("remap.layerPill", { layer: t(layerName(layer)) })}</Pill>}
            >
              {n === 0 && <Empty title={t("remap.pickKey")} />}
              {n === 1 && (
                <>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex flex-col items-center gap-2">
                      <div className="capk" title={keyText.name(saved(first) ?? def(layer, first))}>
                        {keyLegend(saved(first) ?? def(layer, first))}
                      </div>
                      <span className="cap">{t("remap.onKeyboard")}</span>
                    </div>
                    <Icon name="arrow" className="text-muted" />
                    <div className="flex flex-col items-center gap-2">
                      <div className={cx("capk", pending ? "new" : "ghost")} title={pending ? keyText.name(fnOf(layer, first)!) : undefined}>
                        {pending ? keyLegend(fnOf(layer, first)!) : t("remap.choose")}
                      </div>
                      <span className="cap">{pending ? t("stage.unsavedLegend") : t("remap.newFunction")}</span>
                    </div>
                  </div>
                  <p className="cap mt-3 mb-0">
                    {keyText.name(fnOf(layer, first)!)} · {keyText.category(fnOf(layer, first)!)} · <span className="font-mono">{rawHex(fnOf(layer, first)!)}</span>
                  </p>
                </>
              )}
              {n > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {keys.slice(0, LIST_MAX).map((pos) => (
                    <Pill key={pos}>
                      <span className="font-mono">{names.name(pos)}</span>
                      <span className="text-muted">→</span>
                      {keyLegend(fnOf(layer, pos)!)}
                    </Pill>
                  ))}
                  {n > LIST_MAX && <span className="cap self-center">{t("remap.more", { n: n - LIST_MAX })}</span>}
                </div>
              )}
              {losesFn && (
                <Note tone="bad" className="mt-4">
                  {t("remap.fnWarning")}
                </Note>
              )}
              {n > 0 && (
                <div className="mt-[18px] flex flex-wrap gap-2">
                  <Button sm onClick={() => restore(layer, keys)} disabled={!writable || isDefault}>
                    {t("remap.restore")}
                  </Button>
                  <Button variant="gh" sm onClick={() => revert(keys)} disabled={!writable || noDraft}>
                    {t("remap.revert")}
                  </Button>
                </div>
              )}
            </Card>

            <Card title={t("remap.changedTitle")} info={t("remap.changedInfo")} aside={<Pill className="tabular-nums">{changed.length}</Pill>}>
              {changed.length === 0 ? (
                <p className="cap m-0">{t("remap.noChanged")}</p>
              ) : (
                <div className="max-h-[320px] overflow-auto">
                  {changed.map((row) => (
                    <div key={`${row.layer}:${row.pos}`} className="crow">
                      <Pill>{t(layerName(row.layer))}</Pill>
                      <span className="min-w-0 flex-1">
                        <span className="font-mono">{names.name(row.pos)}</span> <span className="text-muted">→</span>{" "}
                        <strong className="font-semibold">{keyText.name(row.value)}</strong>
                        {row.pending && <span className="chg"> · {t("stage.unsavedLegend").toLowerCase()}</span>}
                      </span>
                      <Button
                        variant="gh"
                        sm
                        onClick={() => {
                          setLayer(row.layer);
                          select([row.pos]);
                        }}
                      >
                        {t("selection.selectOne")}
                      </Button>
                      <Button variant="gh" sm disabled={!writable || row.value === def(row.layer, row.pos)} onClick={() => restore(row.layer, [row.pos])}>
                        {t("remap.restoreOne")}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card title={t("remap.library")} info={t("remap.libraryInfo")} sub={nudge && !n ? <span className="nudge" role="status">{t("remap.nudge")}</span> : undefined}>
            <label className="sfield">
              <Icon name="search" size="s" />
              <span className="sr-only">{t("remap.searchLabel")}</span>
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("remap.search")} />
            </label>
            <div className="cats" role="toolbar" aria-label={t("remap.categories")}>
              {[...CATEGORIES, ...(others.length ? (["others"] as const) : [])].map((id) => (
                <Chip
                  key={id}
                  on={!words.length && category === id}
                  onClick={() => {
                    setCategory(id);
                    setQuery("");
                  }}
                >
                  {t(`category.${id}` as MessageKey)}
                </Chip>
              ))}
            </div>
            <div className="fgrid">
              {items.map((value) => {
                const on = currentFns.size === 1 && currentFns.has(value);
                const fn = describeKey(value);
                const name = fn.kind === "known" && fn.fn.name ? localize(fn.fn.name) : keyText.name(value);
                return (
                  <button
                    key={value}
                    type="button"
                    className={cx("fn", on && "on")}
                    aria-pressed={on}
                    aria-label={name}
                    title={n ? t("remap.put", { fn: name, keys: target }) : t("remap.nudge")}
                    disabled={!writable}
                    onClick={() => assign(value)}
                  >
                    {keyLegend(value)}
                  </button>
                );
              })}
            </div>
            {!items.length && <p className="cap mt-3.5 mb-0">{t("remap.noResults")}</p>}
          </Card>
        </div>
      </PageBody>
    </>
  );
}
