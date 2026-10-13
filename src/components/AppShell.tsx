import { useEffect, useRef, useState, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { isWebHidSupported } from "../hid/devices";
import { PROFILE_COUNT } from "../hid/hero68";
import { downloadJson, snapshotFileName } from "../hid/snapshot";
import { useI18n, type MessageKey } from "../i18n";
import { GROUPS, PAGES, SECTIONS, navigate, type Group, type PageId } from "../navigation";
import { useDriver } from "../store/driver";
import { ChevronDownIcon, CloseIcon, DownloadIcon, GlobeIcon, LockIcon, Logo, PlugIcon, RefreshIcon } from "./icons";
import { Button, cx } from "./ui";

const VERSION = "0.1.0";

/** Remembers the last page visited in each rail group. */
const lastPage: Record<Group, PageId> = { keyboard: "quick", settings: "general", help: "help" };

function useStatus(): { key: MessageKey; tone: "ok" | "warn" | "accent" | "danger" | "idle" } {
  const { status, source, keyboard } = useDriver(useShallow((s) => ({ status: s.status, source: s.source, keyboard: s.keyboard })));
  if (status === "connecting") return { key: "status.connecting", tone: "warn" };
  if (status === "reading") return { key: "status.reading", tone: "warn" };
  if (status === "error") return { key: "status.error", tone: "danger" };
  if (keyboard) return { key: "status.connected", tone: "ok" };
  if (source === "demo") return { key: "status.demo", tone: "accent" };
  if (source === "file") return { key: "status.file", tone: "accent" };
  return { key: "status.disconnected", tone: "idle" };
}

function StatusDot({ tone }: { tone: ReturnType<typeof useStatus>["tone"] }) {
  return (
    <span
      className={cx(
        "size-2 shrink-0 rounded-full",
        tone === "ok" && "bg-ok shadow-[0_0_8px_var(--color-ok)]",
        tone === "warn" && "animate-pulse bg-warn",
        tone === "accent" && "bg-accent",
        tone === "danger" && "bg-danger",
        tone === "idle" && "bg-subtle",
      )}
    />
  );
}

function Rail({ group }: { group: Group }) {
  const { t, lang } = useI18n();
  const setLang = useDriver((s) => s.setLang);
  return (
    <nav aria-label="Menu" className="hidden w-[76px] shrink-0 flex-col items-center gap-1 py-4 lg:flex">
      <div className="mb-5 text-accent drop-shadow-[0_0_10px_rgb(124_58_237/0.6)]">
        <Logo size={32} />
      </div>
      {GROUPS.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => navigate(lastPage[id])}
          aria-current={group === id ? "true" : undefined}
          className={cx(
            "flex w-16 flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-semibold transition-colors",
            group === id ? "bg-active text-fg" : "text-muted hover:bg-hover hover:text-fg",
          )}
        >
          <Icon size={22} />
          {t(label)}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setLang(lang === "pt" ? "en" : "pt")}
        title={`${t("interface.language")}: ${lang === "pt" ? "English" : "Português"}`}
        className="mt-auto flex w-16 flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-bold text-muted hover:bg-hover hover:text-fg"
      >
        <GlobeIcon size={20} />
        {lang === "pt" ? "PT-BR" : "EN"}
      </button>
    </nav>
  );
}

function NavItem({ id, current, disabled }: { id: PageId; current: boolean; disabled: boolean }) {
  const { t } = useI18n();
  const Icon = PAGES[id].icon;
  return (
    <li>
      <button
        type="button"
        onClick={() => navigate(id)}
        disabled={disabled}
        aria-current={current ? "page" : undefined}
        className={cx(
          "flex w-full items-center gap-3 rounded-md px-4 py-1.5 text-left text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35",
          current ? "bg-active text-fg" : "text-muted enabled:hover:bg-hover enabled:hover:text-fg",
        )}
      >
        <Icon size={18} />
        {t(`nav.${id}` as MessageKey)}
      </button>
    </li>
  );
}

