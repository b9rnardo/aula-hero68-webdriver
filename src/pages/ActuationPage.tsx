import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { LockIcon } from "../components/icons";
import { KeyboardStage, Page, SelectionActions } from "../components/KeyboardStage";
import { SwitchDiagram } from "../components/SwitchDiagram";
import { TravelSlider } from "../components/TravelSlider";
import { Card, cx, Empty, Eyebrow, Notice } from "../components/ui";
import { ApplyRow, MmField, mmDraft, useSavedFlag } from "../components/WriteControls";
import { keyLegend } from "../data/keycodes";
import { POSITIONS } from "../data/layout";
import { ACTUATION_MAX_UM, ACTUATION_MIN_UM } from "../hid/hero68";
import type { KeyboardSnapshot } from "../hid/snapshot";
import { useI18n } from "../i18n";
import { groupBy, spread, useTarget, type Spread } from "../lib/target";
import { canWrite, useDriver } from "../store/driver";
import { useUi } from "../store/ui";
import { DistributionRow, switchTravel } from "./shared";

export function ActuationPage({ snapshot }: { snapshot: KeyboardSnapshot }) {
  const { t, mm, lang } = useI18n();
  const target = useTarget();
  const select = useUi((s) => s.select);
  const valueOf = (pos: number) => snapshot.keys[pos]?.actuationUm;

  const range = spread(target.positions.map(valueOf).filter((v) => v !== undefined));
  const distribution = groupBy(POSITIONS, valueOf);

  return (
    <Page
      title={t("actuation.title")}
      help={t("actuation.help")}
      actions={<SelectionActions />}
      stage={
        <KeyboardStage
          label={t("actuation.title")}
          render={(key) => {
            const um = valueOf(key.pos);
            return { legend: keyLegend(snapshot.layers[0]?.[key.pos] ?? key.defaults[0]), value: um === undefined ? undefined : mm(um) };
          }}
        />
      }
    >
      <div className="grid gap-4">
        {/* Remounts on a new selection, a new read (not a write) or language (decimal separator) so the draft starts fresh. */}
        <ActuationCard key={`${snapshot.readAt}:${lang}:${target.positions.join()}`} snapshot={snapshot} range={range} />

        <Card title={t("dist.title")} description={t("dist.desc")}>
          {distribution.length === 0 ? (
            <Empty>{t("dist.empty")}</Empty>
          ) : (
            <ul className="-mx-3 grid gap-x-8 gap-y-0.5 md:grid-cols-2">
              {distribution.map(([um, positions]) => (
                <DistributionRow
                  key={um}
                  label={`${mm(um)} mm`}
                  count={positions.length}
                  total={POSITIONS.length}
                  onSelect={() => select(positions)}
                />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Page>
  );
}

function ActuationCard({ snapshot, range }: { snapshot: KeyboardSnapshot; range: Spread | null }) {
  const { t, mm } = useI18n();
  const target = useTarget();
  const { source, writing, writable, setActuation } = useDriver(
    useShallow((s) => ({ source: s.source, writing: s.writing, writable: canWrite(s), setActuation: s.setActuation })),
  );

  const travel = switchTravel(snapshot, target.positions);
  const stepUm = snapshot.device.precision?.distance || 10;
  const maxUm = Math.min(travel.travelUm, ACTUATION_MAX_UM);
  const current = range && !range.mixed ? range.min : null;

  const [text, setText] = useState(current === null ? "" : mm(current));
  const [saved, setSaved] = useSavedFlag();
  const { um: draft, invalid } = mmDraft(text, stepUm, ACTUATION_MIN_UM, maxUm);
  const dirty = draft !== null && draft !== current;
  const shown = draft ?? current;

  const edit = (value: string) => {
    setText(value);
    setSaved(false);
  };
  const apply = async () => {
    if (!dirty || writing) return;
    setText(mm(draft));
    setSaved(await setActuation(target.positions, draft));
  };

  const currentText = range
    ? range.mixed
      ? `${t("actuation.mixed")} · ${t("actuation.range", { min: mm(range.min), max: mm(range.max) })}`
      : `${mm(range.min)} mm`
    : t("value.unknown");

  return (
    <Card highlight>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-[auto_minmax(0,1fr)] md:gap-7">
        <div className="flex min-w-0 flex-col">
          <div className="flex min-h-7 flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <Eyebrow className="text-accent">
              {t("actuation.for")} {target.label}
            </Eyebrow>
            <p className="text-sm text-muted">
              {t("actuation.current")} <span className="font-bold text-fg">{currentText}</span>
            </p>
          </div>

          {source === "file" ? (
            <div className="mt-4">
              <Notice icon={<LockIcon size={16} />}>{t("write.connectToWrite")}</Notice>
            </div>
          ) : (
            <form
              className="mt-4"
              onSubmit={(event) => {
                event.preventDefault();
                void apply();
              }}
            >
              <label htmlFor="actuation-value" className="text-sm font-semibold text-fg-2">
                {t("actuation.value")}
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <MmField
                  id="actuation-value"
                  size="md"
                  value={text}
                  invalid={invalid}
                  disabled={!writable || writing}
                  placeholder={range?.mixed ? "—" : undefined}
                  describedBy="actuation-limits"
                  onChange={edit}
                  onBlur={() => draft !== null && setText(mm(draft))}
                />
                <ApplyRow size="md" target={target.label} writing={writing} disabled={!writable || !dirty} saved={saved} demo={source === "demo"} />
              </div>
              <p id="actuation-limits" className={cx("mt-2 text-xs", invalid ? "text-danger" : "text-subtle")}>
                {t("write.limits", { min: mm(ACTUATION_MIN_UM), max: mm(maxUm) })}
              </p>
            </form>
          )}

          <p className="mt-auto pt-4 text-xs text-subtle">
            {travel.estimated
              ? t("actuation.travelEstimated", { mm: mm(travel.travelUm) })
              : `${travel.name} · ${t("actuation.travel", { mm: mm(travel.travelUm) })}`}
          </p>
        </div>

        <figure className="flex flex-col items-center gap-2 rounded-lg bg-panel/70 px-4 pt-3 pb-3 ring-1 ring-line md:order-first">
          <div className="flex max-w-full items-start gap-3 sm:gap-4">
            <SwitchDiagram travelUm={travel.travelUm} valueUm={shown} label={t("actuation.diagram")} />
            <TravelSlider
              travelUm={travel.travelUm}
              minUm={ACTUATION_MIN_UM}
              maxUm={maxUm}
              stepUm={stepUm}
              value={shown}
              range={range}
              disabled={!writable || writing}
              label={t("actuation.title")}
              onChange={(um) => edit(mm(um))}
              onCommit={() => void apply()}
            />
          </div>
          {writable && <figcaption className="text-[11px] text-subtle">{t("actuation.dragHint")}</figcaption>}
        </figure>
      </div>
    </Card>
  );
}
