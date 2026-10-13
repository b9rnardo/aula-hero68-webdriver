import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { LockIcon } from "../components/icons";
import { KeyboardStage, Page, SelectionActions } from "../components/KeyboardStage";
import { RapidTriggerChart } from "../components/RapidTriggerChart";
import { Card, cx, Empty, Eyebrow, Notice } from "../components/ui";
import { ApplyRow, mmDraft, MmSliderField, Toggle, useSavedFlag } from "../components/WriteControls";
import { keyLegend } from "../data/keycodes";
import { POSITIONS } from "../data/layout";
import { RAPID_TRIGGER_MAX_UM } from "../hid/hero68";
import type { KeyboardSnapshot, KeySnapshot } from "../hid/snapshot";
import { useI18n } from "../i18n";
import { groupBy, spread, useTarget, type Spread } from "../lib/target";
import { canWrite, useDriver } from "../store/driver";
import { useUi } from "../store/ui";
import { commonActuation, DistributionRow, switchTravel } from "./shared";

type RapidTrigger = NonNullable<KeySnapshot["rapidTrigger"]>;

/** Sortable group key: off first, then by press and release. */
const groupKey = ({ enabled, pressUm, releaseUm }: RapidTrigger) =>
  enabled ? `1:${String(pressUm).padStart(5, "0")}:${String(releaseUm).padStart(5, "0")}` : "0";

