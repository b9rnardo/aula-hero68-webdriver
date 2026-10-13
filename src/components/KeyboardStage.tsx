import { useMemo, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import type { LayoutKey } from "../data/layout";
import { LAYER_COUNT } from "../hid/hero68";
import { useI18n, type MessageKey } from "../i18n";
import { useUi } from "../store/ui";
import { KeyboardView, type KeyCap } from "./KeyboardView";
import { Button, cx, SectionHeader } from "./ui";

const LAYER_NAMES: MessageKey[] = ["layers.0", "layers.1", "layers.2"];

function LayersPanel({ vertical }: { vertical?: boolean }) {
  const { t } = useI18n();
  const { layer, setLayer } = useUi(useShallow((s) => ({ layer: s.layer, setLayer: s.setLayer })));
  return (
    <div className={vertical ? "w-44 shrink-0" : ""}>
      <p className="eyebrow mb-2 flex items-center gap-1.5 text-muted" title={t("layers.help")}>
        {t("layers.title")}
      </p>
      <div role="radiogroup" aria-label={t("layers.title")} className={cx("gap-1", vertical ? "flex flex-col" : "flex flex-wrap")}>
        {Array.from({ length: LAYER_COUNT }, (_, index) => (
          <button
            key={index}
            type="button"
            role="radio"
            aria-checked={layer === index}
            onClick={() => setLayer(index)}
            className={cx(
              "rounded-md px-3 py-1.5 text-left text-sm font-semibold transition-colors",
              layer === index ? "bg-active text-fg" : "text-muted hover:bg-hover hover:text-fg",
            )}
          >
            {t(LAYER_NAMES[index])}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The keyboard at the top of a page, with the layer list and the selection count. */
export function KeyboardStage({ render, label, layers }: { render: (key: LayoutKey) => KeyCap; label: string; layers?: boolean }) {
  const { t } = useI18n();
  const { selected, select } = useUi(useShallow((s) => ({ selected: s.selected, select: s.select })));
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const count = selected.length;

  return (
    <section className="rounded-lg bg-panel p-4 sm:p-5">
      {layers && (
        <div className="mb-4 xl:hidden">
          <LayersPanel />
        </div>
      )}
      <div className="flex gap-6">
        {layers && (
          <div className="hidden xl:block">
            <LayersPanel vertical />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <KeyboardView render={render} label={label} selected={selectedSet} onSelect={select} />
          <p aria-live="polite" className={cx("mt-3 text-center", count ? "eyebrow text-sm text-accent" : "text-sm text-subtle")}>
            {count === 0 ? t("selection.hint") : count === 1 ? t("selection.one") : t("selection.count", { n: count })}
          </p>
        </div>
      </div>
    </section>
  );
}

export function SelectionActions() {
  const { t } = useI18n();
  const { count, selectAll, clear } = useUi(useShallow((s) => ({ count: s.selected.length, selectAll: s.selectAll, clear: s.clear })));
  return (
    <>
      <Button variant="secondary" size="sm" onClick={selectAll}>
        {t("action.selectAll")}
      </Button>
      <Button variant="ghost" size="sm" onClick={clear} disabled={count === 0}>
        {t("action.clearSelection")}
      </Button>
    </>
  );
}

/**
 * Page frame: optional keyboard stage (sticky on tall desktop screens, like Wootility),
 * then the section heading and the cards.
 */
export function Page({
  stage,
  title,
  help,
  actions,
  children,
}: {
  stage?: ReactNode;
  title: ReactNode;
  help?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      {stage && (
        <div className="z-10 bg-app pt-4 pb-6 sm:pt-6 lg:[@media(min-height:860px)]:sticky lg:[@media(min-height:860px)]:top-0">
          {stage}
        </div>
      )}
      <div className={cx("pb-12", !stage && "pt-6")}>
        <SectionHeader title={title} help={help} actions={actions} />
        {children}
      </div>
    </>
  );
}
