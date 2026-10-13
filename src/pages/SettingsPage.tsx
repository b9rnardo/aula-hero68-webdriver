import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Page } from "../components/KeyboardStage";
import { LockIcon } from "../components/icons";
import { Card, Notice, OptionRow, Row, SettingRow } from "../components/ui";
import { SavedNote, Toggle } from "../components/WriteControls";
import { POLLING_HZ, sleepMinutes } from "../data/lighting";
import { formatFirmware, type KeyboardSnapshot } from "../hid/snapshot";
import { useI18n, type MessageKey } from "../i18n";
import { canWrite, useDriver, type ToggleSetting } from "../store/driver";

const TOGGLES = [
  ["winLock", "settings.winLock", "settings.winLockDesc"],
  ["macMode", "settings.macMode", "settings.macModeDesc"],
  ["keyCombo", "settings.keyCombo", "settings.keyComboDesc"],
  ["autoCalibrate", "settings.autoCalibrate", "settings.autoCalibrateDesc"],
] as const satisfies readonly [ToggleSetting, MessageKey, MessageKey][];

/** Polling levels from fastest to slowest. */
const POLLING_ORDER = POLLING_HZ.map((hz, level) => ({ hz, level })).sort((a, b) => b.hz - a.hz);

export function SettingsPage({ snapshot }: { snapshot: KeyboardSnapshot }) {
  const { t, number, date } = useI18n();
  const { settings, device } = snapshot;
  const sleep = settings.sleepLevel === null ? undefined : sleepMinutes(settings.sleepLevel);
  const { source, writing, writable, setSetting, setPolling } = useDriver(
    useShallow((s) => ({ source: s.source, writing: s.writing, writable: canWrite(s), setSetting: s.setSetting, setPolling: s.setPolling })),
  );
  const disabled = !writable || writing;
  // Backups only show the values; while reconnecting the controls stay in place, disabled.
  const editable = source !== "file";

  /** Which setting was just written, for the confirmation next to it. */
  const [saved, setSaved] = useState<ToggleSetting | "polling" | null>(null);
  const [pollingTo, setPollingTo] = useState<number | null>(null);
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(null), 2500);
    return () => clearTimeout(timer);
  }, [saved]);

  const choosePolling = async (level: number) => {
    if (disabled || level === settings.pollingLevel) return;
    setSaved(null);
    setPollingTo(level);
    const ok = await setPolling(level);
    setPollingTo(null);
    if (ok) setSaved("polling");
  };
  const toggle = async (key: ToggleSetting, on: boolean) => {
    setSaved(null);
    if (await setSetting(key, on)) setSaved(key);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Page title={t("settings.title")}>
        <div className="space-y-4">
          {source === "file" && <Notice icon={<LockIcon size={16} />}>{t("write.connectToWrite")}</Notice>}

          <Card
            title={t("settings.polling")}
            description={t("settings.pollingDesc")}
            actions={
              pollingTo !== null ? (
                <span role="status" className="text-sm font-semibold text-warn">
                  {t("settings.pollingReconnecting")}
                </span>
              ) : (
                saved === "polling" && <SavedNote demo={source === "demo"} />
              )
            }
          >
            <ul role="radiogroup" aria-label={t("settings.polling")} className="grid gap-1.5 sm:grid-cols-2">
              {POLLING_ORDER.map(({ hz, level }) => (
                <OptionRow
                  key={level}
                  selected={(pollingTo ?? settings.pollingLevel) === level}
                  disabled={disabled}
                  onSelect={editable ? () => void choosePolling(level) : undefined}
                >
                  {number(hz)} Hz
                </OptionRow>
              ))}
            </ul>
            {editable && <p className="mt-3 text-xs text-subtle">{t("settings.pollingNote")}</p>}
          </Card>

          <Card>
            {TOGGLES.map(([key, title, description]) => (
              <SettingRow key={key} title={t(title)} description={t(description)}>
                <span className="flex items-center gap-3 text-sm font-semibold text-muted">
                  {saved === key ? <SavedNote demo={source === "demo"} /> : settings[key] === null ? t("value.unknown") : settings[key] ? t("value.on") : t("value.off")}
                  <Toggle on={settings[key]} label={t(title)} disabled={disabled || settings[key] === null} onChange={(on) => void toggle(key, on)} />
                </span>
              </SettingRow>
            ))}
            <SettingRow title={t("settings.sleep")} description={t("settings.sleepDesc")}>
              <span className="text-sm font-bold text-accent">
                {sleep === undefined ? t("value.unknown") : sleep === null ? t("settings.sleepNever") : t("settings.sleepMinutes", { n: number(sleep) })}
              </span>
            </SettingRow>
          </Card>

          <Card title={t("settings.firmwareTitle")}>
            <dl>
              <Row label={t("settings.model")}>{device.model ?? t("value.unknown")}</Row>
              <Row label={t("settings.productName")}>{device.productName}</Row>
              <Row label={t("settings.uuid")} mono>
                {device.uuid ?? t("value.unknown")}
              </Row>
              <Row label={t("settings.firmware")} mono>
                {device.firmware === null ? t("value.unknown") : formatFirmware(device.firmware)}
              </Row>
              <Row label={t("settings.precision")}>
                {device.precision ? t("settings.precisionValue", { value: number(device.precision.distance / 1000) }) : t("value.unknown")}
              </Row>
              <Row label={t("settings.readAtLabel")}>{date(snapshot.readAt)}</Row>
            </dl>
            {snapshot.errors.length > 0 && (
              <div className="mt-4">
                <Notice tone="warn">
                  <p className="font-semibold">{t("settings.errors")}</p>
                  <p className="mt-1">{t("settings.errorsHint")}</p>
                  <ul className="mt-2 font-mono text-xs">
                    {snapshot.errors.map((error) => (
                      <li key={error.step}>
                        {error.step}: {error.message}
                      </li>
                    ))}
                  </ul>
                </Notice>
              </div>
            )}
          </Card>
        </div>
      </Page>
    </div>
  );
}
