import { create } from "zustand";
import { switchById } from "../data/switches";
import { TRAVEL_MAX_KEYS, type Hero68, type TravelSample } from "../hid/hero68";
import { translate, type MessageKey } from "../i18n/core";
import { stepRapidTrigger, type TriggerState } from "../lib/rapidTrigger";
import { WASD } from "../lib/selection";
import { current, useDraft } from "./draft";
import { useDriver } from "./driver";

// Live travel: the keyboard reports how far keys are pressed. Measure mode changes no setting; it starts
// from a button and stops when the panel closes, the tab is hidden or anything else talks to the keyboard.

/** How often the followed key and the keys still moving are asked for. The official driver asks every 100 ms. */
const REQUEST_MS = 100;
/** A key not reported for this long is drawn back at rest. */
const STALE_MS = 400;
/** Below this the key is at rest (the sensor reads 0 to 0.01 mm when untouched). */
const REST_UM = 50;
/** Time span of the trace. */
export const TRACE_MS = 4000;

export interface LiveKey {
  depthUm: number;
  pressed: boolean;
  at: number;
}

type Status = "off" | "starting" | "on";

interface LiveState {
  status: Status;
  error: string | null;
  /** Key the trace and the diagram follow: the first one reported, then the last one pressed. */
  focus: number | null;
  /** The focus was picked on screen: it no longer moves to the key pressed. */
  pinned: boolean;
  keys: Record<number, LiveKey>;
  /** The followed key over the last TRACE_MS. */
  trace: LiveKey[];
  /** Presses seen per key since the start or the last reset. */
  hits: Record<number, number>;

  start(): Promise<void>;
  stop(): Promise<void>;
  /** Pins the focus on a key; picking the pinned key again goes back to following presses. */
  follow(pos: number): void;
  resetCounters(): void;
}

interface Source {
  stop(): Promise<void>;
}

let source: Source | null = null;
let run = 0;
const t = (key: MessageKey) => translate(useDriver.getState().lang, key);

/** The focused key first, then the keys still moving, newest first. */
function wanted(): number[] {
  const { focus, keys } = useLive.getState();
  const moving = Object.entries(keys)
    .filter(([pos, key]) => Number(pos) !== focus && key.depthUm >= REST_UM)
    .sort((a, b) => b[1].at - a[1].at)
    .map(([pos]) => Number(pos));
  return (focus === null ? moving : [focus, ...moving]).slice(0, TRAVEL_MAX_KEYS);
}

async function openKeyboard(keyboard: Hero68, receive: (samples: TravelSample[]) => void): Promise<Source> {
  const off = keyboard.onTravel(receive);
  try {
    await keyboard.startTravel();
  } catch (error) {
    off();
    throw error;
  }
  let busy = false;
  const timer = setInterval(() => {
    prune();
    const positions = wanted();
    if (busy || !positions.length) return;
    busy = true;
    keyboard
      .requestTravel(positions)
      .catch(() => undefined)
      .finally(() => (busy = false));
  }, REQUEST_MS);
  // Leaving the page can't wait for a reply; the exit frame still goes out.
  const leave = () => void keyboard.stopTravel().catch(() => undefined);
  window.addEventListener("pagehide", leave);
  return {
    async stop() {
      clearInterval(timer);
      window.removeEventListener("pagehide", leave);
      off();
      if (keyboard.device.opened) await keyboard.stopTravel().catch(() => undefined);
    },
  };
}

// Demo: a few keys pressed in a 4 s loop, moving 15 mm/s and going through each key's Rapid Trigger.
const DEMO_MS = 40;
const DEMO_SPEED_UM = 600;
const [W, A, S, D] = WASD;
const SHIFT = 55;
const SPACE = 70;
/** [from ms, to ms, key, depth µm] */
const DEMO_SCRIPT: [number, number, number, number][] = [
  [0, 1500, W, 3600],
  [1500, 1800, W, 2400],
  [1800, 2600, W, 3500],
  [500, 760, A, 2800],
  [1000, 1260, A, 2800],
  [2300, 2560, D, 2800],
  [2800, 3060, D, 2800],
  [3600, 3860, S, 2800],
  [1100, 2200, SHIFT, 3800],
  [3200, 3450, SPACE, 3800],
];