function Sidebar({ page, group }: { page: PageId; group: Group }) {
  const { t } = useI18n();
  const snapshot = useDriver((s) => s.snapshot);
  const status = useStatus();
  const title = GROUPS.find((g) => g.id === group)!.title;

  return (
    <aside className="my-2 hidden w-[224px] shrink-0 xl:w-[256px] flex-col rounded-lg bg-panel p-4 lg:flex">
      <div className="mb-5 flex items-center gap-3 rounded-lg bg-field p-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-md bg-key text-accent">
          <Logo size={24} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{snapshot?.device.model ?? "HERO 68 HE"}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <StatusDot tone={status.tone} />
            {t(status.key)}
          </p>
        </div>
      </div>

      <p className="mb-3 px-1 text-base font-bold">{t(title)}</p>
      <div className="-mx-1 flex-1 overflow-y-auto px-1">
        {SECTIONS[group].map((section, index) => (
          <div key={index} className={index ? "mt-5" : ""}>
            {section.label && <p className="eyebrow mb-1.5 px-4 font-semibold text-subtle">{t(section.label)}</p>}
            <ul className="space-y-0.5">
              {section.pages.map((id) => (
                <NavItem key={id} id={id} current={page === id} disabled={PAGES[id].needsData && !snapshot} />
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2 border-t border-line pt-4">
        <p className="flex items-center gap-2 text-xs font-semibold text-muted" title={t("app.readOnlyHint")}>
          <LockIcon size={14} />
          {t("app.readOnly")}
        </p>
        <p className="text-xs text-subtle">
          {t("app.subtitle")} v{VERSION}
        </p>
      </div>
    </aside>
  );
}

function ProfileMenu() {
  const { t } = useI18n();
  const snapshot = useDriver((s) => s.snapshot);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => !ref.current?.contains(event.target as Node) && setOpen(false);
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  if (!snapshot) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-accent lg:hidden">
          <Logo size={26} />
        </span>
        <p className="text-base font-bold">HERO 68 HE</p>
      </div>
    );
  }

  const active = snapshot.profile.active;
  const name = (index: number) => snapshot.profile.names[index] || null;

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex min-w-0 items-center gap-3 rounded-lg py-1.5 pr-3 pl-2 hover:bg-hover"
      >
        <span className="size-3 shrink-0 rounded-full bg-accent shadow-[0_0_14px_4px_rgb(124_58_237/0.75)]" />
        <span className="min-w-0 text-left">
          <span className="block truncate text-base leading-tight font-bold">
            {active === null ? "—" : t("profile.n", { n: active + 1 })}
          </span>
          {active !== null && name(active) && <span className="block truncate text-xs text-muted">{name(active)}</span>}
        </span>
        <ChevronDownIcon size={16} className={cx("shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-30 mt-2 w-72 rounded-lg bg-field p-2 shadow-2xl shadow-black/50 ring-1 ring-line">
          <p className="eyebrow px-3 pt-1 pb-2 text-subtle">{t("profile.listTitle")}</p>
          <ul className="space-y-0.5">
            {Array.from({ length: PROFILE_COUNT }, (_, index) => (
              <li
                key={index}
                className={cx(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                  index === active ? "bg-active font-semibold text-fg" : "text-muted",
                )}
              >
                <span className={cx("size-2 rounded-full", index === active ? "bg-accent" : "bg-key-line")} />
                <span className="flex-1">
                  {t("profile.n", { n: index + 1 })}
                  <span className="ml-2 text-xs text-subtle">{name(index) ?? ""}</span>
                </span>
                {index === active && <span className="eyebrow text-accent">{t("profile.active")}</span>}
              </li>
            ))}
          </ul>
          <p className="px-3 pt-2 pb-1 text-xs leading-relaxed text-subtle">{t("profile.switchSoon")}</p>
        </div>
      )}
    </div>
  );
}

function TopBar() {
  const { t } = useI18n();
  const status = useStatus();
  const { snapshot, source, keyboard, busy, connect, disconnect, refresh, closeSnapshot } = useDriver(
    useShallow((s) => ({
      snapshot: s.snapshot,
      source: s.source,
      keyboard: s.keyboard,
      busy: s.status === "connecting" || s.status === "reading",
      connect: s.connect,
      disconnect: s.disconnect,
      refresh: s.refresh,
      closeSnapshot: s.closeSnapshot,
    })),
  );

  return (
    <header className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
      <ProfileMenu />
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 hidden items-center gap-2 text-sm font-semibold text-muted sm:flex">
          <StatusDot tone={status.tone} />
          {t(status.key)}
        </span>
        {keyboard && (
          <Button variant="ghost" size="sm" onClick={() => void refresh()} disabled={busy} title={t("action.refresh")}>
            <RefreshIcon size={16} className={busy ? "animate-spin" : undefined} />
            <span className="hidden md:inline">{t("action.refresh")}</span>
          </Button>
        )}
        {snapshot && source === "device" && (
          <Button variant="ghost" size="sm" onClick={() => downloadJson(snapshot, snapshotFileName(snapshot))} title={t("action.downloadBackup")}>
            <DownloadIcon size={16} />
            <span className="hidden md:inline">{t("action.downloadBackup")}</span>
          </Button>
        )}
        {source === "file" && (
          <Button variant="ghost" size="sm" onClick={closeSnapshot}>
            <CloseIcon size={16} />
            <span className="hidden sm:inline">{t("action.closeBackup")}</span>
          </Button>
        )}
        {source === "demo" ? (
          <Button variant="primary" size="sm" onClick={closeSnapshot}>
            {t("action.exitDemo")}
          </Button>
        ) : keyboard ? (
          <Button variant="secondary" size="sm" onClick={() => void disconnect()}>
            {t("action.disconnect")}
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={() => void connect()} disabled={busy || !isWebHidSupported()}>
            <PlugIcon size={16} />
            {t("action.connect")}
          </Button>
        )}
      </div>
    </header>
  );
}

function ReadBar() {
  const progress = useDriver((s) => s.progress);
  const reading = useDriver((s) => s.status === "reading");
  if (!reading) return null;
  const percent = progress ? (progress.done / progress.total) * 100 : 2;
  return (
    <div className="h-0.5 bg-transparent" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full bg-accent shadow-[0_0_8px_var(--color-glow)] transition-[width] duration-300" style={{ width: `${percent}%` }} />
    </div>
  );
}

function MobileNav({ page }: { page: PageId }) {
  const { t } = useI18n();
  const snapshot = useDriver((s) => s.snapshot);
  const ids = GROUPS.flatMap(({ id }) => SECTIONS[id].flatMap((section) => section.pages));
  return (
    <nav aria-label="Menu" className="overflow-x-auto px-4 pb-2 sm:px-6 lg:hidden">
      <ul className="flex gap-1">
        {ids.map((id) => {
          const Icon = PAGES[id].icon;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => navigate(id)}
                disabled={PAGES[id].needsData && !snapshot}
                aria-current={page === id ? "page" : undefined}
                className={cx(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold whitespace-nowrap disabled:opacity-35",
                  page === id ? "bg-active text-fg" : "text-muted",
                )}
              >
                <Icon size={16} />
                {t(`nav.${id}` as MessageKey)}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Wootility-like frame: icon rail, section sidebar, profile bar and the scrolling page. */
export function AppShell({ page, children }: { page: PageId; children: ReactNode }) {
  const group = PAGES[page].group;
  lastPage[group] = page;

  return (
    <div className="lg:flex lg:h-dvh lg:pr-2">
      <Rail group={group} />
      <Sidebar page={page} group={group} />
      <div className="flex min-w-0 flex-1 flex-col lg:pl-2">
        <div className="sticky top-0 z-20 bg-app lg:static">
          <TopBar />
          <MobileNav page={page} />
          <ReadBar />
        </div>
        <main id="main" className="flex-1 px-4 sm:px-6 lg:overflow-y-auto">
          <div className="mx-auto w-full max-w-[1200px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
