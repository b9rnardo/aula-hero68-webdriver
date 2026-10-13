import { useEffect, type ReactNode } from "react";
import { AppShell } from "./components/AppShell";
import type { KeyboardSnapshot } from "./hid/snapshot";
import { useI18n } from "./i18n";
import { PAGES, usePage, type PageId } from "./navigation";
import { ActuationPage } from "./pages/ActuationPage";
import { AdvancedPage } from "./pages/AdvancedPage";
import { DeadZonePage } from "./pages/DeadZonePage";
import { DiagnosticsPage, HelpPage, InterfacePage } from "./pages/DriverPages";
import { LightingPage } from "./pages/LightingPage";
import { OverviewPage } from "./pages/OverviewPage";
import { ProfilesPage } from "./pages/ProfilesPage";
import { RapidTriggerPage } from "./pages/RapidTriggerPage";
import { RemapPage } from "./pages/RemapPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SwitchPage } from "./pages/SwitchPage";
import { WelcomePage } from "./pages/WelcomePage";
import { useDriver, watchConnections } from "./store/driver";

const DATA_PAGES: Partial<Record<PageId, (props: { snapshot: KeyboardSnapshot }) => ReactNode>> = {
  overview: OverviewPage,
  profiles: ProfilesPage,
  actuation: ActuationPage,
  rapidTrigger: RapidTriggerPage,
  deadZone: DeadZonePage,
  switch: SwitchPage,
  remap: RemapPage,
  advanced: AdvancedPage,
  lighting: LightingPage,
  settings: SettingsPage,
};

export default function App() {
  const { t, lang } = useI18n();
  const snapshot = useDriver((s) => s.snapshot);
  const page = usePage();

  useEffect(() => watchConnections(), []);
  useEffect(() => {
    document.documentElement.lang = lang === "pt" ? "pt-BR" : "en";
  }, [lang]);
  const title = `${t(PAGES[page].label)} · HERO 68 HE Web Driver`;
  useEffect(() => {
    document.title = title;
  }, [title]);

  const DataPage = DATA_PAGES[page];
  let content: ReactNode;
  if (PAGES[page].needsData && !snapshot) content = <WelcomePage />;
  else if (DataPage && snapshot) content = <DataPage snapshot={snapshot} />;
  else if (page === "interface") content = <InterfacePage />;
  else if (page === "diagnostics") content = <DiagnosticsPage />;
  else content = <HelpPage />;

  return <AppShell page={page}>{content}</AppShell>;
}
