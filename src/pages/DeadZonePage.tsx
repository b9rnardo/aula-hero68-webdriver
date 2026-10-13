import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { DeadZoneChart } from "../components/DeadZoneChart";
import { LockIcon } from "../components/icons";
import { KeyboardStage, Page, SelectionActions } from "../components/KeyboardStage";
import { Card, cx, Empty, Eyebrow, Notice } from "../components/ui";
import { ApplyRow, mmDraft, MmSliderField, Toggle, useSavedFlag } from "../components/WriteControls";
import { keyLegend } from "../data/keycodes";
import { POSITIONS } from "../data/layout";
import { DEAD_ZONE_MAX_UM } from "../hid/hero68";
import type { KeyboardSnapshot, KeySnapshot } from "../hid/snapshot";
import { useI18n } from "../i18n";
import { groupBy, spread, useTarget, type Spread } from "../lib/target";
import { canWrite, useDriver } from "../store/driver";
import { useUi } from "../store/ui";
import { commonActuation, DistributionRow, switchTravel } from "./shared";

type DeadZone = NonNullable<KeySnapshot["deadZone"]>;

/** Sortable group key: off first, then by top and bottom zone. */
const groupKey = ({ enabled, topUm, bottomUm }: DeadZone) =>
  enabled ? `1:${String(topUm).padStart(5, "0")}:${String(bottomUm).padStart(5, "0")}` : "0";

