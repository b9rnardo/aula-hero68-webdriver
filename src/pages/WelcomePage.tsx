import { useShallow } from "zustand/react/shallow";
import { PlugIcon } from "../components/icons";
import { KeyboardView } from "../components/KeyboardView";
import { Button, Notice } from "../components/ui";
import { keyLegend } from "../data/keycodes";
import { isWebHidSupported } from "../hid/devices";
import { useI18n, type MessageKey } from "../i18n";
import { useDriver } from "../store/driver";
import { OpenBackupButton } from "./ProfilesPage";

const TIPS: [MessageKey, MessageKey][] = [
  ["welcome.tipCableTitle", "welcome.tipCable"],
  ["welcome.tipCloseTitle", "welcome.tipClose"],
  ["welcome.tipBackupTitle", "welcome.tipBackup"],
];
const LAYER_NAMES: MessageKey[] = ["layers.0", "layers.1", "layers.2"];

function Progress() {
  const { t } = useI18n();
  const progress = useDriver((s) => s.progress);
  const [step, layer] = (progress?.step ?? "uuid").split(".");
  const label = t(`progress.step.${step}` as MessageKey) + (layer ? ` · ${t(LAYER_NAMES[Number(layer)])}` : "");
  const percent = progress ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div className="mx-auto w-full max-w-md rounded-lg bg-panel p-6" role="status" aria-live="polite">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-bold">{t("progress.reading")}</span>
        <span className="text-sm font-bold text-accent">{percent}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-key-line">
        <div className="h-full rounded-full bg-accent shadow-[0_0_10px_var(--color-glow)] transition-[width] duration-300" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-3 text-sm text-muted">{label}</p>
    </div>
  );
}

export function WelcomePage() {
  const { t } = useI18n();
  const { status, connect, startDemo } = useDriver(useShallow((s) => ({ status: s.status, connect: s.connect, startDemo: s.startDemo })));
  const supported = isWebHidSupported();
  const busy = status === "connecting" || status === "reading";

  return (
    <div className="flex flex-col items-center py-10 text-center sm:py-14">
      <div className="pointer-events-none hidden w-full max-w-3xl opacity-70 sm:block [mask-image:linear-gradient(to_bottom,black_40%,transparent)]" aria-hidden>
        <KeyboardView label="" render={(key) => ({ legend: keyLegend(key.defaults[0]) })} />
      </div>
      <h1 className="text-3xl sm:-mt-6 font-bold tracking-tight sm:text-4xl">{t("welcome.title")}</h1>
      <p className="mt-3 max-w-xl text-base leading-relaxed text-muted">{t("welcome.lead")}</p>

      {busy ? (
        <div className="mt-8 w-full">
          <Progress />
        </div>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button variant="primary" size="lg" onClick={() => void connect()} disabled={!supported}>
              <PlugIcon size={18} />
              {t("action.connect")}
            </Button>
            <OpenBackupButton size="lg" />
            <Button variant="ghost" size="lg" onClick={startDemo}>
              {t("action.demo")}
            </Button>
          </div>
          {!supported && (
            <div className="mt-6 w-full max-w-xl text-left">
              <Notice tone="warn">{window.isSecureContext ? t("welcome.unsupported") : t("welcome.insecure")}</Notice>
            </div>
          )}
        </>
      )}

      <ul className="mt-12 grid w-full max-w-3xl gap-3 text-left sm:grid-cols-3">
        {TIPS.map(([title, text]) => (
          <li key={title} className="rounded-lg bg-panel p-4">
            <p className="text-sm font-bold">{t(title)}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{t(text)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
