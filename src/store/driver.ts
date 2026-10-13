import { create } from "zustand";
import { demoSnapshot } from "../data/demo";
import { POSITIONS } from "../data/layout";
import {
  closeKeyboard,
  findGrantedKeyboard,
  isWebHidSupported,
  onConnect,
  onDisconnect,
  openKeyboard,
  requestKeyboard,
} from "../hid/devices";
import type { Hero68 } from "../hid/hero68";
import { HERO68_HE_UUID } from "../hid/hero68";
import {
  formatUuid,
  readSnapshot,
  SNAPSHOT_APP,
  type KeyboardSnapshot,
  type KeySnapshot,
  type ReadProgress,
} from "../hid/snapshot";
import { HidTimeoutError, type PacketDirection } from "../hid/transport";
import { detectLang, translate, type Lang, type MessageKey, type Vars } from "../i18n/core";

export type Status = "idle" | "connecting" | "reading" | "ready" | "error";

export interface PacketEntry {
  id: number;
  at: number;
  direction: PacketDirection;
  bytes: Uint8Array;
}

const MAX_PACKETS = 600;

type RapidTrigger = NonNullable<KeySnapshot["rapidTrigger"]>;
/** Used in the demo for keys whose Rapid Trigger was never read. */
const DEFAULT_RAPID_TRIGGER: RapidTrigger = { enabled: false, pressUm: 400, releaseUm: 400 };
type DeadZone = NonNullable<KeySnapshot["deadZone"]>;
/** Used in the demo for keys whose dead zones were never read (what the keyboard came with). */
const DEFAULT_DEAD_ZONE: DeadZone = { enabled: false, topUm: 100, bottomUm: 100 };

export type ToggleSetting = "winLock" | "macMode" | "keyCombo" | "autoCalibrate";
/** How long a disconnect counts as the reconnect a polling change causes, and how long to wait for it. */
const RECONNECT_MS = 8000;

/** The value the keyboard stores for `um` at a given precision. */
const snap = (um: number, step: number) => Math.round(um / step) * step;
const LANG_KEY = "hero68.lang";

function storedLang(): Lang {
  try {
    const value = localStorage.getItem(LANG_KEY);
    if (value === "pt" || value === "en") return value;
  } catch {
    // storage blocked: fall back to the browser language
  }
  return detectLang();
}

interface DriverState {
  lang: Lang;
  status: Status;
  /** Where the snapshot came from. */
  source: "device" | "file" | "demo" | null;
  error: string | null;
  warning: string | null;
  keyboard: Hero68 | null;
  snapshot: KeyboardSnapshot | null;
  progress: ReadProgress | null;
  /** A write is in flight. */
  writing: boolean;
  packets: PacketEntry[];

  setLang(lang: Lang): void;
  connect(): Promise<void>;
  autoConnect(): Promise<void>;
  disconnect(): Promise<void>;
  refresh(): Promise<void>;
  /**
   * Sets the actuation point of the given keys. On the keyboard: keeps each key's global flag,
   * writes, then reads back to confirm. In the demo it only changes the local copy.
   */
  setActuation(positions: number[], actuationUm: number): Promise<boolean>;
  /** Changes Rapid Trigger fields of the given keys; fields left out keep each key's current value. */
  setRapidTrigger(positions: number[], change: Partial<RapidTrigger>): Promise<boolean>;
  /** Changes dead zone fields of the given keys; fields left out keep each key's current value. */
  setDeadZones(positions: number[], change: Partial<DeadZone>): Promise<boolean>;
  /** Sets the function of keys on one layer (0 base, 1 Fn, 2 Fn2) and reads them back. */
  setKeymap(layer: number, keys: { pos: number; code: number }[]): Promise<boolean>;
  setSetting(key: ToggleSetting, on: boolean): Promise<boolean>;
  /** The keyboard reconnects after a polling change; this waits for it and confirms with the fresh read. */
  setPolling(level: number): Promise<boolean>;
  openBackup(file: File): Promise<boolean>;
  startDemo(): void;
  /** Leaves the demo or closes an opened backup. */
  closeSnapshot(): void;
  clearPackets(): void;
  dismissError(): void;
}

let detach: (() => void)[] = [];
let packetId = 0;
/** Set while a polling change is expected to drop and re-attach the keyboard. */
let reconnectingSince = 0;
const awaitingReconnect = () => Date.now() - reconnectingSince < RECONNECT_MS;

