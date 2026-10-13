/** 24×24 stroke paths; several subpaths are separated by " M". */
export const ICONS = {
  overview: "M4 4h6.5v6.5H4z M13.5 4H20v6.5h-6.5z M4 13.5h6.5V20H4z M13.5 13.5H20V20h-6.5z",
  profiles: "M12 3 3 7.5 12 12l9-4.5L12 3Z M3 12l9 4.5 9-4.5 M3 16.5 12 21l9-4.5",
  actuation: "M12 3.5v11 M7.5 10 12 14.5 16.5 10 M5 20h14",
  rapidTrigger: "M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z",
  deadZone: "M4 5h16 M4 19h16 M8 9.5h8 M8 14.5h8",
  switch: "M9 3.5h6v5H9z M4.5 8.5h15v8h-15z M8 16.5v4 M16 16.5v4",
  calibrate: "M12 3v3 M12 18v3 M3 12h3 M18 12h3 M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z M12 11.5v1",
  remap: "M7 7h11 M15 4l3 3-3 3 M17 17H6 M9 14l-3 3 3 3",
  advanced: "M5 4v16 M12 4v16 M19 4v16 M3 8h4 M10 15h4 M17 10h4",
  lighting:
    "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z M12 2.5v2 M12 19.5v2 M5.3 5.3l1.4 1.4 M17.3 17.3l1.4 1.4 M2.5 12h2 M19.5 12h2 M5.3 18.7l1.4-1.4 M17.3 6.7l1.4-1.4",
  settings: "M4 7h9 M17 7h3 M4 17h3 M11 17h9 M15 5v4 M9 15v4",
  interface: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M3 12h18 M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3Z",
  diagnostics: "M3 12h4l2.5-6 5 12 2.5-6h4",
  help: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.7 M12 17.2v.1",
  select: "M4 9V4h5 M15 4h5v5 M20 15v5h-5 M9 20H4v-5",
  download: "M12 4v10 M8 10l4 4 4-4 M5 15v4h14v-4",
  upload: "M12 15V5 M8 9l4-4 4 4 M5 15v4h14v-4",
  undo: "M9 14 4 9l5-5 M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
  x: "M6 6l12 12 M18 6 6 18",
  collapse: "M11 6l-6 6 6 6 M19 6l-6 6 6 6",
  expand: "M5 6l6 6-6 6 M13 6l6 6-6 6",
  info: "M12 11v6 M12 7.5v.01",
  note: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M12 11v5 M12 8v.01",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  lock: "M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5 M5.5 10.5h13v10h-13z",
  warn: "M10.3 4.2 2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z M12 9.5v4.5 M12 17h.01",
  check: "M5 12.5l4.5 4.5L19 7.5",
  search: "M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Z M20 20l-4.8-4.8",
  plug: "M9 7V3 M15 7V3 M7 7h10v4a5 5 0 0 1-10 0V7Z M12 16v5",
  play: "M8 5.5v13l10-6.5-10-6.5Z",
  chevron: "M6 9l6 6 6-6",
  minus: "M6 12h12",
  plus: "M12 6v12 M6 12h12",
  keyboard: "M3 6.5h18v11H3z M7 10h.01 M11 10h.01 M15 10h.01 M7 14h10",
  refresh: "M19.5 12a7.5 7.5 0 1 1-2.2-5.3 M19.5 4.5v4h-4",
  menu: "M4 7h16 M4 12h16 M4 17h16",
  copy: "M9 9h10v10H9z M5 15V5h10",
  trash: "M5 7h14 M10 7V4.5h4V7 M7 7l1 12.5h8L17 7",
  github:
    "M9 19c-4.5 1.4-4.5-2.2-6.3-2.7 M15 21v-3.5a3 3 0 0 0-.8-2.3c2.8-.3 5.8-1.4 5.8-6.2a4.8 4.8 0 0 0-1.3-3.3 4.5 4.5 0 0 0-.1-3.3s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6.2 0C6.6 2.1 5.6 2.4 5.6 2.4a4.5 4.5 0 0 0-.1 3.3A4.8 4.8 0 0 0 4.2 9c0 4.8 3 5.9 5.8 6.2a3 3 0 0 0-.8 2.3V21",
} as const;

export type IconName = keyof typeof ICONS;

/** Decorative by default; pass `label` when the icon is the only content that names something. */
export function Icon({ name, size, className, label }: { name: IconName; size?: "s" | "xs"; className?: string; label?: string }) {
  return (
    <svg
      className={["ic", size, className].filter(Boolean).join(" ")}
      viewBox="0 0 24 24"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

export function Logo() {
  return (
    <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true" className="flex-none">
      <rect x="1" y="1" width="30" height="30" rx="8" fill="#a48bff" />
      <rect x="7" y="8" width="18" height="14" rx="4" fill="#140d24" />
      <rect x="10" y="11" width="12" height="5" rx="2" fill="#a48bff" />
    </svg>
  );
}
