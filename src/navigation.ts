import { useEffect, useState } from "react";
import type { IconName } from "./components/icons";
import type { MessageKey } from "./i18n";

export const PAGE_IDS = [
  "overview",
  "profiles",
  "actuation",
  "rapidTrigger",
  "deadZone",
  "switch",
  "remap",
  "advanced",
  "lighting",
  "settings",
  "interface",
  "diagnostics",
  "help",
] as const;
export type PageId = (typeof PAGE_IDS)[number];

export interface PageDef {
  id: PageId;
  icon: IconName;
  label: MessageKey;
  /** Needs keyboard data (a read, a backup or the demo). */
  needsData: boolean;
  /** Has the keyboard at the top for picking keys. */
  stage: boolean;
  /** Shown but not written to the keyboard yet. */
  readOnly?: boolean;
}

const page = (id: PageId, icon: IconName, needsData: boolean, stage: boolean, readOnly = false): PageDef => ({
  id,
  icon,
  label: `nav.${id}` as MessageKey,
  needsData,
  stage,
  readOnly,
});

export const PAGES: Record<PageId, PageDef> = {
  overview: page("overview", "overview", true, false),
  profiles: page("profiles", "profiles", true, false, true),
  actuation: page("actuation", "actuation", true, true),
  rapidTrigger: page("rapidTrigger", "rapidTrigger", true, true),
  deadZone: page("deadZone", "deadZone", true, true),
  switch: page("switch", "switch", true, true),
  remap: page("remap", "remap", true, true),
  advanced: page("advanced", "advanced", true, true, true),
  lighting: page("lighting", "lighting", true, true),
  settings: page("settings", "settings", true, false),
  interface: page("interface", "interface", false, false),
  diagnostics: page("diagnostics", "diagnostics", false, false),
  help: page("help", "help", false, false),
};

/** Sidebar sections. Help sits apart, at the bottom. */
export const SECTIONS: { label: MessageKey; pages: PageId[] }[] = [
  { label: "nav.section.keyboard", pages: ["overview", "profiles"] },
  { label: "nav.section.performance", pages: ["actuation", "rapidTrigger", "deadZone", "switch"] },
  { label: "nav.section.keys", pages: ["remap", "advanced", "lighting"] },
  { label: "nav.section.system", pages: ["settings", "interface", "diagnostics"] },
];

/** Hashes from the previous layout, so old links and bookmarks still work. */
const LEGACY: Record<string, PageId> = { quick: "overview", general: "settings" };

const pageFromHash = (): PageId => {
  const hash = window.location.hash.replace(/^#\/?/, "");
  if ((PAGE_IDS as readonly string[]).includes(hash)) return hash as PageId;
  return LEGACY[hash] ?? "overview";
};

/** Current page, kept in the URL hash so reloads and the back button work. */
export function usePage() {
  const [current, setCurrent] = useState<PageId>(pageFromHash);
  useEffect(() => {
    const onHash = () => setCurrent(pageFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return current;
}

export const navigate = (id: PageId) => (window.location.hash = id);
