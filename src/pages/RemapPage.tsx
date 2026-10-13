import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { KeyboardStage, Page, SelectionActions } from "../components/KeyboardStage";
import { LockIcon, SearchIcon, WarnIcon } from "../components/icons";
import { Badge, Button, Card, cx, Empty, Notice, Row } from "../components/ui";
import { ApplyRow, SavedNote, useSavedFlag } from "../components/WriteControls";
import { describeKey, KEY_FUNCTIONS, keyLegend, type KeyCategory } from "../data/keycodes";
import { keyByPos, LAYOUT, POSITIONS } from "../data/layout";
import type { KeyboardSnapshot } from "../hid/snapshot";
import { useI18n, type MessageKey } from "../i18n";
import { useKeyText } from "../lib/keys";
import { groupBy, useTarget } from "../lib/target";
import { canWrite, useDriver } from "../store/driver";
import { useUi } from "../store/ui";

const rawHex = (value: number) => `0x${(value >>> 0).toString(16).padStart(8, "0")}`;
const keyName = (pos: number) => keyByPos.get(pos)?.label || "Space";
/** Fn and Fn2: the keys that reach the other layers. */
const isLayerKey = (value: number | undefined) => value !== undefined && value >>> 24 === 0x0d;

function Chip({
  legend,
  title,
  count,
  picked,
  assigning,
  onClick,
}: {
  legend: string;
  title: string;
  count: number;
  /** The function chosen for the selected keys. */
  picked: boolean;
  /** Clicks choose a function for the selection instead of finding the keys that use it. */
  assigning: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={!assigning && count === 0}
      aria-pressed={assigning ? picked : undefined}
      className={cx(
        "flex min-w-10 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-semibold ring-1 transition-colors",
        picked
          ? "bg-accent text-accent-ink ring-accent"
          : count
            ? "bg-[#3b2c63] text-fg ring-accent/45 hover:ring-accent"
            : cx("bg-key text-muted ring-key-line", assigning ? "hover:text-fg hover:ring-accent" : "disabled:cursor-default"),
      )}
    >
      {legend}
      {count > 0 && <span className={cx("text-[11px] font-bold", picked ? "text-accent-ink" : "text-accent")}>{count}</span>}
    </button>
  );
}

export function RemapPage({ snapshot }: { snapshot: KeyboardSnapshot }) {
  const { t, l } = useI18n();
  const keyText = useKeyText();
  const { layer, selected, select } = useUi(useShallow((s) => ({ layer: s.layer, selected: s.selected, select: s.select })));
  const { source, writing, writable, setKeymap } = useDriver(
    useShallow((s) => ({ source: s.source, writing: s.writing, writable: canWrite(s), setKeymap: s.setKeymap })),
  );
  const target = useTarget();
  const [query, setQuery] = useState("");

  // The function picked in the library, for this layer and selection only.
  const context = `${layer}:${selected.join()}`;
  const [draft, setDraft] = useState<{ context: string; value: number } | null>(null);
  const pending = draft?.context === context ? draft.value : null;
  const [saved, setSaved] = useSavedFlag();
  const [savedContext, setSavedContext] = useState("");

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

  const editable = source !== "file" && map !== undefined;
  const assigning = editable && selected.length > 0;
  const disabled = !writable || writing;
  const notDefault = selected.filter((pos) => {
    const value = valueOf(pos);
    return value !== undefined && value !== keyByPos.get(pos)?.defaults[layer];
  });
  const unchanged = pending !== null && selected.every((pos) => valueOf(pos) === pending);
  const losesFn = pending !== null && !isLayerKey(pending) && selected.some((pos) => isLayerKey(valueOf(pos)));

  const write = async (keys: { pos: number; code: number }[]) => {
    if (disabled || !keys.length) return;
    const ok = await setKeymap(layer, keys);
    if (ok) setDraft(null);
    setSavedContext(context);
    setSaved(ok);
  };
  const apply = () => pending !== null && write(selected.map((pos) => ({ pos, code: pending })));
  const restore = () => write(notDefault.map((pos) => ({ pos, code: keyByPos.get(pos)!.defaults[layer] })));
  const pick = (value: number) => (assigning ? setDraft({ context, value }) : select(usage.get(value) ?? []));

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
      {/* Selected key and the function picker side by side, so the apply button is next to the list. */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="grid gap-4">
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
                {source === "file" && (
                  <div className="mt-4">
                    <Notice icon={<LockIcon size={16} />}>{t("write.connectToWrite")}</Notice>
                  </div>
                )}
                {assigning && (
                  <div className="mt-4 border-t border-line pt-4">
                    {pending === null ? (
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                        {saved && savedContext === context ? (
                          <SavedNote demo={source === "demo"} />
                        ) : (
                          <p className="text-sm text-muted">{t("remap.pickHint", { target: target.label })}</p>
                        )}
                        {notDefault.length > 0 && (
                          <Button size="sm" disabled={disabled} onClick={() => void restore()}>
                            {t("remap.restore")}
                          </Button>
                        )}
                      </div>
                    ) : (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          void apply();
                        }}
                      >
                        <p className="eyebrow mb-2 text-accent">{t("remap.newFunction", { layer: t(`layers.${layer}` as MessageKey) })}</p>
                        <div className="mb-4 flex items-center gap-3">
                          <span className="grid h-11 min-w-11 place-items-center rounded-md bg-accent px-3 font-bold text-accent-ink">
                            {keyLegend(pending)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-lg leading-tight font-bold">{keyText.name(pending)}</p>
                            <p className="text-sm text-muted">{keyText.category(pending)}</p>
                          </div>
                        </div>
                        {losesFn && (
                          <div className="mb-4">
                            <Notice tone="warn" icon={<WarnIcon size={16} />}>
                              {t("remap.fnWarning")}
                            </Notice>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                          <ApplyRow size="md" target={target.label} writing={writing} disabled={disabled || unchanged} saved={false} demo={source === "demo"} />
                          <Button variant="ghost" disabled={writing} onClick={() => setDraft(null)}>
                            {t("remap.cancel")}
                          </Button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </>
            )}
          </Card>

          <Card
            title={t("remap.changedTitle")}
            actions={
              changed.length > 0 ? (
                <Button size="sm" variant="ghost" onClick={() => select(changed.map((key) => key.pos))}>
                  {t("remap.selectChanged")}
                </Button>
              ) : (
                <Badge>0</Badge>
              )
            }
            description={t("remap.changedCount", { n: changed.length })}
          >
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
        </div>

        <Card
          title={t("remap.library")}
          description={assigning ? t("remap.libraryAssign", { target: target.label }) : t("remap.libraryDesc")}
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
                        picked={pending === value}
                        assigning={assigning}
                        onClick={() => pick(value)}
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
                        picked={pending === fn.value}
                        assigning={assigning}
                        onClick={() => pick(fn.value)}
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
