import { create } from "zustand";
import { LAYOUT, POSITIONS } from "../data/layout";
import type { CalibrationProgress, CalibrationRange, Hero68 } from "../hid/hero68";
import { translate, type MessageKey, type Vars } from "../i18n/core";
import { useDraft } from "./draft";
import { canWrite, useDriver } from "./driver";

// Calibration: the keyboard learns the top and bottom reading of each key pressed all the way down.
// Tested on the keyboard: only the keys that finish get a new range; the other keys and every setting stay
// as they were. It starts from a button and ends with Finish, when the panel closes, the tab is hidden or
// anything else talks to the keyboard. Ending keeps the keys that finished: the keyboard can't cancel.

/** The official driver sends the start again every second. */
const KEEP_ALIVE_MS = 1000;

export interface CalibrationKey {
  /** Raw reading now; it goes down as the key goes down. */
  reading: number;
  /** Lowest reading this session. */
  min: number;
  /** Went to the bottom and came back up: the keyboard took its new range. */
  done: boolean;
}

type Status = "off" | "starting" | "on" | "stopping";

interface CalibrationState {
  status: Status;
  error: string | null;
  /** Range of each key when calibration started, to draw how far keys go down. */
  ranges: Record<number, CalibrationRange>;
  /** Keys reported this session. Kept after the end, so the stage still shows what was calibrated. */
  keys: Record<number, CalibrationKey>;

  start(): Promise<void>;
  /** Leaves calibration, then checks the keys that finished against the ranges read back. */
  stop(): Promise<void>;
}

interface Source {
  /** Leaves calibration. */
  stop(): Promise<void>;
  /** How many of these keys the keyboard kept with the lowest reading it reported. */
  confirm(keys: Record<number, CalibrationKey>): Promise<number>;
}

let source: Source | null = null;
let run = 0;
const t = (key: MessageKey, vars?: Vars) => translate(useDriver.getState().lang, key, vars);
const toast = (tone: "ok" | "bad" | "info", text: string) => useDraft.getState().showToast({ tone, text });

/** While calibrating, the keys being pressed must not scroll the page, press buttons or run shortcuts. */
const swallow = (event: KeyboardEvent) => {
  event.preventDefault();
  event.stopPropagation();
};

const byPos = (ranges: CalibrationRange[]) => Object.fromEntries(ranges.map((range) => [range.pos, range]));

async function openKeyboard(keyboard: Hero68, receive: (keys: CalibrationProgress[]) => void): Promise<Source> {
  const ranges = await keyboard.getCalibrationRanges(POSITIONS);
  useCalibration.setState({ ranges: byPos(ranges) });
  const off = keyboard.onCalibration(receive);
  try {
    await keyboard.startCalibration();
  } catch (error) {
    off();
    throw error;
  }
  let busy = false;
  const timer = setInterval(() => {
    if (busy) return;
    busy = true;
    keyboard
      .keepCalibrating()
      .catch(() => undefined)
      .finally(() => (busy = false));
  }, KEEP_ALIVE_MS);
  // Leaving the page can't wait for a reply; the first stop frame still goes out.
  const leave = () => void keyboard.stopCalibration().catch(() => undefined);
  window.addEventListener("pagehide", leave);
  window.addEventListener("keydown", swallow, { capture: true });
  const close = () => {
    clearInterval(timer);
    window.removeEventListener("pagehide", leave);
    window.removeEventListener("keydown", swallow, { capture: true });
    off();
  };
  return {
    async stop() {
      close();
      if (keyboard.device.opened) await keyboard.stopCalibration();
    },
    async confirm(keys) {
      const done = Object.keys(keys).map(Number).filter((pos) => keys[pos].done);
      if (!done.length) return 0;
      const after = await keyboard.getCalibrationRanges(done);
      return after.filter((range) => range.min === keys[range.pos]?.min).length;
    },
  };
}

// Demo: the keys are pressed one after another, left to right, row by row.
const DEMO_MS = 50;
const DEMO_STEP_MS = 350;
/** Down, held at the bottom, back up; the key finishes when it's up. */
const [DOWN_MS, HOLD_MS, UP_MS] = [200, 450, 100];
const demoRange = (pos: number): CalibrationRange => ({ pos, max: 9000 + ((pos * 37) % 900), min: 500 + ((pos * 53) % 1000) });
const DEMO_ORDER = [...LAYOUT].sort((a, b) => a.y - b.y || a.x - b.x).map((key) => key.pos);