function openDemo(receive: (samples: TravelSample[]) => void): Source {
  const started = Date.now();
  const depth = new Map<number, number>();
  const trigger = new Map<number, TriggerState>();
  const timer = setInterval(() => {
    prune();
    const { snapshot } = useDriver.getState();
    const { draft } = useDraft.getState();
    if (!snapshot) return;
    const at = (Date.now() - started) % 4000;
    const goals = new Map<number, number>();
    for (const [from, to, pos, um] of DEMO_SCRIPT) if (at >= from && at < to) goals.set(pos, um);
    const samples: TravelSample[] = [];
    // Like the keyboard, the followed key is reported even at rest.
    const { focus } = useLive.getState();
    for (const pos of new Set([...depth.keys(), ...goals.keys(), ...(focus === null ? [] : [focus])])) {
      const travel = switchById.get(snapshot.keys[pos]?.switchType ?? -1)?.travelUm ?? 4000;
      const goal = Math.min(goals.get(pos) ?? 0, travel);
      const now = depth.get(pos) ?? 0;
      const next = goal > now ? Math.min(goal, now + DEMO_SPEED_UM) : Math.max(goal, now - DEMO_SPEED_UM);
      const rt = current.rt(draft, snapshot, pos);
      const state = trigger.get(pos) ?? { on: false, extreme: null };
      trigger.set(pos, state);
      stepRapidTrigger(state, next, {
        actuationUm: current.act(draft, snapshot, pos) ?? 2000,
        enabled: rt?.enabled ?? false,
        pressUm: rt?.pressUm ?? 400,
        releaseUm: rt?.releaseUm ?? 400,
      });
      samples.push({ pos, depthUm: next, ad: 0, pressed: state.on });
      if (next === 0) depth.delete(pos);
      else depth.set(pos, next);
    }
    if (samples.length) receive(samples);
  }, DEMO_MS);
  return {
    async stop() {
      clearInterval(timer);
    },
  };
}

function receive(samples: TravelSample[]) {
  const at = Date.now();
  useLive.setState((state) => {
    const keys = { ...state.keys };
    const hits = { ...state.hits };
    let { focus, trace } = state;
    for (const { pos, depthUm, pressed } of samples) {
      if (pressed && !keys[pos]?.pressed) hits[pos] = (hits[pos] ?? 0) + 1;
      keys[pos] = { depthUm, pressed, at };
      // Like the official driver: follow another key once it's pressed while the followed one is not.
      if (focus === null || (!state.pinned && pressed && pos !== focus && !keys[focus]?.pressed)) {
        focus = pos;
        trace = [];
      }
      if (pos === focus) trace = [...trace, { depthUm, pressed, at }];
    }
    return { keys, hits, focus, trace: trace.filter((point) => point.at > at - TRACE_MS) };
  });
}

/** A hidden tab barely runs timers: end measure mode instead of leaving it half running. */
function hide() {
  if (document.hidden) void useLive.getState().stop();
}

/** Keys not reported for a while are back at rest. */
function prune() {
  const at = Date.now();
  const { keys, focus } = useLive.getState();
  const stale = Object.keys(keys).filter((pos) => Number(pos) !== focus && keys[Number(pos)].at < at - STALE_MS);
  if (!stale.length) return;
  const next = { ...keys };
  for (const pos of stale) delete next[Number(pos)];
  useLive.setState({ keys: next });
}

export const useLive = create<LiveState>()((set, get) => ({
  status: "off",
  error: null,
  focus: null,
  pinned: false,
  keys: {},
  trace: [],
  hits: {},

  async start() {
    if (get().status !== "off") return;
    const { keyboard, source: from } = useDriver.getState();
    if (!(from === "demo" || (from === "device" && keyboard))) return;
    const id = ++run;
    // The demo presses several keys at once; it starts pinned on W so the trace shows a whole loop.
    const demo = from === "demo";
    set({ status: "starting", error: null, focus: demo ? W : null, pinned: demo, keys: {}, trace: [], hits: {} });
    try {
      const opened = demo ? openDemo(receive) : await openKeyboard(keyboard!, receive);
      // Stopped while starting: close what was just opened.
      if (id !== run) return void opened.stop();
      source = opened;
      document.addEventListener("visibilitychange", hide);
      set({ status: "on" });
    } catch {
      if (id === run) set({ status: "off", error: t("live.startFailed") });
    }
  },

  async stop() {
    run++;
    const closing = source;
    source = null;
    document.removeEventListener("visibilitychange", hide);
    if (get().status !== "off") set({ status: "off", keys: {} });
    await closing?.stop();
  },

  follow: (pos) =>
    set((state) => (state.focus === pos ? { pinned: !state.pinned } : { focus: pos, pinned: true, trace: [] })),
  resetCounters: () => set({ hits: {}, trace: [] }),
}));

// Anything else talking to the keyboard (a save, a new read, a disconnect) ends measure mode first.
useDriver.subscribe((state, prev) => {
  if (useLive.getState().status === "off") return;
  if (state.keyboard !== prev.keyboard || state.source !== prev.source || state.status !== "ready" || (state.writing && !prev.writing))
    void useLive.getState().stop();
});
