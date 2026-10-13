import { useCallback } from "react";
import { actTint, KeyboardStage } from "../components/KeyboardStage";
import { MmCaption, MmField, MmSlider, useMm } from "../components/MmControl";
import { SwitchDiagram } from "../components/SwitchDiagram";
import { Card, cx, Empty, Note, PageBody, Pill, SelectionEmpty, Title } from "../components/ui";
import { POSITIONS } from "../data/layout";
import { ACTUATION_MIN_UM } from "../hid/hero68";
import type { KeyboardSnapshot } from "../hid/snapshot";
import { useI18n, type MessageKey } from "../i18n";
import { current } from "../store/draft";
import { stepOf, switchTravel, travelOf, useCount, useEditor, useLegend, ValueRows } from "./common";

const PRESETS: { name: MessageKey; um: number }[] = [
  { name: "act.preset.competitive", um: 400 },
  { name: "act.preset.balanced", um: 1000 },
  { name: "act.preset.typing", um: 2000 },
];
/** Below this, resting a finger on the key can trigger it. */
const LOW_UM = 300;

export function ActuationPage({ snapshot }: { snapshot: KeyboardSnapshot }) {
  const { t, mm } = useI18n();
  const { draft, edit, selected, writable } = useEditor();
  const legend = useLegend(snapshot);
  const count = useCount();
  const act = useCallback((pos: number) => current.act(draft, snapshot, pos), [draft, snapshot]);

  const keys = selected.filter((pos) => act(pos) !== undefined);
  const maxTravel = keys.length ? Math.max(...keys.map((pos) => travelOf(snapshot, pos, draft))) : switchTravel(snapshot, POSITIONS, draft).travelUm;
  const model = useMm({
    values: keys.map((pos) => act(pos)!),
    saved: keys.map((pos) => snapshot.keys[pos]?.actuationUm),
    min: ACTUATION_MIN_UM,
    max: maxTravel,
    step: stepOf(snapshot),
    disabled: !writable,
    apply: (um) =>
      edit("act", (d) => {
        for (const pos of keys) d.act[pos] = Math.min(um, travelOf(snapshot, pos, d));
      }),
  });
  const read = POSITIONS.some((pos) => snapshot.keys[pos]?.actuationUm !== undefined);
  const diagramTravel = switchTravel(snapshot, keys.length ? keys : POSITIONS, draft).travelUm;

  return (
    <>
      <KeyboardStage
        title={t("nav.actuation")}
        values
        sameValue={act}
        legend={
          <span className="legend">
            {t("act.legendSoft")} <span className="ramp" /> {t("act.legendFirm")}
          </span>
        }
        render={(key) => {
          const um = act(key.pos);
          return {
            legend: legend(key),
            value: um === undefined ? "—" : mm(um),
            bg: um === undefined ? undefined : actTint(um),
            dirty: key.pos in draft.act,
            desc: um === undefined ? t("common.notRead") : t("act.keyDesc", { value: mm(um) }),
          };
        }}
      />
      <PageBody>
        <div className="grid2">
          <Card title={t("act.title")} info={t("act.info")} aside={selected.length > 0 && <Pill>{count(selected.length)}</Pill>}>
            {!read ? (
              <Empty title={t("common.notReadTitle")}>{t("act.notRead")}</Empty>
            ) : !keys.length ? (
              <SelectionEmpty />
            ) : (
              <>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="big font-mono tabular-nums">{model.mixed ? `${mm(model.min)}–${mm(model.max)}` : mm(model.min)}</span>
                      <span className="text-[15px] text-muted">mm</span>
                    </div>
                    <MmCaption model={model} className="mt-1" />
                  </div>
                  <MmField model={model} label={t("act.title")} />
                </div>
                <div className="mt-[22px]">
                  <MmSlider model={model} label={t("act.title")} />
                  <div className="cap mt-2 flex justify-between">
                    <span>{mm(ACTUATION_MIN_UM)} mm</span>
                    <span>{mm(maxTravel)} mm</span>
                  </div>
                </div>
                <div className="mt-[22px]">
                  <Title as="span" info={t("act.presetsInfo")} infoLabel={t("info.presets")}>
                    {t("common.presets")}
                  </Title>
                  <div className="presets mt-2">
                    {PRESETS.map((preset) => {
                      const on = !model.mixed && model.min === preset.um;
                      return (
                        <button key={preset.um} type="button" className={cx("preset", on && "on")} aria-pressed={on} disabled={!writable} onClick={() => model.apply(preset.um)}>
                          <span className="font-semibold">{t(preset.name)}</span>
                          <span className="font-mono text-[13px] text-accent-light tabular-nums">{mm(preset.um)} mm</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {model.min < LOW_UM && (
                  <Note tone="warn" className="mt-4">
                    {t("act.lowWarning", { value: mm(LOW_UM) })}
                  </Note>
                )}
              </>
            )}
          </Card>

          <Card title={t("act.diagram")} info={t("act.diagramInfo")}>
            <SwitchDiagram
              minUm={keys.length ? model.min : null}
              maxUm={keys.length ? model.max : null}
              travelUm={diagramTravel}
              savedUm={model.changed ? model.saved : null}
            />
            <div className="mt-2.5 flex flex-wrap justify-center gap-x-4 gap-y-2">
              <span className="legend">
                <span className="lg-dash" />
                {t("act.legendPoint")}
              </span>
              <span className="legend">
                <span className="tkm mr-0" />
                {t("act.legendSaved")}
              </span>
            </div>
            {read && (
              <div className="mt-[18px] border-t border-line pt-3.5">
                <div className="lab mb-1.5">{t("act.inUse")}</div>
                <ValueRows
                  positions={POSITIONS}
                  valueOf={act}
                  render={(um) => `${mm(um)} mm`}
                  swatch={actTint}
                  label={(um, n) => t("act.rowLabel", { n, value: mm(um) })}
                />
              </div>
            )}
          </Card>
        </div>
      </PageBody>
    </>
  );
}