export function DeadZonePage({ snapshot }: { snapshot: KeyboardSnapshot }) {
  const { t, mm, lang } = useI18n();
  const target = useTarget();
  const select = useUi((s) => s.select);
  const dz = (pos: number) => snapshot.keys[pos]?.deadZone;
  const distribution = groupBy(POSITIONS, (pos) => {
    const value = dz(pos);
    return value && groupKey(value);
  });

  return (
    <Page
      title={t("dz.title")}
      help={t("dz.help")}
      actions={<SelectionActions />}
      stage={
        <KeyboardStage
          label={t("dz.title")}
          render={(key) => {
            const value = dz(key.pos);
            return {
              legend: keyLegend(snapshot.layers[0]?.[key.pos] ?? key.defaults[0]),
              value: value?.enabled ? mm(value.topUm) : undefined,
              tone: value?.enabled ? "marked" : "default",
            };
          }}
        />
      }
    >
      <div className="grid gap-4">
        {/* Remounts on a new selection, a new read (not a write) or language (decimal separator) so the draft starts fresh. */}
        <DeadZoneCard key={`${snapshot.readAt}:${lang}:${target.positions.join()}`} snapshot={snapshot} />

        <Card title={t("dist.title")} description={t("dist.desc")}>
          {distribution.length === 0 ? (
            <Empty>{t("dist.empty")}</Empty>
          ) : (
            <ul className="-mx-3 grid gap-x-8 gap-y-0.5 md:grid-cols-2">
              {distribution.map(([key, positions]) => {
                const value = dz(positions[0])!;
                return (
                  <DistributionRow
                    key={key}
                    label={value.enabled ? `${mm(value.topUm)} / ${mm(value.bottomUm)}` : t("dz.off")}
                    count={positions.length}
                    total={POSITIONS.length}
                    onSelect={() => select(positions)}
                  />
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </Page>
  );
}

function DeadZoneCard({ snapshot }: { snapshot: KeyboardSnapshot }) {
  const { t, mm } = useI18n();
  const target = useTarget();
  const { source, writing, writable, setDeadZones } = useDriver(
    useShallow((s) => ({ source: s.source, writing: s.writing, writable: canWrite(s), setDeadZones: s.setDeadZones })),
  );

  const values = target.positions.map((pos) => snapshot.keys[pos]?.deadZone).filter((v) => v !== undefined);
  const onCount = values.filter((v) => v.enabled).length;
  const storedOn = values.length === 0 || (onCount > 0 && onCount < values.length) ? null : onCount > 0;
  const topRange = spread(values.map((v) => v.topUm));
  const bottomRange = spread(values.map((v) => v.bottomUm));
  const single = (range: Spread | null) => (range && !range.mixed ? range.min : null);
  const storedTop = single(topRange);
  const storedBottom = single(bottomRange);

  const travel = switchTravel(snapshot, target.positions);
  const stepUm = snapshot.device.precision?.distance || 10;

  const [enabled, setEnabled] = useState(storedOn);
  const [topText, setTopText] = useState(storedTop === null ? "" : mm(storedTop));
  const [bottomText, setBottomText] = useState(storedBottom === null ? "" : mm(storedBottom));
  const [saved, setSaved] = useSavedFlag();

  const top = mmDraft(topText, stepUm, 0, DEAD_ZONE_MAX_UM);
  const bottom = mmDraft(bottomText, stepUm, 0, DEAD_ZONE_MAX_UM);
  const invalid = top.invalid || bottom.invalid;

  const change: Partial<DeadZone> = {};
  if (enabled !== null && enabled !== storedOn) change.enabled = enabled;
  if (top.um !== null && top.um !== storedTop) change.topUm = top.um;
  if (bottom.um !== null && bottom.um !== storedBottom) change.bottomUm = bottom.um;
  const dirty = !invalid && Object.keys(change).length > 0;
  const disabled = !writable || writing;

  const edit = (setter: (text: string) => void) => (text: string) => {
    setter(text);
    setSaved(false);
  };
  const apply = async () => {
    if (!dirty || writing) return;
    if (top.um !== null) setTopText(mm(top.um));
    if (bottom.um !== null) setBottomText(mm(bottom.um));
    setSaved(await setDeadZones(target.positions, change));
  };

  const chartOn = enabled ?? true;
  const field = {
    minUm: 0,
    maxUm: DEAD_ZONE_MAX_UM,
    stepUm,
    disabled,
    describedBy: "dz-limits",
    onCommit: () => void apply(),
  };

  return (
    <Card highlight>
      <div className="grid items-start gap-5 md:grid-cols-[auto_minmax(0,1fr)] md:gap-7">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <Eyebrow className="text-accent">
              {t("dz.for")} {target.label}
            </Eyebrow>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-fg">
                {enabled === null ? t("dz.onCount", { on: onCount, total: values.length }) : enabled ? t("dz.on") : t("dz.off")}
              </span>
              <Toggle
                on={enabled}
                label={t("dz.toggle")}
                disabled={disabled || source === "file"}
                onChange={(on) => {
                  setEnabled(on);
                  setSaved(false);
                }}
              />
            </div>
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
              <div className={cx("grid gap-x-6 gap-y-3 transition-opacity sm:grid-cols-2", enabled === false && "opacity-60")}>
                <MmSliderField
                  {...field}
                  id="dz-top"
                  label={t("dz.top")}
                  text={topText}
                  draft={top.um}
                  invalid={top.invalid}
                  range={topRange}
                  onEdit={edit(setTopText)}
                />
                <MmSliderField
                  {...field}
                  id="dz-bottom"
                  label={t("dz.bottom")}
                  text={bottomText}
                  draft={bottom.um}
                  invalid={bottom.invalid}
                  range={bottomRange}
                  onEdit={edit(setBottomText)}
                />
              </div>
              <p id="dz-limits" className={cx("mt-3 text-xs", invalid ? "text-danger" : "text-subtle")}>
                {t("write.limits", { min: mm(0), max: mm(DEAD_ZONE_MAX_UM) })}
              </p>
              <div className="mt-4">
                <ApplyRow size="md" target={target.label} writing={writing} disabled={!writable || !dirty} saved={saved} demo={source === "demo"} />
              </div>
            </form>
          )}
        </div>

        <figure className="flex flex-col items-center gap-2 rounded-lg bg-panel/70 px-4 pt-3 pb-3 ring-1 ring-line md:order-first">
          <DeadZoneChart
            travelUm={travel.travelUm}
            actuationUm={commonActuation(snapshot, target.positions) ?? 1000}
            enabled={chartOn}
            topUm={top.um ?? topRange?.min ?? 0}
            bottomUm={bottom.um ?? bottomRange?.min ?? 0}
          />
          <figcaption className="flex max-w-81 flex-col items-center gap-1.5 text-center text-[11px] text-subtle">
            <span className="flex flex-wrap justify-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 border-t border-dashed border-muted" />
                {t("chart.actuation")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-[3px] w-3.5 rounded-full bg-accent" />
                {t("dz.legendActive")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-3.5 rounded-xs bg-[repeating-linear-gradient(135deg,var(--color-muted)_0_1.5px,transparent_1.5px_4px)] opacity-60" />
                {t("dz.legendIgnored")}
              </span>
            </span>
            {!chartOn && <span>{t("dz.offNote")}</span>}
          </figcaption>
        </figure>
      </div>
    </Card>
  );
}