export const useDriver = create<DriverState>()((set, get, store) => {
  const t = (key: MessageKey, vars?: Vars) => translate(get().lang, key, vars);

  function describeError(error: unknown) {
    if (error instanceof HidTimeoutError) return t("error.timeout");
    if (error instanceof DOMException && error.name === "InvalidStateError") return t("error.open");
    return t("error.generic", { message: error instanceof Error ? error.message : String(error) });
  }

  /** Merges per-key values into the snapshot. */
  function patchKeys(values: [number, Partial<KeySnapshot>][]) {
    set(({ snapshot }) =>
      snapshot
        ? {
            snapshot: {
              ...snapshot,
              keys: { ...snapshot.keys, ...Object.fromEntries(values.map(([pos, value]) => [pos, { ...snapshot.keys[pos], ...value }])) },
            },
          }
        : {},
    );
  }

  function patchSettings(values: Partial<KeyboardSnapshot["settings"]>) {
    set(({ snapshot }) => (snapshot ? { snapshot: { ...snapshot, settings: { ...snapshot.settings, ...values } } } : {}));
  }

  function patchLayer(layer: number, values: [number, number][]) {
    set(({ snapshot }) => {
      if (!snapshot) return {};
      const layers = [...snapshot.layers];
      layers[layer] = { ...layers[layer], ...Object.fromEntries(values) };
      return { snapshot: { ...snapshot, layers } };
    });
  }

  /** Resolves true once the state matches, or false after `timeoutMs`. */
  function waitFor(test: (state: DriverState) => boolean, timeoutMs: number) {
    return new Promise<boolean>((resolve) => {
      if (test(get())) return resolve(true);
      const timer = setTimeout(() => {
        off();
        resolve(false);
      }, timeoutMs);
      const off = store.subscribe((state) => {
        if (!test(state)) return;
        clearTimeout(timer);
        off();
        resolve(true);
      });
    });
  }

  /**
   * Runs a keyboard write with the busy flag and error reporting. `device` writes, reads back and
   * returns whether the keyboard kept the values. Without a keyboard (demo) only `demo` runs.
   */
  async function write(demo: () => void, device: (keyboard: Hero68) => Promise<boolean>) {
    const state = get();
    if (!canWrite(state) || state.writing) return false;
    if (!state.keyboard) {
      demo();
      return true;
    }
    set({ writing: true, error: null });
    try {
      const applied = await device(state.keyboard);
      set({ writing: false, error: applied ? null : t("write.notApplied") });
      return applied;
    } catch (error) {
      set({ writing: false, error: describeError(error) });
      return false;
    }
  }

  async function attach(device: HIDDevice) {
    reconnectingSince = 0;
    set({ status: "connecting", error: null, warning: null });
    try {
      const keyboard = await openKeyboard(device);
      detach.forEach((off) => off());
      detach = [
        keyboard.transport.onPacket((direction, bytes) =>
          set((state) => ({
            packets: [...state.packets.slice(-(MAX_PACKETS - 1)), { id: ++packetId, at: Date.now(), direction, bytes }],
          })),
        ),
        onDisconnect(device, () => {
          keyboard.transport.dispose();
          detach.forEach((off) => off());
          detach = [];
          // After a polling change the keyboard comes back on its own: keep showing it as connecting.
          const expected = awaitingReconnect();
          set({ keyboard: null, status: expected ? "connecting" : "idle", progress: null, warning: expected ? null : t("error.disconnected") });
        }),
      ];
      // Don't keep showing demo or backup data as if it came from this keyboard.
      set((state) => ({ keyboard, source: "device", snapshot: state.source === "device" ? state.snapshot : null }));
      await get().refresh();
    } catch (error) {
      set({ status: "error", error: describeError(error), keyboard: null });
    }
  }

  return {
    lang: storedLang(),
    status: "idle",
    source: null,
    error: null,
    warning: null,
    keyboard: null,
    snapshot: null,
    progress: null,
    writing: false,
    packets: [],

    setLang(lang) {
      try {
        localStorage.setItem(LANG_KEY, lang);
      } catch {
        // not persisted; still switches for this visit
      }
      document.documentElement.lang = lang === "pt" ? "pt-BR" : "en";
      set({ lang });
    },

    async connect() {
      try {
        const device = await requestKeyboard();
        if (!device) {
          set({ error: t("connect.notFound") });
          return;
        }
        await attach(device);
      } catch (error) {
        set({ status: "error", error: describeError(error) });
      }
    },

    async autoConnect() {
      if (get().keyboard || (get().status === "connecting" && !awaitingReconnect())) return;
      const device = await findGrantedKeyboard().catch(() => null);
      if (device) await attach(device);
    },

    async disconnect() {
      const { keyboard } = get();
      detach.forEach((off) => off());
      detach = [];
      set({ keyboard: null, status: "idle", progress: null });
      if (keyboard) await closeKeyboard(keyboard).catch(() => undefined);
    },

    async refresh() {
      const { keyboard } = get();
      if (!keyboard) return;
      set({ status: "reading", error: null, progress: null });
      try {
        const snapshot = await readSnapshot(keyboard, POSITIONS, (progress) => set({ progress }));
        const wrongModel = snapshot.device.uuid !== null && snapshot.device.uuid !== formatUuid(HERO68_HE_UUID);
        set({
          snapshot,
          source: "device",
          status: "ready",
          progress: null,
          warning: wrongModel ? t("connect.wrongModel", { model: snapshot.device.model ?? snapshot.device.uuid ?? "?" }) : null,
        });
      } catch (error) {
        set({ status: "error", error: describeError(error), progress: null });
      }
    },

    async setActuation(positions, actuationUm) {
      if (!positions.length) return false;
      return write(
        () => patchKeys(positions.map((pos) => [pos, { actuationUm }])),
        async (keyboard) => {
          const flags = new Map((await keyboard.getActuation(positions)).map((key) => [key.pos, key.globalFlag]));
          await keyboard.setActuation(positions.map((pos) => ({ pos, actuationUm, globalFlag: flags.get(pos) ?? 1 })));
          const stored = await keyboard.getActuation(positions);
          patchKeys(stored.map((key) => [key.pos, { actuationUm: key.actuationUm }]));
          const expected = snap(actuationUm, keyboard.precision.distance);
          return stored.length === positions.length && stored.every((key) => key.actuationUm === expected);
        },
      );
    },

    async setRapidTrigger(positions, change) {
      const merge = (current: RapidTrigger): RapidTrigger => ({ ...current, ...change });
      if (!positions.length) return false;
      return write(
        () =>
          patchKeys(
            positions.map((pos) => [pos, { rapidTrigger: merge(get().snapshot?.keys[pos]?.rapidTrigger ?? DEFAULT_RAPID_TRIGGER) }]),
          ),
        async (keyboard) => {
          const wanted = (await keyboard.getRapidTrigger(positions)).map((key) => ({ ...key, ...merge(key) }));
          await keyboard.setRapidTrigger(wanted);
          const stored = new Map((await keyboard.getRapidTrigger(positions)).map((key) => [key.pos, key]));
          patchKeys([...stored.values()].map(({ pos, enabled, pressUm, releaseUm }) => [pos, { rapidTrigger: { enabled, pressUm, releaseUm } }]));
          const step = keyboard.precision.distance;
          return (
            wanted.length === positions.length &&
            wanted.every((key) => {
              const back = stored.get(key.pos);
              return (
                back?.enabled === key.enabled &&
                back.pressUm === snap(key.pressUm, step) &&
                back.releaseUm === snap(key.releaseUm, step)
              );
            })
          );
        },
      );
    },

    async setDeadZones(positions, change) {
      const merge = (current: DeadZone): DeadZone => ({ ...current, ...change });
      if (!positions.length) return false;
      return write(
        () => patchKeys(positions.map((pos) => [pos, { deadZone: merge(get().snapshot?.keys[pos]?.deadZone ?? DEFAULT_DEAD_ZONE) }])),
        async (keyboard) => {
          const wanted = (await keyboard.getDeadZones(positions)).map((key) => ({ ...key, ...merge(key) }));
          await keyboard.setDeadZones(wanted);
          const stored = new Map((await keyboard.getDeadZones(positions)).map((key) => [key.pos, key]));
          patchKeys([...stored.values()].map(({ pos, enabled, topUm, bottomUm }) => [pos, { deadZone: { enabled, topUm, bottomUm } }]));
          const step = keyboard.precision.distance;
          return (
            wanted.length === positions.length &&
            wanted.every((key) => {
              const back = stored.get(key.pos);
              return back?.enabled === key.enabled && back.topUm === snap(key.topUm, step) && back.bottomUm === snap(key.bottomUm, step);
            })
          );
        },
      );
    },

    async setKeymap(layer, keys) {
      if (!keys.length) return false;
      return write(
        () => patchLayer(layer, keys.map(({ pos, code }) => [pos, code])),
        async (keyboard) => {
          await keyboard.setKeymap(layer, keys);
          const stored = await keyboard.getKeymap(
            layer,
            keys.map((key) => key.pos),
          );
          patchLayer(layer, [...stored]);
          return keys.every(({ pos, code }) => stored.get(pos) === code >>> 0);
        },
      );
    },

    async setSetting(key, on) {
      return write(
        () => patchSettings({ [key]: on }),
        async (keyboard) => {
          const io = {
            winLock: [() => keyboard.setWinLock(on), () => keyboard.getWinLock()],
            macMode: [() => keyboard.setMacMode(on), () => keyboard.getMacMode()],
            keyCombo: [() => keyboard.setKeyCombo(on), () => keyboard.getKeyCombo()],
            autoCalibrate: [() => keyboard.setAutoCalibrate(on), () => keyboard.getAutoCalibrate()],
          } as const;
          const [save, load] = io[key];
          await save();
          const stored = await load();
          patchSettings({ [key]: stored });
          return stored === on;
        },
      );
    },

    async setPolling(level) {
      return write(
        () => patchSettings({ pollingLevel: level }),
        async (keyboard) => {
          reconnectingSince = Date.now();
          // The keyboard usually drops off before echoing the frame, so a missing reply is expected.
          await keyboard.setPollingLevel(level).catch(() => undefined);
          if (!(await waitFor((state) => state.keyboard !== keyboard, 2500))) {
            // It stayed connected: read the level back directly.
            reconnectingSince = 0;
            const stored = await keyboard.getPollingLevel();
            patchSettings({ pollingLevel: stored });
            return stored === level;
          }
          // attach() reads the whole keyboard again once it's back.
          const back = await waitFor((state) => state.keyboard !== null && state.status === "ready", RECONNECT_MS);
          if (!back) {
            reconnectingSince = 0;
            if (!get().keyboard) set({ status: "idle", warning: t("error.disconnected") });
            return false;
          }
          return get().snapshot?.settings.pollingLevel === level;
        },
      );
    },

    async openBackup(file) {
      try {
        const data = JSON.parse(await file.text()) as KeyboardSnapshot;
        if (data?.app !== SNAPSHOT_APP || !Array.isArray(data.layers) || typeof data.keys !== "object") throw new Error();
        if (get().keyboard) await get().disconnect();
        set({ snapshot: data, source: "file", status: "ready", error: null, warning: null });
        return true;
      } catch {
        set({ error: t("profiles.invalid") });
        return false;
      }
    },

    startDemo: () => set({ snapshot: demoSnapshot(), source: "demo", status: "ready", error: null, warning: null }),

    closeSnapshot() {
      if (get().source === "device") return;
      set({ snapshot: null, source: null, status: "idle", error: null, warning: null });
    },

    clearPackets: () => set({ packets: [] }),
    dismissError: () => set({ error: null, warning: null }),
  };
});

/**
 * Writes go to a connected HERO 68 HE whose snapshot is loaded (never while reading), or to the demo.
 * A backup file is display-only, and an unknown model is never written to.
 */
export function canWrite(state: Pick<DriverState, "source" | "status" | "keyboard" | "snapshot">) {
  if (state.source === "demo") return state.snapshot !== null;
  return (
    state.source === "device" &&
    state.status === "ready" &&
    state.keyboard !== null &&
    state.snapshot?.device.uuid === formatUuid(HERO68_HE_UUID)
  );
}

/** Re-attaches automatically when a granted keyboard is (re)plugged. Call once at startup. */
export function watchConnections() {
  if (!isWebHidSupported()) return () => undefined;
  const offConnect = onConnect(() => void useDriver.getState().autoConnect());
  void useDriver.getState().autoConnect();
  return offConnect;
}
