import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { POLLING_HZ } from "../data/lighting";
import { isWebHidSupported } from "../hid/devices";
import { useI18n, type MessageKey } from "../i18n";
import { downloadBackup, pickBackup } from "../lib/backup";
import { isTyping, MOD, useMedia } from "../lib/media";
import { LETTERS, WASD } from "../lib/selection";
import { navigate, PAGE_IDS, PAGES, SECTIONS, type PageId } from "../navigation";
import { pendingOf, useDraft, type Pending } from "../store/draft";
import { canWrite, useDriver } from "../store/driver";
import { useUi } from "../store/ui";
import { Icon, Logo, type IconName } from "./icons";
import { Button, cx, Kbd, Note } from "./ui";

// The frame around every page: header, sidebar, banners, the pending bar, the toast and the Ctrl K search.

const usePending = () => {
  const draft = useDraft((s) => s.draft);
  return useMemo(() => pendingOf(draft), [draft]);
};

/** Unsaved changes per sidebar page. */
const countFor = (id: PageId, pending: Pending) =>
  ({ actuation: pending.act, rapidTrigger: pending.rt, deadZone: pending.dz, switch: pending.sw, remap: pending.map, settings: pending.set })[id as string] ?? 0;

function useStatus(): { text: string; led: string } {
  const { t } = useI18n();
  const { status, source, keyboard, progress } = useDriver(
    useShallow((s) => ({ status: s.status, source: s.source, keyboard: s.keyboard, progress: s.progress })),
  );
  if (status === "connecting") return { text: t("status.connecting"), led: "warn" };
  if (status === "reading")
    return { text: progress ? t("status.readingPercent", { n: Math.round((progress.done / progress.total) * 100) }) : t("status.reading"), led: "warn" };
  if (status === "error" && !keyboard) return { text: t("status.error"), led: "bad" };
  if (keyboard) return { text: t("status.connected"), led: "" };
  if (source === "demo") return { text: t("status.demo"), led: "acc" };
  if (source === "file") return { text: t("status.file"), led: "acc" };
  return { text: t("status.disconnected"), led: "off" };
}

function Header() {
  const { t, lang, number } = useI18n();
  const status = useStatus();
  const { snapshot, source, keyboard, busy, connect, disconnect, refresh, closeSnapshot, setLang } = useDriver(
    useShallow((s) => ({
      snapshot: s.snapshot,
      source: s.source,
      keyboard: s.keyboard,
      busy: s.status === "connecting" || s.status === "reading" || s.writing,
      connect: s.connect,
      disconnect: s.disconnect,
      refresh: s.refresh,
      closeSnapshot: s.closeSnapshot,
      setLang: s.setLang,
    })),
  );
  const progress = useDriver((s) => (s.status === "reading" ? s.progress : null));
  const reading = useDriver((s) => s.status === "reading");
  const { drawerOpen, setDrawerOpen, setPaletteOpen } = useUi(
    useShallow((s) => ({ drawerOpen: s.drawerOpen, setDrawerOpen: s.setDrawerOpen, setPaletteOpen: s.setPaletteOpen })),
  );
  const polling = snapshot?.settings.pollingLevel;
  const hz = polling === null || polling === undefined ? undefined : POLLING_HZ[polling];
  const profile = snapshot?.profile.active;
  const canConnect = isWebHidSupported() && !busy;

  return (
    <header className="top">
      <Button variant="gh" ico className="show-s -ml-1" aria-label={t(drawerOpen ? "header.menuClose" : "header.menuOpen")} aria-expanded={drawerOpen} onClick={() => setDrawerOpen(!drawerOpen)}>
        <Icon name={drawerOpen ? "x" : "menu"} />
      </Button>
      <div className="flex flex-none items-center gap-2.5">
        <Logo />
        <div className="brand hide-s">
          <strong>HERO 68 HE</strong>
          <span>Web Driver</span>
        </div>
      </div>
      <div className="vr hide-s" />
      <span className="dev" role="status" title={keyboard ? t("status.connectedTitle") : undefined}>
        <span className={cx("led", status.led)} />
        <span className="truncate">{status.text}</span>
        {hz && snapshot && (
          <>
            <span className="text-hover-line hide-s">·</span>
            <span className="hide-s tabular-nums">{number(hz)} Hz</span>
          </>
        )}
      </span>
      {profile !== null && profile !== undefined && (
        <span className="prof hide-s" title={t("header.profileHint")}>
          <Icon name="lock" size="xs" />
          {t("header.profile", { n: profile + 1 })}
        </span>
      )}
      <div className="flex-1" />
      <button type="button" className="search" onClick={() => setPaletteOpen(true)} aria-label={t("header.searchLabel", { mod: MOD })}>
        <Icon name="search" size="s" />
        <span className="lbl flex-1">{t("header.search")}</span>
        <Kbd>{MOD} K</Kbd>
      </button>
      {source === "device" && (
        <>
          <Button variant="gh" ico className="hide-s" aria-label={t("action.refresh")} title={t("action.refresh")} onClick={() => void refresh()} disabled={busy}>
            <Icon name="refresh" className={busy ? "animate-spin" : undefined} />
          </Button>
          {snapshot && (
            <Button variant="gh" ico className="hide-s" aria-label={t("action.backup")} title={t("action.backup")} onClick={() => downloadBackup(snapshot)}>
              <Icon name="download" />
            </Button>
          )}
          <Button sm onClick={() => void disconnect()}>
            {t("action.disconnect")}
          </Button>
        </>
      )}
      {(source === "demo" || source === "file") && (
        <Button variant="gh" sm className="hide-s" onClick={closeSnapshot}>
          {t(source === "demo" ? "action.exitDemo" : "action.closeBackup")}
        </Button>
      )}
      {source !== "device" && (
        <Button variant="pri" sm onClick={() => void connect()} disabled={!canConnect}>
          <Icon name="plug" size="s" />
          {t("action.connect")}
        </Button>
      )}
      <Button variant="gh" sm className="hide-s" aria-label={t("lang.toggle")} title={t("lang.title")} onClick={() => setLang(lang === "pt" ? "en" : "pt")}>
        {lang === "pt" ? "PT" : "EN"}
      </Button>
      {reading && (
        <div className="readbar" role="progressbar" aria-label={t("status.reading")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress ? Math.round((progress.done / progress.total) * 100) : 0}>
          <div style={{ width: `${progress ? (progress.done / progress.total) * 100 : 2}%` }} />
        </div>
      )}
    </header>
  );
}

