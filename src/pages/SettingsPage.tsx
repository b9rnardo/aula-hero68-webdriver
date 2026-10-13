import { Page } from "../components/KeyboardStage";
import { LockIcon } from "../components/icons";
import { Card, Notice, OptionRow, Row, SettingRow, StateSwitch } from "../components/ui";
import { POLLING_HZ, sleepMinutes } from "../data/lighting";
import { formatFirmware, type KeyboardSnapshot } from "../hid/snapshot";
import { useI18n, type MessageKey } from "../i18n";

const TOGGLES = [
  ["winLock", "settings.winLock", "settings.winLockDesc"],
  ["macMode", "settings.macMode", "settings.macModeDesc"],
  ["keyCombo", "settings.keyCombo", "settings.keyComboDesc"],
  ["autoCalibrate", "settings.autoCalibrate", "settings.autoCalibrateDesc"],
] as const satisfies readonly [keyof KeyboardSnapshot["settings"], MessageKey, MessageKey][];

/** Polling levels from fastest to slowest. */
const POLLING_ORDER = POLLING_HZ.map((hz, level) => ({ hz, level })).sort((a, b) => b.hz - a.hz);

export function SettingsPage({ snapshot }: { snapshot: KeyboardSnapshot }) {
  const { t, number, date } = useI18n();
  const { settings, device } = snapshot;
  const sleep = settings.sleepLevel === null ? undefined : sleepMinutes(settings.sleepLevel);

  return (
    <div className="mx-auto max-w-3xl">
      <Page title={t("settings.title")}>
        <div className="space-y-4">
          <Notice icon={<LockIcon size={16} />}>{t("settings.readOnly")}</Notice>

          <Card title={t("settings.polling")} description={t("settings.pollingDesc")}>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {POLLING_ORDER.map(({ hz, level }) => (
                <OptionRow key={level} selected={settings.pollingLevel === level}>
                  {number(hz)} Hz
                </OptionRow>
              ))}
            </ul>
          </Card>

          <Card>
            {TOGGLES.map(([key, title, description]) => (
              <SettingRow key={key} title={t(title)} description={t(description)}>
                <span className="flex items-center gap-3 text-sm font-semibold text-muted">
                  {settings[key] === null ? t("value.unknown") : settings[key] ? t("value.on") : t("value.off")}
                  <StateSwitch on={settings[key] as boolean | null} label={t(title)} />
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
