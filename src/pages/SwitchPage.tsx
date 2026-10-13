import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Icon } from "../components/icons";
import { hexRgb, KeyboardStage, mixColor } from "../components/KeyboardStage";
import { Card, ChangedTag, Check, cx, Empty, InfoTip, PageBody, Pill, ReadOnlyPill, Seg, SelectionEmpty, Swatch, Title } from "../components/ui";
import { POSITIONS } from "../data/layout";
import { switchById, type SwitchInfo } from "../data/switches";
import type { KeyboardSnapshot } from "../hid/snapshot";
import { useI18n } from "../i18n";
import { sameSet } from "../lib/selection";
import { groupBy } from "../lib/target";
import { navigate } from "../navigation";
import { current } from "../store/draft";
import { useUi, type SwitchMode } from "../store/ui";
import { useCount, useEditor, useLegend } from "./common";

const tint = (sw: SwitchInfo | undefined) => (sw ? mixColor(hexRgb(sw.color), 0.32) : undefined);
const fold = (text: string) => text.toLowerCase();

/** Writing the switch type, calibrating and live travel wait for a test on the keyboard; this page only reads. */
export function SwitchPage({ snapshot }: { snapshot: KeyboardSnapshot }) {
  const { t, mm } = useI18n();
  const { draft, edit, selected, writable } = useEditor();
  const legend = useLegend(snapshot);
  const count = useCount();
  const { mode, setMode, select } = useUi(useShallow((s) => ({ mode: s.switchMode, setMode: s.setSwitchMode, select: s.select })));
  const [query, setQuery] = useState("");

  const typeOf = (pos: number) => snapshot.keys[pos]?.switchType;
  const swOf = (pos: number) => switchById.get(typeOf(pos) ?? -1);
  const inUse = groupBy(POSITIONS, typeOf).sort((a, b) => b[1].length - a[1].length);
  const read = inUse.length > 0;
  const keys = selected.filter((pos) => typeOf(pos) !== undefined);
  const types = new Set(keys.map(typeOf));
  const single = types.size === 1 ? switchById.get([...types][0]!) : undefined;
  const compatible = snapshot.features.switchTypes.map((id) => switchById.get(id)).filter((sw): sw is SwitchInfo => !!sw);
  const list = compatible.filter((sw) => fold(sw.name).includes(fold(query.trim())));
  const autoCalibrate = current.setting(draft, snapshot, "autoCalibrate");

  return (
    <>
      <KeyboardStage
        title={t("nav.switch")}
        extra={
          <Seg<SwitchMode>
            label={t("sw.mode")}
            value={mode}
            onChange={setMode}
            options={[
              { value: "type", label: t("sw.mode.type") },
              { value: "calibration", label: t("sw.mode.calibration") },
              { value: "live", label: t("sw.mode.live") },
            ]}
          />
        }
        values={mode === "type"}
        sameValue={typeOf}
        legend={
          mode === "type" &&
          inUse.map(([id]) => (
            <span key={id} className="legend">
              <Swatch color={tint(switchById.get(id)) ?? "var(--color-key)"} />
              {switchById.get(id)?.name ?? t("sw.unknown", { id })}
            </span>
          ))
        }
        render={(key) => {
          const sw = swOf(key.pos);
          return {
            legend: legend(key),
            value: mode === "type" && sw ? mm(sw.travelUm) : "",
            bg: mode === "type" ? tint(sw) : undefined,
            desc: sw ? t("sw.keyDesc", { name: sw.name, travel: mm(sw.travelUm) }) : t("common.notRead"),
          };
        }}
      />
      <PageBody>
        {mode === "type" && (
          <div className="grid2">
            <Card title={t("sw.type")} info={t("sw.typeInfo")} aside={<ReadOnlyPill />}>
              {!read ? (
                <Empty icon="switch" title={t("common.notReadTitle")}>
                  {t("sw.notRead")}
                </Empty>
              ) : !keys.length ? (
                <SelectionEmpty />
              ) : (
                <>
                  <div className="flex min-w-0 items-center gap-3.5">
                    <span className="swbig" style={{ background: single?.color ?? "var(--color-key)" }} aria-hidden="true" />
                    <div className="min-w-0">
                      <div className="swname">{single ? single.name : t("common.mixed")}</div>
                      <div className="cap mt-0.5">
                        {count(keys.length)}
                        {single && ` · ${t("sw.travel", { value: mm(single.travelUm) })}`}
                      </div>
                    </div>
                  </div>
                  <div className="mt-[22px] mb-2">
                    <Title as="span" info={t("sw.compatibleInfo")}>
                      {t("sw.compatible")}
                    </Title>
                  </div>
                  {compatible.length === 0 ? (
                    <p className="cap m-0">{t("sw.compatibleNotRead")}</p>
                  ) : (
                    <>
                      <label className="sfield">
                        <Icon name="search" size="s" />
                        <span className="sr-only">{t("sw.search")}</span>
                        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("sw.search")} />
                      </label>
                      <ul className="swlist m-0 list-none p-0" aria-label={t("sw.compatible")}>
                        {list.map((sw) => (
                          <li key={sw.id} className={cx("row", types.has(sw.id) && "on")}>
                            <Swatch color={sw.color} />
                            <span className="min-w-0 flex-1 truncate">{sw.name}</span>
                            {types.has(sw.id) && <span className="cap">{t("sw.onKeyboard")}</span>}
                            <span className="cap min-w-[58px] text-right font-mono tabular-nums">{mm(sw.travelUm)} mm</span>
                          </li>
                        ))}
                        {!list.length && <li className="cap mx-2.5 my-2">{t("sw.noResults")}</li>}
                      </ul>
                    </>
                  )}
                </>
              )}
            </Card>

            <Card title={t("sw.inUse")} info={t("sw.inUseInfo")}>
              {!read ? (
                <p className="cap m-0">{t("sw.notRead")}</p>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {inUse.map(([id, positions]) => {
                    const sw = switchById.get(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        className={cx("row", sameSet(selected, positions) && "on")}
                        onClick={() => select(positions)}
                        aria-label={t("sw.rowLabel", { n: positions.length, name: sw?.name ?? String(id) })}
                      >
                        <Swatch color={sw?.color ?? "var(--color-key)"} />
                        <span>{sw?.name ?? t("sw.unknown", { id })}</span>
                        {sw && <span className="cap font-mono tabular-nums">{mm(sw.travelUm)} mm</span>}
                        <span className="flex-1" />
                        <span className="cap">{count(positions.length)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        )}

        {mode === "calibration" && (
          <div className="grid2">
            <Card title={t("sw.calibration")} info={t("sw.calibrationInfo")} aside={<Pill>{t("common.soon")}</Pill>}>
              <ol className="steps">
                <li>
                  <span className="stn">1</span>
                  {t("sw.cal.step1")}
                </li>
                <li>
                  <span className="stn">2</span>
                  {t("sw.cal.step2")}
                </li>
                <li>
                  <span className="stn">3</span>
                  {t("sw.cal.step3")}
                </li>
              </ol>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="btn pri" disabled>
                  {t("sw.cal.start")}
                </button>
                <span className="cap">{t("sw.cal.notYet")}</span>
              </div>
            </Card>
            <Card label={t("sw.adaptive")}>
              <div className="check first">
                <Check checked={autoCalibrate} disabled={!writable} onChange={(on) => edit("set.autoCalibrate", (d) => {
                      d.set.autoCalibrate = on;
                    })}>
                  {t("set.autoCalibrate")}
                </Check>
                <InfoTip label={t("info.about", { topic: t("set.autoCalibrate") })}>{t("sw.adaptiveInfo")}</InfoTip>
                {"autoCalibrate" in draft.set && <ChangedTag className="ml-auto" />}
              </div>
              <button type="button" className="lnk" onClick={() => navigate("settings")}>
                {t("sw.openSettings")}
                <Icon name="arrow" size="xs" />
              </button>
            </Card>
          </div>
        )}

        {mode === "live" && (
          <Card title={t("sw.live")} info={t("sw.liveInfo")} aside={<Pill>{t("common.soon")}</Pill>} className="narrow">
            <Empty icon="actuation" title={t("sw.live.soonTitle")}>
              <span>{t("sw.cal.notYet")}</span>
            </Empty>
          </Card>
        )}
      </PageBody>
    </>
  );
}