function NavButton({ id, current, label, count, onGo }: { id: PageId; current: boolean; label: string; count?: number; onGo: () => void }) {
  const { t } = useI18n();
  const def = PAGES[id];
  return (
    <button type="button" className={cx("nav", current && "on")} onClick={onGo} aria-current={current ? "page" : undefined} title={label}>
      <Icon name={def.icon} />
      <span className="lbl min-w-0 flex-1 truncate">{label}</span>
      {def.readOnly && (
        <span className="lbl ro" role="img" aria-label={t("common.readOnly")}>
          <Icon name="lock" size="xs" />
        </span>
      )}
      {!!count && (
        <span className="cnt" aria-label={t(count === 1 ? "bar.titleOne" : "bar.titleMany", { n: count })}>
          {count}
        </span>
      )}
    </button>
  );
}

function Sidebar({ page }: { page: PageId }) {
  const { t } = useI18n();
  const pending = usePending();
  const { sideMini, setSideMini, drawerOpen, setDrawerOpen } = useUi(
    useShallow((s) => ({ sideMini: s.sideMini, setSideMini: s.setSideMini, drawerOpen: s.drawerOpen, setDrawerOpen: s.setDrawerOpen })),
  );
  // Up to 1180 px the sidebar is icons only; the toggle opens it over the page instead.
  const narrow = useMedia("(max-width: 1180px)");
  const expanded = narrow ? drawerOpen : !sideMini;
  const toggle = () => (narrow ? setDrawerOpen(!drawerOpen) : setSideMini(!sideMini));
  const go = (id: PageId) => {
    navigate(id);
    setDrawerOpen(false);
  };

  return (
    <>
      {drawerOpen && <button type="button" className="drawer-scrim" aria-label={t("header.menuClose")} onClick={() => setDrawerOpen(false)} />}
      <nav className={cx("side", !drawerOpen && sideMini && "mini", drawerOpen && "open")} aria-label={t("nav.label")}>
        <div className="flex flex-1 flex-col gap-[18px] overflow-auto px-2.5 py-3.5">
          {SECTIONS.map((section) => (
            <div key={section.label} className="flex flex-col gap-0.5">
              <div className="sec">{t(section.label)}</div>
              {section.pages.map((id) => (
                <NavButton key={id} id={id} current={page === id} label={t(PAGES[id].label)} count={countFor(id, pending)} onGo={() => go(id)} />
              ))}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-0.5 border-t border-line p-2.5">
          <NavButton id="help" current={page === "help"} label={t("nav.help")} onGo={() => go("help")} />
          <button type="button" className="nav hide-s" onClick={toggle} aria-label={t(expanded ? "nav.collapse" : "nav.expand")} title={t(expanded ? "nav.collapse" : "nav.expand")}>
            <Icon name={expanded ? "collapse" : "expand"} />
            <span className="lbl flex-1">{t(expanded ? "nav.collapse" : "nav.expand")}</span>
          </button>
        </div>
      </nav>
    </>
  );
}

function Banners() {
  const { t } = useI18n();
  const { error, warning, source, dismissError } = useDriver(
    useShallow((s) => ({ error: s.error, warning: s.warning, source: s.source, dismissError: s.dismissError })),
  );
  const message = error ?? warning;
  return (
    <div className="banner">
      {source === "demo" && <Note>{t("banner.demo")}</Note>}
      {source === "file" && <Note>{t("banner.file")}</Note>}
      {message && (
        <Note tone={error ? "bad" : "warn"}>
          <div className="flex items-start justify-between gap-3">
            <span>{message}</span>
            <Button variant="gh" sm ico className="-my-1.5 -mr-1.5" aria-label={t("action.closeMessage")} onClick={dismissError}>
              <Icon name="x" size="s" />
            </Button>
          </div>
        </Note>
      )}
    </div>
  );
}

function PendingBar() {
  const { t } = useI18n();
  const pending = usePending();
  const { saving, history, save, undo, discard } = useDraft(
    useShallow((s) => ({ saving: s.saving, history: s.history.length, save: s.save, undo: s.undo, discard: s.discard })),
  );
  if (!pending.total && !saving) return null;

  const keys = (n: number) => t(n === 1 ? "bar.keysOne" : "bar.keysMany", { n });
  const detail = saving
    ? t("bar.step", { i: saving.index, n: saving.count, label: t(saving.label) })
    : [
        pending.act && t("bar.act", { keys: keys(pending.act) }),
        pending.rt && t("bar.rt", { keys: keys(pending.rt) }),
        pending.dz && t("bar.dz", { keys: keys(pending.dz) }),
        pending.sw && t("bar.sw", { keys: keys(pending.sw) }),
        pending.map && t("bar.map", { keys: keys(pending.map) }),
        pending.set && `${t(pending.set === 1 ? "bar.setOne" : "bar.setMany", { n: pending.set })}${pending.polling ? ` ${t("bar.reconnect")}` : ""}`,
      ]
        .filter(Boolean)
        .join(" · ");

  return (
    <div className="pbar" role="region" aria-label={t("bar.region")}>
      {saving ? <span className="spin" aria-hidden="true" /> : <span className="pdot" aria-hidden="true" />}
      <div className="flex min-w-0 flex-1 flex-col" role="status" aria-live="polite">
        <strong className="font-semibold">{saving ? t("bar.writing") : t(pending.total === 1 ? "bar.titleOne" : "bar.titleMany", { n: pending.total })}</strong>
        <span className="truncate text-[13px] leading-[18px] text-fg-2">{detail}</span>
      </div>
      <Button variant="gh" ico aria-label={t("bar.undo", { mod: MOD })} title={t("bar.undo", { mod: MOD })} onClick={undo} disabled={!!saving || !history}>
        <Icon name="undo" />
      </Button>
      <Button variant="gh" onClick={discard} disabled={!!saving}>
        {t("bar.discard")}
      </Button>
      <Button variant="pri" onClick={() => void save()} disabled={!!saving}>
        {t("bar.save")} <Kbd>{MOD} S</Kbd>
      </Button>
    </div>
  );
}

function ToastView() {
  const { t } = useI18n();
  const { toast, closeToast, undo } = useDraft(useShallow((s) => ({ toast: s.toast, closeToast: s.closeToast, undo: s.undo })));
  if (!toast) return null;
  const icon: IconName = toast.tone === "ok" ? "check" : toast.tone === "bad" ? "warn" : "note";
  return (
    <div className="toast" role={toast.tone === "bad" ? "alert" : "status"}>
      <Icon name={icon} className={toast.tone === "info" ? "text-accent-icon" : toast.tone} />
      <span className="min-w-0">{toast.text}</span>
      {toast.undo && (
        <Button variant="gh" sm onClick={undo}>
          {t("toast.undo")}
        </Button>
      )}
      {toast.action && (
        <Button sm onClick={toast.action.run}>
          {toast.action.label}
        </Button>
      )}
      <Button variant="gh" sm ico aria-label={t("toast.close")} onClick={closeToast}>
        <Icon name="x" size="s" />
      </Button>
    </div>
  );
}

interface PaletteItem {
  id: string;
  group: MessageKey;
  icon: IconName;
  label: string;
  hint?: string;
  run: () => void;
}

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

function usePaletteItems(page: PageId): PaletteItem[] {
  const { t, lang } = useI18n();
  const pending = usePending();
  const history = useDraft((s) => s.history.length);
  const driver = useDriver(
    useShallow((s) => ({ snapshot: s.snapshot, source: s.source, keyboard: s.keyboard, busy: s.status === "connecting" || s.status === "reading" })),
  );
  const items: PaletteItem[] = PAGE_IDS.map((id) => ({
    id: `page.${id}`,
    group: "pal.pages",
    icon: PAGES[id].icon,
    label: t(PAGES[id].label),
    hint: PAGES[id].readOnly ? t("common.readOnly") : undefined,
    run: () => navigate(id),
  }));
  if (driver.snapshot && PAGES[page].stage) {
    const ui = useUi.getState();
    items.push(
      { id: "sel.all", group: "pal.selection", icon: "select", label: t("pal.selectAll"), hint: `${MOD} A`, run: ui.selectAll },
      { id: "sel.wasd", group: "pal.selection", icon: "select", label: t("pal.selectWasd"), run: () => ui.select(WASD) },
      { id: "sel.letters", group: "pal.selection", icon: "select", label: t("pal.selectLetters"), run: () => ui.select(LETTERS) },
      { id: "sel.clear", group: "pal.selection", icon: "x", label: t("pal.clear"), hint: "Esc", run: ui.clear },
    );
  }
  const draft = useDraft.getState();
  const action = (item: Omit<PaletteItem, "group">) => items.push({ ...item, group: "pal.actions" });
  if (pending.total) action({ id: "save", icon: "upload", label: t("bar.save"), hint: `${MOD} S`, run: () => void draft.save() });
  if (history) action({ id: "undo", icon: "undo", label: t("pal.undo"), hint: `${MOD} Z`, run: draft.undo });
  if (pending.total) action({ id: "discard", icon: "trash", label: t("pal.discard"), run: draft.discard });
  const { snapshot, source, keyboard, busy } = driver;
  const store = useDriver.getState();
  if (snapshot && source === "device") action({ id: "backup", icon: "download", label: t("action.backup"), run: () => downloadBackup(snapshot) });
  if (keyboard) {
    action({ id: "refresh", icon: "refresh", label: t("action.refresh"), run: () => void store.refresh() });
    action({ id: "disconnect", icon: "plug", label: t("action.disconnect"), run: () => void store.disconnect() });
  } else if (isWebHidSupported() && !busy) action({ id: "connect", icon: "plug", label: t("action.connectKeyboard"), run: () => void store.connect() });
  if (!keyboard) action({ id: "open", icon: "upload", label: t("action.openBackup"), run: pickBackup });
  if (source !== "demo" && !keyboard) action({ id: "demo", icon: "play", label: t("action.demo"), run: store.startDemo });
  if (source === "demo" || source === "file")
    action({ id: "close", icon: "x", label: t(source === "demo" ? "action.exitDemo" : "action.closeBackup"), run: store.closeSnapshot });
  action({ id: "lang", icon: "interface", label: t("pal.lang"), run: () => store.setLang(lang === "pt" ? "en" : "pt") });
  return items;
}

function Palette({ page }: { page: PageId }) {
  const { t } = useI18n();
  const setOpen = useUi((s) => s.setPaletteOpen);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const all = usePaletteItems(page);
  const words = fold(query).split(/\s+/).filter(Boolean);
  const items = all.filter((item) => words.every((word) => fold(`${item.label} ${item.hint ?? ""}`).includes(word)));
  const current = Math.min(active, Math.max(0, items.length - 1));

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    input.current?.focus();
    return () => previous?.focus?.();
  }, []);
  useEffect(() => {
    document.getElementById(`pal-${items[current]?.id}`)?.scrollIntoView({ block: "nearest" });
  }, [current, items]);

  const close = () => setOpen(false);
  const run = (item: PaletteItem | undefined) => {
    if (!item) return;
    close();
    item.run();
  };

  const groups = [...new Set(items.map((item) => item.group))];
  return (
    <>
      <button type="button" className="scrim" aria-label={t("pal.close")} tabIndex={-1} onClick={close} />
      <div
        className="pal"
        role="dialog"
        aria-modal="true"
        aria-label={t("pal.label")}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            close();
          } else if (event.key === "Tab") {
            event.preventDefault();
            input.current?.focus();
          }
        }}
      >
        <div className="pal-in">
          <Icon name="search" />
          <input
            ref={input}
            value={query}
            role="combobox"
            aria-expanded="true"
            aria-controls="pal-list"
            aria-activedescendant={items[current] ? `pal-${items[current].id}` : undefined}
            aria-label={t("pal.label")}
            placeholder={t("pal.placeholder")}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const step = event.key === "ArrowDown" ? 1 : -1;
                setActive((current + step + items.length) % Math.max(1, items.length));
              } else if (event.key === "Enter") {
                event.preventDefault();
                run(items[current]);
              }
            }}
          />
          <Kbd>Esc</Kbd>
        </div>
        <div className="pal-l" id="pal-list" role="listbox" aria-label={t("pal.label")}>
          {groups.map((group) => (
            <div key={group} role="group" aria-label={t(group)}>
              <div className="pal-g" aria-hidden="true">
                {t(group)}
              </div>
              {items
                .filter((item) => item.group === group)
                .map((item) => {
                  const index = items.indexOf(item);
                  return (
                    <button
                      key={item.id}
                      id={`pal-${item.id}`}
                      type="button"
                      role="option"
                      aria-selected={index === current}
                      tabIndex={-1}
                      className={cx("pal-i", index === current && "act")}
                      onMouseMove={() => index !== current && setActive(index)}
                      onClick={() => run(item)}
                    >
                      <Icon name={item.icon} size="s" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.hint && <span className="cap">{item.hint}</span>}
                    </button>
                  );
                })}
            </div>
          ))}
          {!items.length && <p className="cap m-0 px-2.5 py-3.5">{t("pal.none")}</p>}
        </div>
      </div>
    </>
  );
}

