import { useEffect, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { AppShell } from "./components/AppShell";
import { CloseIcon, InfoIcon } from "./components/icons";
import { cx } from "./components/ui";
import { useI18n } from "./i18n";
import { PAGES, usePage, type PageId } from "./navigation";
import { ActuationPage } from "./pages/ActuationPage";
import { AdvancedPage } from "./pages/AdvancedPage";
import { DeadZonePage } from "./pages/DeadZonePage";
import { DiagnosticsPage, HelpPage, InterfacePage } from "./pages/DriverPages";
import { LightingPage } from "./pages/LightingPage";
import { ProfilesPage } from "./pages/ProfilesPage";
import { QuickPage } from "./pages/QuickPage";
import { RapidTriggerPage } from "./pages/RapidTriggerPage";
import { RemapPage } from "./pages/RemapPage";
import { SettingsPage } from "./pages/SettingsPage";
import { WelcomePage } from "./pages/WelcomePage";
import type { KeyboardSnapshot } from "./hid/snapshot";
import { useDriver, watchConnections } from "./store/driver";

const DATA_PAGES: Partial<Record<PageId, (props: { snapshot: KeyboardSnapshot }) => ReactNode>> = {
  quick: QuickPage,
  profiles: ProfilesPage,
  actuation: ActuationPage,
  rapidTrigger: RapidTriggerPage,
  deadZone: DeadZonePage,
  remap: RemapPage,
  advanced: AdvancedPage,
  lighting: LightingPage,
  general: SettingsPage,
};

function Alerts() {
  const { error, warning, source, dismissError } = useDriver(
    useShallow((s) => ({ error: s.error, warning: s.warning, source: s.source, dismissError: s.dismissError })),
  );
  const { t } = useI18n();
  return (
    <div className="space-y-2 pt-2 empty:hidden">
      {source === "demo" && (
        <p className="flex items-center gap-2 rounded-md bg-active px-4 py-2.5 text-sm font-semibold text-fg-2">
          <InfoIcon size={16} className="shrink-0 text-accent" />
          {t("demo.banner")}
        </p>
      )}
      {(error || warning) && (
        <div
          role="alert"
          className={cx(
            "flex items-start justify-between gap-4 rounded-md px-4 py-2.5 text-sm font-semibold",
            error ? "bg-danger/10 text-danger" : "bg-warn/10 text-warn",
          )}
        >
          <span>{error ?? warning}</span>
          <button type="button" onClick={dismissError} aria-label={t("action.close")} className="shrink-0 opacity-80 hover:opacity-100">
            <CloseIcon size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { lang } = useI18n();
  const snapshot = useDriver((s) => s.snapshot);
  const [page] = usePage();

  useEffect(() => watchConnections(), []);
  useEffect(() => {
    document.documentElement.lang = lang === "pt" ? "pt-BR" : "en";
  }, [lang]);
  useEffect(() => {
    document.getElementById("main")?.scrollTo({ top: 0 });
  }, [page]);

  const DataPage = DATA_PAGES[page];
  let content: ReactNode;
  if (PAGES[page].needsData && !snapshot) content = <WelcomePage />;
  else if (DataPage && snapshot) content = <DataPage snapshot={snapshot} />;
  else if (page === "interface") content = <InterfacePage />;
  else if (page === "diagnostics") content = <DiagnosticsPage />;
  else content = <HelpPage />;

  return (
    <AppShell page={page}>
      <Alerts />
      {content}
    </AppShell>
  );
}
