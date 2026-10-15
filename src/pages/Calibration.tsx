import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { Icon } from "../components/icons";
import { Button, Card, ChangedTag, Check, Empty, InfoTip, Note, Pill } from "../components/ui";
import { POSITIONS } from "../data/layout";
import type { KeyboardSnapshot } from "../hid/snapshot";
import { useI18n } from "../i18n";
import { navigate } from "../navigation";
import { useCalibration } from "../store/calibration";
import { current } from "../store/draft";
import { useDriver } from "../store/driver";
import { useEditor } from "./common";

/** Keys the keyboard took a new range for, on the stage and in the legend. */
export const CAL_DONE = "color-mix(in srgb, var(--color-ok) 30%, var(--color-key))";

/** Switch page, calibration mode: the steps, the start and finish button, and adaptive calibration. */
export function Calibration({ snapshot }: { snapshot: KeyboardSnapshot }) {
  const { t, number } = useI18n();
  const { draft, edit, writable } = useEditor();
  const source = useDriver((s) => s.source);
  const { status, error, done, start, stop } = useCalibration(
    useShallow((s) => ({
      status: s.status,
      error: s.error,
      done: Object.values(s.keys).filter((key) => key.done).length,
      start: s.start,
      stop: s.stop,
    })),
  );
  const autoCalibrate = current.setting(draft, snapshot, "autoCalibrate");

  // Calibration never outlives this panel.
  useEffect(() => () => void useCalibration.getState().stop(), []);

  const on = status === "on";
  const total = POSITIONS.length;
  const steps = [t("sw.cal.step1"), t("sw.cal.step2"), t("sw.cal.step3")];

  return (
    <div className="grid2">
      <Card title={t("sw.calibration")} info={t("sw.calibrationInfo")} aside={on && <Pill tone="hot">{t("cal.on")}</Pill>}>
        {source === "file" ? (
          <Empty icon="plug" title={t("cal.needsKeyboard")} />
        ) : (
          <>
            {error && (
              <Note tone="bad" className="mb-3">
                {error}
              </Note>
            )}
            <ol className="steps">
              {steps.map((step, i) => (
                <li key={i}>
                  <span className="stn">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
            {(status !== "off" || done > 0) && (
              <div className="mb-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="lab">{t("cal.progressLabel")}</span>
                  <span className="cap tabular-nums">{t("cal.count", { done: number(done), total: number(total) })}</span>
                </div>
                <div className="prog" role="progressbar" aria-label={t("cal.progressLabel")} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
                  <div style={{ width: `${(done / total) * 100}%` }} />
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="pri" onClick={() => void (on ? stop() : start())} disabled={on ? false : status !== "off" || !writable}>
                <Icon name={on ? "check" : "calibrate"} size="s" />
                {t(on ? "cal.finish" : "sw.cal.start")}
              </Button>
              {on && <span className="cap">{t("cal.ignoring")}</span>}
            </div>
          </>
        )}
      </Card>
      <Card label={t("sw.adaptive")}>
        <div className="check first">
          <Check
            checked={autoCalibrate}
            disabled={!writable || status !== "off"}
            onChange={(enabled) =>
              edit("set.autoCalibrate", (d) => {
                d.set.autoCalibrate = enabled;
              })
            }
          >
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
  );
}
