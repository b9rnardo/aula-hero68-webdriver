import { Icon } from "../components/icons";
import { Button, Card, cx, Note, PageBody, PageHeader, Pill, ReadOnlyPill } from "../components/ui";
import { PROFILE_COUNT } from "../hid/hero68";
import type { KeyboardSnapshot } from "../hid/snapshot";
import { useI18n } from "../i18n";
import { downloadBackup, pickBackup } from "../lib/backup";
import { useDriver } from "../store/driver";

const OFFICIAL = ["profiles.official1", "profiles.official2", "profiles.official3"] as const;

/** Read only: switching and renaming profiles wait for a test on the keyboard. */
export function ProfilesPage({ snapshot }: { snapshot: KeyboardSnapshot }) {
  const { t } = useI18n();
  const source = useDriver((s) => s.source);
  const active = snapshot.profile.active;

  return (
    <PageBody>
      <PageHeader title={t("nav.profiles")} />
      <div className="grid2">
        <Card title={t("profiles.list")} info={t("profiles.listInfo")} aside={<ReadOnlyPill />}>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {Array.from({ length: PROFILE_COUNT }, (_, index) => {
              const on = index === active;
              return (
                <li key={index} className={cx("row", on && "on")} aria-current={on || undefined}>
                  <span className="stn" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{t("profiles.n", { n: index + 1 })}</span>
                    <span className="cap block truncate">{snapshot.profile.names[index] || t("profiles.unnamed")}</span>
                  </span>
                  {on && <Pill tone="ok">{t("profiles.active")}</Pill>}
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="stack">
          <Card title={t("profiles.backup")} info={t("profiles.backupInfo")}>
            <div className="flex flex-wrap gap-2">
              <Button variant="pri" onClick={() => downloadBackup(snapshot)} disabled={source !== "device"}>
                <Icon name="download" size="s" />
                {t("action.downloadBackup")}
              </Button>
              <Button onClick={pickBackup}>
                <Icon name="upload" size="s" />
                {t("action.openBackup")}
              </Button>
            </div>
            {source === "device" && active !== null && <p className="cap mt-2 mb-0">{t("profiles.backupNote", { n: active + 1 })}</p>}
          </Card>

          <Card title={t("profiles.official")} info={t("profiles.officialInfo")}>
            <ol className="steps">
              {OFFICIAL.map((key, index) => (
                <li key={key}>
                  <span className="stn" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span>{t(key)}</span>
                </li>
              ))}
            </ol>
            <Note>{t("profiles.official4")}</Note>
          </Card>
        </div>
      </div>
    </PageBody>
  );
}
