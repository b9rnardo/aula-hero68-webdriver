import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { KeyboardStage, Page, SelectionActions } from "../components/KeyboardStage";
import { SearchIcon } from "../components/icons";
import { Badge, Card, cx, Empty, Row } from "../components/ui";
import { describeKey, KEY_FUNCTIONS, keyLegend, type KeyCategory } from "../data/keycodes";
import { keyByPos, LAYOUT, POSITIONS } from "../data/layout";
import type { KeyboardSnapshot } from "../hid/snapshot";
import { useI18n, type MessageKey } from "../i18n";
import { useKeyText } from "../lib/keys";
import { groupBy } from "../lib/target";
import { useUi } from "../store/ui";

const rawHex = (value: number) => `0x${(value >>> 0).toString(16).padStart(8, "0")}`;
const keyName = (pos: number) => keyByPos.get(pos)?.label || "Space";

function Chip({ legend, title, count, onClick }: { legend: string; title: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={count === 0}
      className={cx(
        "flex min-w-10 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-semibold ring-1 transition-colors",
        count ? "bg-[#3b2c63] text-fg ring-accent/45 hover:ring-accent" : "bg-key text-muted ring-key-line disabled:cursor-default",
      )}
    >
      {legend}
      {count > 0 && <span className="text-[11px] font-bold text-accent">{count}</span>}
    </button>
  );
}

export function RemapPage({ snapshot }: { snapshot: KeyboardSnapshot }) {
  const { t, l } = useI18n();
  const keyText = useKeyText();
  const { layer, selected, select } = useUi(useShallow((s) => ({ layer: s.layer, selected: s.selected, select: s.select })));
  const [query, setQuery] = useState("");

  const map = snapshot.layers[layer];
  const valueOf = (pos: number) => map?.[pos];
  const changed = LAYOUT.filter((key) => map?.[key.pos] !== undefined && map[key.pos] !== key.defaults[layer]);
  const usage = useMemo(() => new Map(groupBy(POSITIONS, (pos) => map?.[pos])), [map]);
  const focus = selected.length ? selected[selected.length - 1] : null;

  const library = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = KEY_FUNCTIONS.filter(
      (fn) =>
        !needle ||
        fn.label.toLowerCase().includes(needle) ||
        fn.name?.pt.toLowerCase().includes(needle) ||
        fn.name?.en.toLowerCase().includes(needle),
    );
    const byCategory = new Map<KeyCategory, typeof matches>();
    for (const fn of matches) byCategory.set(fn.category, [...(byCategory.get(fn.category) ?? []), fn]);
    // Combos, macros and unknown values used on this layer.
    const others = [...usage.keys()].filter((value) => describeKey(value).kind !== "known" && (!needle || keyLegend(value).toLowerCase().includes(needle)));
    return { byCategory: [...byCategory.entries()], others };
  }, [query, usage]);

  const focusValue = focus === null ? undefined : valueOf(focus);
  const focusDefault = focus === null ? undefined : keyByPos.get(focus)?.defaults[layer];

  return (
    <Page
      title={t("remap.title")}
      help={t("remap.help")}
      actions={<SelectionActions />}
      stage={
        <KeyboardStage
          layers
          label={t("remap.title")}
          render={(key) => {
            const value = valueOf(key.pos);
            if (value === undefined) return { legend: key.label, tone: "dim" };
            return { legend: keyLegend(value), tone: value !== key.defaults[layer] ? "marked" : "default" };
          }}
        />
      }
    >
      {!map && (
        <div className="mb-4">
          <Empty>{t("remap.notRead")}</Empty>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("remap.selected")} highlight>
          {focus === null || focusValue === undefined ? (
            <Empty>{t("remap.selectHint")}</Empty>
          ) : (
            <>
              <div className="mb-4 flex items-center gap-4">
                <span className="grid h-14 min-w-14 place-items-center rounded-md bg-key px-3 text-lg font-bold ring-2 ring-accent">
                  {keyLegend(focusValue)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-2xl leading-tight font-bold">{keyText.name(focusValue)}</p>
                  <p className="text-sm text-muted">{keyText.category(focusValue)}</p>
                </div>
                {focusValue !== focusDefault && (
                  <span className="ml-auto">
                    <Badge tone="accent">{t("remap.changed")}</Badge>
                  </span>
                )}
              </div>
              <dl>
                <Row label={t("remap.default")}>{focusDefault === undefined ? t("value.unknown") : keyText.name(focusDefault)}</Row>
                <Row label={t("remap.position")}>
                  {keyName(focus)} · #{focus}
                </Row>
                <Row label={t("remap.value")} mono>
                  {rawHex(focusValue)}
                </Row>
              </dl>
              {selected.length > 1 && (
                <p className="mt-3 text-xs text-subtle">{t("selection.count", { n: selected.length })}</p>
              )}
            </>
          )}
        </Card>

        <Card title={t("remap.changedTitle")} actions={<Badge>{changed.length}</Badge>} description={t("remap.changedCount", { n: changed.length })}>
          {changed.length > 0 && (
            <ul className="-mx-3 max-h-64 space-y-0.5 overflow-y-auto">
              {changed.map((key) => (
                <li key={key.pos}>
                  <button
                    type="button"
                    onClick={() => select([key.pos])}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-hover"
                  >
                    <span className="w-20 shrink-0 font-bold">{keyName(key.pos)}</span>
                    <span className="text-subtle">→</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{keyText.name(map![key.pos])}</span>
                    <span className="hidden text-xs text-subtle sm:inline">{keyText.name(key.defaults[layer])}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title={t("remap.library")}
          description={t("remap.libraryDesc")}
          className="lg:col-span-2"
          actions={
            <label className="flex h-9 w-full max-w-64 items-center gap-2 rounded-md bg-field px-3 text-muted ring-1 ring-line focus-within:ring-accent">
              <SearchIcon size={16} />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("remap.search")}
                aria-label={t("remap.search")}
                className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
              />
            </label>
          }
        >
          {library.byCategory.length === 0 && library.others.length === 0 ? (
            <Empty>{t("remap.noResults")}</Empty>
          ) : (
            <div className="max-h-[440px] space-y-5 overflow-y-auto pr-1">
              {library.others.length > 0 && (
                <section>
                  <p className="eyebrow mb-2 text-subtle">{t("category.combo")} / {t("category.macro")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {library.others.map((value) => (
                      <Chip
                        key={value}
                        legend={keyLegend(value)}
                        title={keyText.name(value)}
                        count={usage.get(value)?.length ?? 0}
                        onClick={() => select(usage.get(value) ?? [])}
                      />
                    ))}
                  </div>
                </section>
              )}
              {library.byCategory.map(([category, functions]) => (
                <section key={category}>
                  <p className="eyebrow mb-2 text-subtle">{t(`category.${category}` as MessageKey)}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {functions.map((fn) => (
                      <Chip
                        key={fn.value}
                        legend={fn.label}
                        title={fn.name ? l(fn.name) : fn.label}
                        count={usage.get(fn.value)?.length ?? 0}
                        onClick={() => select(usage.get(fn.value) ?? [])}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
}
