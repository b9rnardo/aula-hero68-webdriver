import { useCallback } from "react";
import { DeadZoneChart } from "../components/DeadZoneChart";
import { KeyboardStage, mixColor } from "../components/KeyboardStage";
import { MmCaption, MmField, MmSlider, useMm, type MmModel } from "../components/MmControl";
import { Card, cx, Empty, PageBody, Pill, Seg, SelectionEmpty, Swatch, Title } from "../components/ui";
import { POSITIONS } from "../data/layout";
import { DEAD_ZONE_MAX_UM } from "../hid/hero68";
import type { KeyboardSnapshot } from "../hid/snapshot";
import { useI18n } from "../i18n";
import { groupBy } from "../lib/target";
import { current, type DeadZone, type Draft } from "../store/draft";
import { stepOf, switchTravel, useCount, useEditor, useLegend } from "./common";

const ZONE_TINT = mixColor([245, 199, 107], 0.22);

function Zone({ model, label, info }: { model: MmModel; label: string; info: string }) {
  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Title as="span" info={info}>
            {label}
          </Title>
          <MmCaption model={model} />
        </div>
        <MmField model={model} label={label} sm />
      </div>
      <MmSlider model={model} label={label} />
    </div>
  );
}

export function DeadZonePage({ snapshot }: { snapshot: KeyboardSnapshot }) {
  const { t, mm } = useI18n();
  const { draft, edit, selected, writable } = useEditor();
  const legend = useLegend(snapshot);
  const count = useCount();
  const dz = useCallback((pos: number) => current.dz(draft, snapshot, pos), [draft, snapshot]);
  const step = stepOf(snapshot);

  const keys = selected.filter((pos) => dz(pos));
  const onKeys = keys.filter((pos) => dz(pos)!.enabled);
  const state = !keys.length ? null : onKeys.length === keys.length ? "on" : onKeys.length === 0 ? "off" : null;
  const off = state === "off";

  const change = (kind: string, patch: Partial<DeadZone>) =>
    edit(kind, (d: Draft) => {
      for (const pos of keys) d.dz[pos] = { ...current.dz(d, snapshot, pos)!, ...patch };
    });
  const zone = (field: "topUm" | "bottomUm") => ({
    values: keys.map((pos) => dz(pos)![field]),
    saved: keys.map((pos) => snapshot.keys[pos]?.deadZone?.[field]),
    min: 0,
    max: DEAD_ZONE_MAX_UM,
    step,
    disabled: !writable || off,
    apply: (um: number) => change(`dz.${field}`, { [field]: um }),
  });
  const top = useMm(zone("topUm"));
  const bottom = useMm(zone("bottomUm"));

  const sample = keys.length ? keys : POSITIONS;
  const actuations = groupBy(sample, (pos) => current.act(draft, snapshot, pos)).sort((a, b) => b[1].length - a[1].length);
  const chart = {
    travelUm: switchTravel(snapshot, sample).travelUm,
    actuationUm: actuations[0]?.[0] ?? 1000,
    enabled: keys.length ? state !== "off" : true,
    topUm: keys.length ? top.min : 100,
    bottomUm: keys.length ? bottom.min : 100,
  };

  return (
    <>
      <KeyboardStage
        title={t("nav.deadZone")}
        values
        sameValue={(pos) => {
          const value = dz(pos);
          return value && (value.enabled ? `${value.topUm}/${value.bottomUm}` : "off");
        }}
        chips={[{ label: t("dz.chipOn"), positions: POSITIONS.filter((pos) => dz(pos)?.enabled) }]}
        legend={
          <span className="legend">
            <Swatch color={ZONE_TINT} />
            {t("dz.legendOn")}
          </span>
        }
        render={(key) => {
          const value = dz(key.pos);
          return {
            legend: legend(key),
            value: value?.enabled ? `${mm(value.topUm)}/${mm(value.bottomUm)}` : "",
            bg: value?.enabled ? ZONE_TINT : undefined,
            dirty: key.pos in draft.dz,
            desc: !value ? t("common.notRead") : value.enabled ? t("dz.keyOn", { top: mm(value.topUm), bottom: mm(value.bottomUm) }) : t("dz.keyOff"),
          };
        }}
      />
      <PageBody>
        <div className="grid2">
          <Card title={t("nav.deadZone")} info={t("dz.info")} aside={selected.length > 0 && <Pill>{count(selected.length)}</Pill>}>
            {!POSITIONS.some((pos) => snapshot.keys[pos]?.deadZone) ? (
              <Empty title={t("common.notReadTitle")}>{t("dz.notRead")}</Empty>
            ) : !keys.length ? (
              <SelectionEmpty />
            ) : (
              <>
                <Seg
                  lg
                  label={t("dz.segLabel")}
                  value={state}
                  disabled={!writable}
                  options={[
                    { value: "off", label: t("common.off") },
                    { value: "on", label: t("common.on") },
                  ]}
                  onChange={(value) => change("dz.enabled", { enabled: value === "on" })}
                />
                {state === null && <p className="cap mt-2 mb-0">{t("dz.mixed", { n: onKeys.length, total: keys.length })}</p>}
                <div className={cx("mt-5 flex flex-col gap-5", off && "dim")}>
                  <Zone model={top} label={t("dz.top")} info={t("dz.topInfo", { max: mm(DEAD_ZONE_MAX_UM) })} />
                  <Zone model={bottom} label={t("dz.bottom")} info={t("dz.bottomInfo", { max: mm(DEAD_ZONE_MAX_UM) })} />
                </div>
              </>
            )}
          </Card>

          <Card title={t("dz.chart")} info={t("dz.chartInfo")} infoLabel={t("info.simulation")}>
            <DeadZoneChart {...chart} label={t("dz.chartLabel", { top: mm(chart.topUm), bottom: mm(chart.bottomUm) })} />
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              <span className="legend">
                <span className="lg-zone" />
                {t("dz.legendZone")}
              </span>
              <span className="legend">
                <span className="lg-line" />
                {t("dz.legendResponds")}
              </span>
              <span className="legend">
                <span className="lg-dash" />
                {t("act.legendPoint")}
              </span>
            </div>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
