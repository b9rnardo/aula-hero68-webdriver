import { useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { KeyboardStage, rtTint } from "../components/KeyboardStage";
import { MmCaption, MmField, MmSlider, useMm, type MmModel } from "../components/MmControl";
import { RapidTriggerChart, simulate } from "../components/RapidTriggerChart";
import { Card, Check, cx, Empty, Kpi, Note, PageBody, Pill, Seg, SelectionEmpty, Swatch, Title } from "../components/ui";
import { describeKey } from "../data/keycodes";
import { keyByPos, POSITIONS } from "../data/layout";
import { RAPID_TRIGGER_MAX_UM } from "../hid/hero68";
import type { KeyboardSnapshot } from "../hid/snapshot";
import { useI18n, type MessageKey } from "../i18n";
import { useKeyNames } from "../lib/keys";
import { groupBy } from "../lib/target";
import { current, type Draft, type RapidTrigger } from "../store/draft";
import { useUi } from "../store/ui";
import { stepOf, useCount, useEditor, useLegend } from "./common";

const PRESETS: { name: MessageKey; pressUm: number; releaseUm: number }[] = [
  { name: "rt.preset.aggressive", pressUm: 50, releaseUm: 50 },
  { name: "rt.preset.competitive", pressUm: 150, releaseUm: 200 },
  { name: "rt.preset.stable", pressUm: 300, releaseUm: 300 },
];
/** The slider covers the useful range; the field takes up to the full travel. */
const BAR_MAX_UM = 1000;

function Sensitivity({ model, label, info, sm }: { model: MmModel; label: string; info: string; sm?: boolean }) {
  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Title as="span" info={info}>
            {label}
          </Title>
          <MmCaption model={model} />
        </div>
        <MmField model={model} label={label} sm={sm} />
      </div>
      <MmSlider model={model} label={label} />
    </div>
  );
}

