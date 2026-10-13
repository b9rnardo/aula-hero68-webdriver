import { Card, ChangedTag, Check, Dl, InfoTip, Note, PageBody, PageHeader, ReadOnlyPill, Seg } from "../components/ui";
import { POLLING_HZ, sleepMinutes } from "../data/lighting";
import { formatFirmware, type KeyboardSnapshot } from "../hid/snapshot";
import { useI18n, type MessageKey } from "../i18n";
import { current } from "../store/draft";
import type { ToggleSetting } from "../store/driver";
import { useEditor, useStepLabel } from "./common";

const TOGGLES = [
  ["winLock", "set.winLock", "set.winLockInfo"],
  ["macMode", "set.macMode", "set.macModeInfo"],
  ["keyCombo", "set.keyCombo", "set.keyComboInfo"],
  ["autoCalibrate", "set.autoCalibrate", "set.autoCalibrateInfo"],
] as const satisfies readonly [ToggleSetting, MessageKey, MessageKey][];

/** Polling levels from fastest to slowest. */
const POLLING_ORDER = POLLING_HZ.map((hz, level) => ({ hz, level })).sort((a, b) => b.hz - a.hz);

export function SettingsPage({ snapshot }: { snapshot: KeyboardSnapshot }) {
  const { t, number, date, mm } = useI18n();
  const { draft, edit, writable } = useEditor();
  const stepLabel = useStepLabel();
  const { settings, device } = snapshot;
  const polling = current.setting(draft, snapshot, "pollingLevel");
  const sleep = settings.sleepLevel === null ? undefined : sleepMinutes(settings.sleepLevel);
  const savedHz = settings.pollingLevel === null ? undefined : POLLING_HZ[settings.pollingLevel];

  return (
    <PageBody>
      <PageHeader title={t("nav.settings")} />
      <div className="grid2">
        <div className="stack">
          <Card title={t("set.polling")} info={t("set.pollingInfo")} aside={"pollingLevel" in draft.set && <ChangedTag />}>
            {polling === null ? (
              <p className="cap m-0">{t("common.notRead")}</p>
            ) : (
              <Seg
                lg
                label={t("set.polling")}
                value={polling}
                disabled={!writable}
                className="tabular-nums"
                options={POLLING_ORDER.map(({ hz, level }) => ({ value: level, label: hz >= 1000 ? `${number(hz / 1000)}k` : String(hz) }))}
                onChange={(level) =>
                  edit("set.polling", (d) => {
                    d.set.pollingLevel = level;
                  })
                }
              />
            )}
            <p className="cap mt-2 mb-0">{t("set.pollingUnit")}</p>
          </Card>

          <Card title={t("set.behavior")}>
            {TOGGLES.map(([key, label, info]) => (
              <div key={key} className="check">
                <Check
                  checked={current.setting(draft, snapshot, key)}
                  disabled={!writable}
                  onChange={(on) =>
                    edit(`set.${key}`, (d) => {
                      d.set[key] = on;
                    })
                  }
                >
                  {t(label)}
                </Check>
                <InfoTip label={t("info.about", { topic: t(label) })}>{t(info)}</InfoTip>
                {key in draft.set && <ChangedTag className="ml-auto" />}
              </div>
            ))}
          </Card>
        </div>

        <div className="stack">
          <Card title={t("set.sleep")} info={t("set.sleepInfo")} aside={<ReadOnlyPill />}>
            {sleep === undefined ? (
              <p className="cap m-0">{t("common.notRead")}</p>
            ) : sleep === null ? (
              <span className="stat">{t("set.sleepNever")}</span>
            ) : (
              <div className="flex items-baseline gap-1.5">
                <span className="stat tabular-nums">{number(sleep)}</span>
                <span className="text-muted">min</span>
              </div>
            )}
          </Card>

          <Card title={t("set.device")}>
            <Dl
              rows={[
                [t("set.model"), device.model ?? "—"],
                [t("set.productName"), device.productName || "—"],
                [t("set.connection"), "USB · WebHID"],
                [t("set.uuid"), device.uuid ?? "—", true],
                [t("set.firmware"), device.firmware === null ? "—" : formatFirmware(device.firmware), true],
                [t("set.precision"), device.precision ? t("set.precisionValue", { value: mm(device.precision.distance) }) : "—"],
                [t("set.pollingSaved"), savedHz === undefined ? "—" : `${number(savedHz)} Hz`],
                [t("set.readAt"), date(snapshot.readAt)],
              ]}
            />
            {snapshot.errors.length > 0 && (
              <Note tone="warn" className="mt-4">
                <strong className="font-semibold">{t("set.errors")}</strong>{" "}
                {snapshot.errors.map((error) => stepLabel(error.step)).join(", ")}
              </Note>
            )}
          </Card>
        </div>
      </div>
    </PageBody>
  );
}