function openDemo(receive: (keys: CalibrationProgress[]) => void): Source {
  useCalibration.setState({ ranges: byPos(POSITIONS.map(demoRange)) });
  const started = Date.now();
  const cycle = DOWN_MS + HOLD_MS + UP_MS;
  const finished = new Set<number>();
  const timer = setInterval(() => {
    const at = Date.now() - started;
    const keys: CalibrationProgress[] = [];
    DEMO_ORDER.forEach((pos, i) => {
      const ms = at - i * DEMO_STEP_MS;
      if (ms < 0 || finished.has(pos)) return;
      const { max, min } = demoRange(pos);
      // A little deeper than the range read at the start.
      const bottom = min - 40 - ((pos * 7) % 60);
      // A slow tab skips ticks: a key past its cycle still sends the frame that finishes it.
      if (ms > cycle) {
        finished.add(pos);
        return void keys.push({ pos, reading: max, min: bottom, finished: true });
      }
      const depth = ms < DOWN_MS ? ms / DOWN_MS : ms < DOWN_MS + HOLD_MS ? 1 : 1 - (ms - DOWN_MS - HOLD_MS) / UP_MS;
      const reading = Math.round(max - (max - bottom) * depth);
      keys.push({ pos, reading, min: ms < DOWN_MS ? reading : bottom, finished: false });
    });
    if (keys.length) receive(keys);
  }, DEMO_MS);
  return {
    async stop() {
      clearInterval(timer);
    },
    async confirm(keys) {
      return Object.values(keys).filter((key) => key.done).length;
    },
  };
}

function receive(progress: CalibrationProgress[]) {
  useCalibration.setState((state) => {
    const keys = { ...state.keys };
    for (const { pos, reading, min, finished } of progress)
      // Like the official driver: a key stays done once it finished.
      keys[pos] = { reading, min, done: !!keys[pos]?.done || finished };
    return { keys };
  });
}

/** A hidden tab barely runs timers: finish instead of letting the keep-alive lapse. */
function hide() {
  if (document.hidden) void useCalibration.getState().stop();
}

/** Ends without checking anything: the keyboard is gone or something else needs it now. */
async function abort() {
  run++;
  const closing = source;
  source = null;
  document.removeEventListener("visibilitychange", hide);
  if (useCalibration.getState().status !== "off") useCalibration.setState({ status: "off" });
  await closing?.stop().catch(() => undefined);
}

export const useCalibration = create<CalibrationState>()((set, get) => ({
  status: "off",
  error: null,
  ranges: {},
  keys: {},

  async start() {
    if (get().status !== "off") return;
    const driver = useDriver.getState();
    const { keyboard, source: from } = driver;
    // It changes the keyboard: same conditions as a write.
    if (!canWrite(driver) || driver.writing || useDraft.getState().saving) return;
    const id = ++run;
    set({ status: "starting", error: null, keys: {}, ranges: {} });
    try {
      const opened = from === "demo" ? openDemo(receive) : await openKeyboard(keyboard!, receive);
      // Stopped while starting: close what was just opened.
      if (id !== run) return void opened.stop().catch(() => undefined);
      source = opened;
      document.addEventListener("visibilitychange", hide);
      set({ status: "on" });
    } catch {
      if (id === run) set({ status: "off", error: t("cal.startFailed") });
    }
  },

  async stop() {
    if (get().status === "starting") return abort();
    if (get().status !== "on" || !source) return;
    run++;
    const closing = source;
    source = null;
    document.removeEventListener("visibilitychange", hide);
    set({ status: "stopping" });
    const { keys } = get();
    const done = Object.values(keys).filter((key) => key.done).length;
    try {
      await closing.stop();
    } catch {
      set({ status: "off", error: t("cal.stopFailed") });
      return;
    }
    try {
      const kept = await closing.confirm(keys);
      if (!done) toast("info", t("cal.none"));
      else if (kept === done) toast("ok", t(done === 1 ? "cal.doneOne" : "cal.doneMany", { n: done }));
      else toast("bad", t("cal.notKept", { n: done - kept, total: done }));
    } catch {
      toast("bad", t("cal.notChecked"));
    }
    set({ status: "off" });
  },
}));

// A save, a new read or a disconnect ends calibration first, without the check.
useDriver.subscribe((state, prev) => {
  if (useCalibration.getState().status === "off") return;
  if (state.keyboard !== prev.keyboard || state.source !== prev.source || state.status !== "ready" || (state.writing && !prev.writing))
    void abort();
});
