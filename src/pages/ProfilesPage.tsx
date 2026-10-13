import { useRef } from "react";
import { Page } from "../components/KeyboardStage";
import { DownloadIcon, UploadIcon } from "../components/icons";
import { Badge, Button, Card, cx, InfoNotice } from "../components/ui";
import { PROFILE_COUNT } from "../hid/hero68";
import { downloadJson, snapshotFileName, type KeyboardSnapshot } from "../hid/snapshot";
import { useI18n } from "../i18n";
import { useDriver } from "../store/driver";

/** Hidden file input behind a regular button. */
export function OpenBackupButton({ variant = "secondary", size = "md" }: { variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" | "lg" }) {
  const { t } = useI18n();
  const openBackup = useDriver((s) => s.openBackup);
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button variant={variant} size={size} onClick={() => input.current?.click()}>
        <UploadIcon size={16} />
        {t("action.openBackup")}
      </Button>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void openBackup(file);
          event.target.value = "";
        }}
      />
    </>
  );
}

export function ProfilesPage({ snapshot }: { snapshot: KeyboardSnapshot }) {
  const { t } = useI18n();
  const source = useDriver((s) => s.source);
  const active = snapshot.profile.active;

  return (
    <Page title={t("profiles.title")} help={t("profiles.help")}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("profile.listTitle")} highlight>
          <ul className="space-y-2">
            {Array.from({ length: PROFILE_COUNT }, (_, index) => {
              const isActive = index === active;
              return (
                <li
                  key={index}
                  className={cx("flex items-center gap-4 rounded-md p-3", isActive ? "bg-active ring-1 ring-accent/50" : "bg-hover")}
                >
                  <span
                    className={cx(
                      "grid size-10 shrink-0 place-items-center rounded-md text-lg font-bold",
                      isActive ? "bg-accent text-accent-ink shadow-[0_0_16px_rgb(124_58_237/0.6)]" : "bg-key text-muted",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{t("profile.n", { n: index + 1 })}</span>
                    <span className="block truncate text-sm text-muted">{snapshot.profile.names[index] || t("profile.unnamed")}</span>
                  </span>
                  {isActive && <Badge tone="accent">{t("profile.active")}</Badge>}
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs text-subtle">{t("profile.switchSoon")}</p>
        </Card>

        <div className="grid gap-4">
          <Card title={t("profiles.backupTitle")} description={t("profiles.backupDesc")}>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                onClick={() => downloadJson(snapshot, snapshotFileName(snapshot))}
                disabled={source === "demo"}
              >
                <DownloadIcon size={16} />
                {t("action.downloadBackup")}
              </Button>
            </div>
            {active !== null && <p className="mt-4 text-xs text-subtle">{t("profiles.backupNote", { n: active + 1 })}</p>}
          </Card>
          <Card title={t("profiles.openTitle")} description={t("profiles.openDesc")}>
            <div>
              <OpenBackupButton />
            </div>
          </Card>
        </div>

        <Card title={t("profiles.officialTitle")} className="lg:col-span-2">
          <ol className="space-y-3">
            {(["profiles.official1", "profiles.official2", "profiles.official3"] as const).map((key, index) => (
              <li key={key} className="flex gap-3 text-sm leading-relaxed text-fg-2">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-active text-xs font-bold text-accent">{index + 1}</span>
                {t(key)}
              </li>
            ))}
          </ol>
          <div className="mt-4">
            <InfoNotice>{t("profiles.official4")}</InfoNotice>
          </div>
        </Card>
      </div>
    </Page>
  );
}