/** Hides the tooltip under the pointer or focus until it is left (WCAG 1.4.13: dismissible). */
function dismissTooltips() {
  const open = [...document.querySelectorAll<HTMLElement>(".info:hover, .info:focus-within")];
  for (const info of open) {
    info.classList.add("closed");
    const reopen = () => {
      info.classList.remove("closed");
      info.removeEventListener("mouseleave", reopen);
      info.removeEventListener("focusout", reopen);
    };
    info.addEventListener("mouseleave", reopen);
    info.addEventListener("focusout", reopen);
  }
  return open.length > 0;
}

function useShortcuts(page: PageId) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const ui = useUi.getState();
      const draft = useDraft.getState();
      const hasData = !!useDriver.getState().snapshot;

      if (mod && key === "k") {
        event.preventDefault();
        ui.setPaletteOpen(!ui.paletteOpen);
        return;
      }
      if (ui.paletteOpen) return;
      if (mod && key === "s" && hasData) {
        event.preventDefault();
        void draft.save();
        return;
      }
      if (isTyping(event.target)) return;
      if (mod && key === "z" && !event.shiftKey) {
        event.preventDefault();
        draft.undo();
      } else if (mod && key === "a" && hasData && PAGES[page].stage) {
        event.preventDefault();
        ui.selectAll();
      } else if (event.key === "Escape" && !event.defaultPrevented) {
        if (dismissTooltips()) return;
        if (ui.drawerOpen) ui.setDrawerOpen(false);
        else if (draft.toast) draft.closeToast();
        else if (PAGES[page].stage) ui.clear();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page]);

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (pendingOf(useDraft.getState().draft).total) event.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);
}

/** Pages render their own KeyboardStage (sticky, full width) and wrap the rest in PageBody. */
export function AppShell({ page, children }: { page: PageId; children: ReactNode }) {
  const { t } = useI18n();
  const paletteOpen = useUi((s) => s.paletteOpen);
  const main = useRef<HTMLElement>(null);
  const writable = useDriver(canWrite);
  useShortcuts(page);

  useEffect(() => {
    main.current?.scrollTo({ top: 0 });
  }, [page]);

  return (
    <div className="app">
      <a href="#main" className="btn pri skip">
        {t("app.skip")}
      </a>
      <Header />
      <div className="frame">
        <Sidebar page={page} />
        <main ref={main} className="main" id="main" tabIndex={-1}>
          <Banners />
          {children}
          {writable && <PendingBar />}
        </main>
      </div>
      <ToastView />
      {paletteOpen && <Palette page={page} />}
    </div>
  );
}
