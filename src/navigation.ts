import { useEffect, useState, type ComponentType } from "react";
import {
  ActuationIcon,
  AdvancedIcon,
  DeadZoneIcon,
  DiagnosticsIcon,
  GlobeIcon,
  HelpIcon,
  KeyboardIcon,
  LightIcon,
  ProfilesIcon,
  QuickIcon,
  RapidTriggerIcon,
  RemapIcon,
  SettingsIcon,
} from "./components/icons";
import type { MessageKey } from "./i18n";

export type Group = "keyboard" | "settings" | "help";

export const PAGE_IDS = [
  "quick",
  "profiles",
  "actuation",
  "rapidTrigger",
  "deadZone",
  "remap",
  "advanced",
  "lighting",
  "general",
  "interface",
  "diagnostics",
  "help",
] as const;
export type PageId = (typeof PAGE_IDS)[number];

export interface PageDef {
  id: PageId;
  group: Group;
  icon: ComponentType<{ size?: number }>;
  /** Needs keyboard data (a read, a backup or the demo). */
  needsData: boolean;
}

export const PAGES: Record<PageId, PageDef> = {
  quick: { id: "quick", group: "keyboard", icon: QuickIcon, needsData: true },
  profiles: { id: "profiles", group: "keyboard", icon: ProfilesIcon, needsData: true },
  actuation: { id: "actuation", group: "keyboard", icon: ActuationIcon, needsData: true },
  rapidTrigger: { id: "rapidTrigger", group: "keyboard", icon: RapidTriggerIcon, needsData: true },
  deadZone: { id: "deadZone", group: "keyboard", icon: DeadZoneIcon, needsData: true },
  remap: { id: "remap", group: "keyboard", icon: RemapIcon, needsData: true },
  advanced: { id: "advanced", group: "keyboard", icon: AdvancedIcon, needsData: true },
  lighting: { id: "lighting", group: "keyboard", icon: LightIcon, needsData: true },
  general: { id: "general", group: "settings", icon: SettingsIcon, needsData: true },
  interface: { id: "interface", group: "settings", icon: GlobeIcon, needsData: false },
  diagnostics: { id: "diagnostics", group: "settings", icon: DiagnosticsIcon, needsData: false },
  help: { id: "help", group: "help", icon: HelpIcon, needsData: false },
};

/** Sidebar sections per rail group; a null label renders the items without a heading. */
export const SECTIONS: Record<Group, { label: MessageKey | null; pages: PageId[] }[]> = {
  keyboard: [
    { label: null, pages: ["quick"] },
    { label: "sidebar.profiles", pages: ["profiles"] },
    { label: "sidebar.keyboardConfig", pages: ["actuation", "rapidTrigger", "deadZone", "remap", "advanced", "lighting"] },
  ],
  settings: [
    { label: "sidebar.keyboardSettings", pages: ["general"] },
    { label: "sidebar.driver", pages: ["interface", "diagnostics"] },
  ],
  help: [{ label: null, pages: ["help"] }],
};

export const GROUPS: { id: Group; icon: ComponentType<{ size?: number }>; label: MessageKey; title: MessageKey }[] = [
  { id: "keyboard", icon: KeyboardIcon, label: "rail.keyboard", title: "sidebar.keyboardTitle" },
  { id: "settings", icon: SettingsIcon, label: "rail.settings", title: "sidebar.settingsTitle" },
  { id: "help", icon: HelpIcon, label: "rail.help", title: "sidebar.helpTitle" },
];

const pageFromHash = (): PageId => {
  const hash = window.location.hash.replace(/^#\/?/, "");
  return (PAGE_IDS as readonly string[]).includes(hash) ? (hash as PageId) : "quick";
};

/** Current page, kept in the URL hash so reloads and the back button work. */
export function usePage() {
  const [page, setPage] = useState<PageId>(pageFromHash);
  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return [page, (next: PageId) => (window.location.hash = next)] as const;
}

export const navigate = (page: PageId) => (window.location.hash = page);