export function RapidTriggerPage({ snapshot }: { snapshot: KeyboardSnapshot }) {
  const { t, mm, lang } = useI18n();
  const target = useTarget();
  const select = useUi((s) => s.select);
  const rt = (pos: number) => snapshot.keys[pos]?.rapidTrigger;
  const distribution = groupBy(POSITIONS, (pos) => {
    const value = rt(pos);
    return value && groupKey(value);
  });

  return (
    <Page
      title={t("rt.title")}
      help={t("rt.help")}
      actions={<SelectionActions />}
      stage={
        <KeyboardStage
          label={t("rt.title")}
          render={(key) => {
            const value = rt(key.pos);
            return {
              legend: keyLegend(snapshot.layers[0]?.[key.pos] ?? key.defaults[0]),
              value: value?.enabled ? mm(value.pressUm) : undefined,
              tone: value?.enabled ? "marked" : "default",
            };
          }}
        />
      }
    >
      <div className="grid gap-4">
        {/* Remounts on a new selection, a new read (not a write) or language (decimal separator) so the draft starts fresh. */}
        <RapidTriggerCard key={`${snapshot.readAt}:${lang}:${target.positions.join()}`} snapshot={snapshot} />

        <Card title={t("dist.title")} description={t("dist.desc")}>
          {distribution.length === 0 ? (
            <Empty>{t("dist.empty")}</Empty>
          ) : (
            <ul className="-mx-3 grid gap-x-8 gap-y-0.5 md:grid-cols-2">
              {distribution.map(([key, positions]) => {
                const value = rt(positions[0])!;
                return (
                  <DistributionRow
                    key={key}
                    label={value.enabled ? `${mm(value.pressUm)} / ${mm(value.releaseUm)}` : t("rt.off")}
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

function RapidTriggerCard({ snapshot }: { snapshot: KeyboardSnapshot }) {
  const { t, mm } = useI18n();
  const target = useTarget();
  const { source, writing, writable, setRapidTrigger } = useDriver(
    useShallow((s) => ({ source: s.source, writing: s.writing, writable: canWrite(s), setRapidTrigger: s.setRapidTrigger })),
  );

  const values = target.positions.map((pos) => snapshot.keys[pos]?.rapidTrigger).filter((v) => v !== undefined);
  const onCount = values.filter((v) => v.enabled).length;
  const storedOn = values.length === 0 || (onCount > 0 && onCount < values.length) ? null : onCount > 0;
  const pressRange = spread(values.map((v) => v.pressUm));
  const releaseRange = spread(values.map((v) => v.releaseUm));
  const single = (range: Spread | null) => (range && !range.mixed ? range.min : null);
  const storedPress = single(pressRange);
  const storedRelease = single(releaseRange);

  const travel = switchTravel(snapshot, target.positions);
  const stepUm = snapshot.device.precision?.rt || 10;
  const maxUm = Math.min(travel.travelUm, RAPID_TRIGGER_MAX_UM);
  const actuationUm = commonActuation(snapshot, target.positions);

  const [enabled, setEnabled] = useState(storedOn);
  const [pressText, setPressText] = useState(storedPress === null ? "" : mm(storedPress));
  const [releaseText, setReleaseText] = useState(storedRelease === null ? "" : mm(storedRelease));
  const [linked, setLinked] = useState(values.every((v) => v.pressUm === v.releaseUm));
  const [saved, setSaved] = useSavedFlag();

  const press = mmDraft(pressText, stepUm, stepUm, maxUm);
  const release = linked ? press : mmDraft(releaseText, stepUm, stepUm, maxUm);
  const invalid = press.invalid || release.invalid;

  const change: Partial<RapidTrigger> = {};
  if (enabled !== null && enabled !== storedOn) change.enabled = enabled;
  if (press.um !== null && press.um !== storedPress) change.pressUm = press.um;
  if (release.um !== null && release.um !== storedRelease) change.releaseUm = release.um;
  const dirty = !invalid && Object.keys(change).length > 0;
  const disabled = !writable || writing;

  const edit = (setter: (text: string) => void) => (text: string) => {
    setter(text);
    setSaved(false);
  };
  const apply = async () => {
    if (!dirty || writing) return;
    if (press.um !== null) setPressText(mm(press.um));
    if (release.um !== null) setReleaseText(mm(release.um));
    setSaved(await setRapidTrigger(target.positions, change));
  };

  const chartOn = enabled ?? true;
  const fallback = (draft: number | null, range: Spread | null) => draft ?? range?.min ?? 400;
  const field = {
    minUm: stepUm,
    maxUm,
    stepUm,
    disabled,
    describedBy: "rt-limits",
    ends: [t("rt.high"), t("rt.low")] as [string, string],
    onCommit: () => void apply(),
  };

  return (
    <Card highlight>
      <div className="grid items-start gap-5 md:grid-cols-[auto_minmax(0,1fr)] md:gap-7">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <Eyebrow className="text-accent">
              {t("rt.for")} {target.label}
            </Eyebrow>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-fg">
                {enabled === null ? t("rt.onCount", { on: onCount, total: values.length }) : enabled ? t("rt.on") : t("rt.off")}
              </span>
              <Toggle
                on={enabled}
                label={t("rt.toggle")}
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
                  id="rt-press"
                  className={cx(linked && "sm:col-span-2")}
                  label={linked ? t("rt.pressRelease") : t("rt.press")}
                  text={pressText}
                  draft={press.um}
                  invalid={press.invalid}
                  range={pressRange}
                  onEdit={edit(setPressText)}
                />
                {!linked && (
                  <MmSliderField
                    {...field}
                    id="rt-release"
                    label={t("rt.release")}
                    text={releaseText}
                    draft={release.um}
                    invalid={release.invalid}
                    range={releaseRange}
                    onEdit={edit(setReleaseText)}
                  />
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-fg-2">
                  <input
                    type="checkbox"
                    checked={linked}
                    disabled={disabled}
                    onChange={(event) => {
                      setLinked(event.target.checked);
                      if (!event.target.checked) setReleaseText(release.um === null ? releaseText : mm(release.um));
                      setSaved(false);
                    }}
                    className="size-4 accent-accent"
                  />
                  {t("rt.linked")}
                </label>
                <p id="rt-limits" className={cx("text-xs", invalid ? "text-danger" : "text-subtle")}>
                  {t("write.limits", { min: mm(stepUm), max: mm(maxUm) })}
                </p>
              </div>
              <div className="mt-4">
                <ApplyRow size="md" target={target.label} writing={writing} disabled={!writable || !dirty} saved={saved} demo={source === "demo"} />
              </div>
            </form>
          )}
        </div>

        <figure className="flex flex-col items-center gap-2 rounded-lg bg-panel/70 px-4 pt-3 pb-3 ring-1 ring-line md:order-first">
          <RapidTriggerChart
            travelUm={travel.travelUm}
            actuationUm={actuationUm ?? 1000}
            enabled={chartOn}
            pressUm={fallback(press.um, pressRange)}
            releaseUm={fallback(release.um, releaseRange)}
          />
          <figcaption className="flex max-w-81 flex-col items-center gap-1.5 text-center text-[11px] text-subtle">
            <span className="flex flex-wrap justify-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 border-t border-dashed border-muted" />
                {t("chart.actuation")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-[3px] w-3.5 rounded-full bg-accent" />
                {t("rt.legendActive")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-accent" />
                {t("rt.legendPress")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full ring-[1.5px] ring-accent ring-inset" />
                {t("rt.legendReset")}
              </span>
            </span>
            {!chartOn && <span>{t("rt.offNote")}</span>}
          </figcaption>
        </figure>
      </div>
    </Card>
  );
}
