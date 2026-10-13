import { useShallow } from "zustand/react/shallow";
import { Icon } from "../components/icons";
import { Button, cx, Note } from "../components/ui";
import { LAYOUT } from "../data/layout";
import { isWebHidSupported } from "../hid/devices";
import { useI18n } from "../i18n";
import { pickBackup } from "../lib/backup";
import { WASD } from "../lib/selection";
import { useDriver } from "../store/driver";
import { useStepLabel } from "./common";

const WIDTH = Math.max(...LAYOUT.map((key) => key.x + key.w));
const HEIGHT = Math.max(...LAYOUT.map((key) => key.y + key.h));
const UDEV_RULE = 'SUBSYSTEM=="hidraw", ATTRS{idVendor}=="372e", ATTRS{idProduct}=="103e", MODE="0660", TAG+="uaccess"';

/** Keyboard outline with W A S D lit. */
function Silhouette() {
  return (
    <div className="sil mb-8 max-w-[520px]" aria-hidden="true">
      {LAYOUT.map((key) => (
        <span
          key={key.pos}
          className={cx(WASD.includes(key.pos) && "hot")}
          style={{
            left: `${(key.x / WIDTH) * 100}%`,
            top: `${(key.y / HEIGHT) * 100}%`,
            width: `${(key.w / WIDTH) * 100}%`,
            height: `${(key.h / HEIGHT) * 100}%`,
          }}
        >
          <i />
        </span>
      ))}
    </div>
  );
}

function Progress() {
  const { t } = useI18n();
  const progress = useDriver((s) => s.progress);
  const label = useStepLabel()(progress?.step ?? "uuid");
  const percent = progress ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div role="status" aria-live="polite">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="font-semibold">{t("progress.reading")}</span>
        <span className="font-mono text-accent-light tabular-nums">{percent}%</span>
      </div>
      <div className="prog" role="progressbar" aria-label={t("progress.reading")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <div style={{ width: `${percent}%` }} />
      </div>
      <p className="cap mt-3 mb-0">{label}</p>
    </div>
  );
}

/** Shown on data pages until there is something to show: a keyboard, a backup or the demo. */
export function WelcomePage() {
  const { t } = useI18n();
  const { status, connect, startDemo } = useDriver(useShallow((s) => ({ status: s.status, connect: s.connect, startDemo: s.startDemo })));
  const supported = isWebHidSupported();
  const busy = status === "connecting" || status === "reading";

  return (
    <div className="flex min-h-full flex-col">
      <div className="welcome">
        <Silhouette />
        <h1>{t("welcome.title")}</h1>
        <p className="lead">{t("welcome.lead")}</p>

        <section className="wcard" aria-labelledby="welcome-start">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="welcome-start" className="ct">
              {t("welcome.before")}
            </h2>
            <span className={cx("chk", supported ? "ok" : "bad")} role="status">
              <Icon name={supported ? "check" : "x"} size="s" />
              {t(supported ? "welcome.browserOk" : "welcome.browserBad")}
            </span>
          </div>

          {busy ? (
            <div className="mt-5">
              <Progress />
            </div>
          ) : (
            <>
              <ol className="steps mt-5">
                <li>
                  <span className="stn" aria-hidden="true">
                    1
                  </span>
                  <div>
                    <div className="font-medium text-fg">{t("welcome.step1")}</div>
                    <div className="cap">{t("welcome.step1Cap")}</div>
                  </div>
                </li>
                <li>
                  <span className="stn" aria-hidden="true">
                    2
                  </span>
                  <div>
                    <div className="font-medium text-fg">{t("welcome.step2")}</div>
                    <div className="cap">{t("welcome.step2Cap")}</div>
                  </div>
                </li>
              </ol>
              {!supported && (
                <Note tone="bad" className="mb-4">
                  {window.isSecureContext ? t("welcome.unsupported") : t("welcome.insecure")}
                </Note>
              )}
              <Button variant="pri" className="lg" onClick={() => void connect()} disabled={!supported}>
                <Icon name="plug" />
                {t("action.connectKeyboard")}
              </Button>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button onClick={pickBackup}>
                  <Icon name="upload" size="s" />
                  {t("action.openBackup")}
                </Button>
                <Button onClick={startDemo}>
                  <Icon name="play" size="s" />
                  {t("action.demo")}
                </Button>
              </div>
              {supported && <p className="cap mt-4 mb-0 text-center">{t("welcome.autoConnect")}</p>}
            </>
          )}
        </section>

        <details className="disc mt-4 max-w-[520px]">
          <summary>
            <Icon name="help" size="s" className="text-accent-light" />
            {t("welcome.trouble")}
            <Icon name="chevron" size="s" className="chev" />
          </summary>
          <ul>
            <li>
              <strong>{t("welcome.trouble1Title")}</strong> {t("welcome.trouble1")}
            </li>
            <li>
              <strong>{t("welcome.trouble2Title")}</strong> {t("welcome.trouble2")}
            </li>
            <li>
              <strong>{t("welcome.trouble3Title")}</strong> {t("welcome.trouble3")}
              <code className="code">{UDEV_RULE}</code>
            </li>
          </ul>
        </details>
      </div>
      <footer className="wfoot">
        <p className="cap mx-auto my-0 max-w-[70ch]">{t("welcome.disclaimer")}</p>
      </footer>
    </div>
  );
}