export function RapidTriggerPage({ snapshot }: { snapshot: KeyboardSnapshot }) {
  const { t, mm } = useI18n();
  const { draft, edit, selected, writable } = useEditor();
  const legend = useLegend(snapshot);
  const names = useKeyNames();
  const count = useCount();
  const { linkRt, setLinkRt } = useUi(useShallow((s) => ({ linkRt: s.linkRt, setLinkRt: s.setLinkRt })));
  const rt = useCallback((pos: number) => current.rt(draft, snapshot, pos), [draft, snapshot]);
  const step = stepOf(snapshot);

  const keys = selected.filter((pos) => rt(pos));
  const onKeys = keys.filter((pos) => rt(pos)!.enabled);
  const state = !keys.length ? null : onKeys.length === keys.length ? "on" : onKeys.length === 0 ? "off" : null;
  const off = state === "off";

  const change = (kind: string, patch: (value: RapidTrigger) => Partial<RapidTrigger>) =>
    edit(kind, (d: Draft) => {
      for (const pos of keys) {
        const value = current.rt(d, snapshot, pos)!;
        d.rt[pos] = { ...value, ...patch(value) };
      }
    });

  const press = useMm({
    values: keys.map((pos) => rt(pos)!.pressUm),
    saved: keys.map((pos) => snapshot.keys[pos]?.rapidTrigger?.pressUm),
    min: step,
    max: RAPID_TRIGGER_MAX_UM,
    barMax: BAR_MAX_UM,
    step,
    disabled: !writable || off,
    apply: (um) => change("rt.press", () => (linkRt ? { pressUm: um, releaseUm: um } : { pressUm: um })),
  });
  const release = useMm({
    values: keys.map((pos) => rt(pos)!.releaseUm),
    saved: keys.map((pos) => snapshot.keys[pos]?.rapidTrigger?.releaseUm),
    min: step,
    max: RAPID_TRIGGER_MAX_UM,
    barMax: BAR_MAX_UM,
    step,
    disabled: !writable || off || linkRt,
    apply: (um) => change("rt.release", () => ({ releaseUm: um })),
  });

  // Modifiers with Rapid Trigger can let go while held halfway.
  const modifiers = onKeys.filter((pos) => {
    const value = current.fn(draft, snapshot, 0, pos) ?? keyByPos.get(pos)?.defaults[0];
    const described = value === undefined ? null : describeKey(value);
    return described?.kind === "known" && described.fn.category === "modifiers";
  });

  // Simulation: the selection's values, or a typical setup when nothing is selected.
  const actOf = (pos: number) => current.act(draft, snapshot, pos);
  const actuations = groupBy(keys.length ? keys : POSITIONS, actOf).sort((a, b) => b[1].length - a[1].length);
  const sim = {
    actuationUm: actuations[0]?.[0] ?? 1000,
    pressUm: keys.length ? press.min : 150,
    releaseUm: keys.length ? release.min : 200,
  };
  const withRt = simulate(sim.actuationUm, true, sim.pressUm, sim.releaseUm).events.filter((e) => e.on).length;
  const withoutRt = simulate(sim.actuationUm, false, sim.pressUm, sim.releaseUm).events.filter((e) => e.on).length;
  const sub = t("rt.sim.sub", { act: mm(sim.actuationUm), press: mm(sim.pressUm), release: mm(sim.releaseUm) });

  return (
    <>
      <KeyboardStage
        title={t("nav.rapidTrigger")}
        values
        sameValue={(pos) => {
          const value = rt(pos);
          return value && (value.enabled ? `${value.pressUm}/${value.releaseUm}` : "off");
        }}
        chips={[{ label: t("rt.chipOn"), positions: POSITIONS.filter((pos) => rt(pos)?.enabled) }]}
        legend={
          <span className="legend">
            <Swatch color="#4f4479" />
            {t("rt.legendOn")}
          </span>
        }
        render={(key) => {
          const value = rt(key.pos);
          return {
            legend: legend(key),
            value: value?.enabled ? mm(value.pressUm) : "",
            bg: value?.enabled ? rtTint(value.pressUm) : undefined,
            dirty: key.pos in draft.rt,
            desc: !value
              ? t("common.notRead")
              : value.enabled
                ? t("rt.keyOn", { press: mm(value.pressUm), release: mm(value.releaseUm) })
                : t("rt.keyOff"),
          };
        }}
      />
      <PageBody>
        <div className="grid2">
          <Card title={t("nav.rapidTrigger")} info={t("rt.info")} aside={selected.length > 0 && <Pill>{count(selected.length)}</Pill>}>
            {!POSITIONS.some((pos) => snapshot.keys[pos]?.rapidTrigger) ? (
              <Empty title={t("common.notReadTitle")}>{t("rt.notRead")}</Empty>
            ) : !keys.length ? (
              <SelectionEmpty />
            ) : (
              <>
                <Seg
                  lg
                  label={t("rt.segLabel")}
                  value={state}
                  disabled={!writable}
                  options={[
                    { value: "off", label: t("common.off") },
                    { value: "on", label: t("common.on") },
                  ]}
                  onChange={(value) => change("rt.enabled", () => ({ enabled: value === "on" }))}
                />
                {state === null && <p className="cap mt-2 mb-0">{t("rt.mixed", { n: onKeys.length, total: keys.length })}</p>}
                <div className={cx("mt-5 flex flex-col gap-5", off && "dim")}>
                  <Sensitivity model={press} label={t("rt.press")} info={t("rt.pressInfo", { bar: mm(BAR_MAX_UM), max: mm(RAPID_TRIGGER_MAX_UM) })} sm />
                  <Sensitivity model={release} label={t("rt.release")} info={t("rt.releaseInfo", { bar: mm(BAR_MAX_UM), max: mm(RAPID_TRIGGER_MAX_UM) })} sm />
                  <Check
                    small
                    checked={linkRt}
                    disabled={!writable || off}
                    onChange={(on) => {
                      setLinkRt(on);
                      if (on) change("rt.link", (value) => ({ releaseUm: value.pressUm }));
                    }}
                  >
                    {t("rt.link")}
                  </Check>
                  <div>
                    <Title as="span" info={t("rt.presetsInfo")} infoLabel={t("info.presets")}>
                      {t("common.presets")}
                    </Title>
                    <div className="presets mt-2">
                      {PRESETS.map((preset) => {
                        const on =
                          state === "on" &&
                          keys.every((pos) => rt(pos)!.pressUm === preset.pressUm && rt(pos)!.releaseUm === preset.releaseUm);
                        return (
                          <button
                            key={preset.name}
                            type="button"
                            className={cx("preset", on && "on")}
                            aria-pressed={on}
                            disabled={!writable}
                            onClick={() => change("rt.preset", () => ({ enabled: true, pressUm: preset.pressUm, releaseUm: preset.releaseUm }))}
                          >
                            <span className="font-semibold">{t(preset.name)}</span>
                            <span className="font-mono text-[13px] text-accent-light tabular-nums">
                              {mm(preset.pressUm)} / {mm(preset.releaseUm)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                {modifiers.length > 0 && (
                  <Note tone="warn" className="mt-4">
                    {t("rt.modWarning", { names: names.list(modifiers, 4) })}
                  </Note>
                )}
              </>
            )}
          </Card>

          <Card title={t("rt.sim.title")} info={t("rt.sim.info", { sub })} infoLabel={t("info.simulation")}>
            <RapidTriggerChart {...sim} enabled label={t("rt.sim.label", { sub, with: withRt, without: withoutRt })} />
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              <span className="legend">
                <span className="lg-line" />
                {t("rt.sim.on")}
              </span>
              <span className="legend">
                <span className="lg-dot" />
                {t("rt.sim.trigger")}
              </span>
              <span className="legend">
                <span className="lg-ring" />
                {t("rt.sim.release")}
              </span>
              <span className="legend">
                <span className="lg-dash" />
                {t("act.legendPoint")}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Kpi label={t("rt.sim.with")} value={withRt} unit={t("rt.sim.triggers")} />
              <Kpi label={t("rt.sim.without")} value={withoutRt} unit={t("rt.sim.triggers")} />
            </div>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
