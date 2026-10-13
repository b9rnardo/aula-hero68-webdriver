import { create } from "zustand";
import { LAYER_COUNT } from "../hid/hero68";
import type { KeyboardSnapshot, KeySnapshot } from "../hid/snapshot";
import { translate, type MessageKey } from "../i18n/core";
import { canWrite, useDriver, type ToggleSetting } from "./driver";

// Every keyboard change goes to this draft first. Nothing reaches the keyboard until save(),
// which writes each kind of change, reads it back (inside the driver) and keeps whatever didn't stick.

export type RapidTrigger = NonNullable<KeySnapshot["rapidTrigger"]>;
export type DeadZone = NonNullable<KeySnapshot["deadZone"]>;
export type DraftSettings = Partial<Record<ToggleSetting, boolean>> & { pollingLevel?: number };

export interface Draft {
  act: Record<number, number>;
  rt: Record<number, RapidTrigger>;
  dz: Record<number, DeadZone>;
  /** Switch type id per key. */
  sw: Record<number, number>;
  /** Key function per layer. */
  map: Record<number, number>[];
  set: DraftSettings;
}

export interface Toast {
  id: number;
  tone: "ok" | "bad" | "info";
  text: string;
  /** Offers "Undo", which restores the draft before the last change. */
  undo?: boolean;
  action?: { label: string; run: () => void };
}

export interface SaveStep {
  index: number;
  count: number;
  label: MessageKey;
}

const HISTORY_MAX = 60;
/** Repeated edits of the same kind within this window share one undo step (dragging a slider, typing). */
const MERGE_MS = 800;

const emptyDraft = (): Draft => ({ act: {}, rt: {}, dz: {}, sw: {}, map: Array.from({ length: LAYER_COUNT }, () => ({})), set: {} });
const clone = (draft: Draft): Draft => JSON.parse(JSON.stringify(draft)) as Draft;
const sameRecord = <T extends object>(a: T | undefined, b: T | undefined) =>
  !!a && !!b && (Object.keys(a) as (keyof T)[]).every((key) => a[key] === b[key]);

/** Drops draft entries that already match the keyboard. */
function normalize(draft: Draft, snapshot: KeyboardSnapshot): Draft {
  const next = clone(draft);
  for (const pos of Object.keys(next.act).map(Number)) if (next.act[pos] === snapshot.keys[pos]?.actuationUm) delete next.act[pos];
  for (const pos of Object.keys(next.rt).map(Number)) if (sameRecord(next.rt[pos], snapshot.keys[pos]?.rapidTrigger)) delete next.rt[pos];
  for (const pos of Object.keys(next.dz).map(Number)) if (sameRecord(next.dz[pos], snapshot.keys[pos]?.deadZone)) delete next.dz[pos];
  for (const pos of Object.keys(next.sw).map(Number)) if (next.sw[pos] === snapshot.keys[pos]?.switchType) delete next.sw[pos];
  next.map.forEach((layer, index) => {
    for (const pos of Object.keys(layer).map(Number)) if (layer[pos] === snapshot.layers[index]?.[pos]) delete layer[pos];
  });
  for (const key of Object.keys(next.set) as (keyof DraftSettings)[]) if (next.set[key] === snapshot.settings[key]) delete next.set[key];
  return next;
}

export interface Pending {
  act: number;
  rt: number;
  dz: number;
  sw: number;
  map: number;
  set: number;
  /** Distinct keys with any change. */
  keys: number;
  total: number;
  polling: boolean;
}

export function pendingOf(draft: Draft): Pending {
  const act = Object.keys(draft.act);
  const rt = Object.keys(draft.rt);
  const dz = Object.keys(draft.dz);
  const sw = Object.keys(draft.sw);
  const map = draft.map.map((layer) => Object.keys(layer));
  const set = Object.keys(draft.set).length;
  const mapCount = map.reduce((sum, layer) => sum + layer.length, 0);
  const keys = new Set([...act, ...rt, ...dz, ...sw, ...map.flat()]).size;
  return {
    act: act.length,
    rt: rt.length,
    dz: dz.length,
    sw: sw.length,
    map: mapCount,
    set,
    keys,
    total: act.length + rt.length + dz.length + sw.length + mapCount + set,
    polling: "pollingLevel" in draft.set,
  };
}

/** Current values: the draft where it has a change, the keyboard otherwise. */
export const current = {
  act: (draft: Draft, snapshot: KeyboardSnapshot, pos: number) => draft.act[pos] ?? snapshot.keys[pos]?.actuationUm,
  rt: (draft: Draft, snapshot: KeyboardSnapshot, pos: number) => draft.rt[pos] ?? snapshot.keys[pos]?.rapidTrigger,
  dz: (draft: Draft, snapshot: KeyboardSnapshot, pos: number) => draft.dz[pos] ?? snapshot.keys[pos]?.deadZone,
  sw: (draft: Draft, snapshot: KeyboardSnapshot, pos: number) => draft.sw[pos] ?? snapshot.keys[pos]?.switchType,
  fn: (draft: Draft, snapshot: KeyboardSnapshot, layer: number, pos: number) => draft.map[layer]?.[pos] ?? snapshot.layers[layer]?.[pos],
  setting: <K extends keyof DraftSettings>(draft: Draft, snapshot: KeyboardSnapshot, key: K) =>
    (key in draft.set ? draft.set[key] : snapshot.settings[key]) as KeyboardSnapshot["settings"][K],
};

interface DraftState {
  draft: Draft;
  /** Earlier drafts, for undo. */
  history: string[];
  saving: SaveStep | null;
  toast: Toast | null;

  /** Applies a change to the draft. Ignored when the keyboard can't be written or a save is running. */
  edit(kind: string, mutate: (draft: Draft, snapshot: KeyboardSnapshot) => void): void;
  undo(): void;
  discard(): void;
  save(): Promise<void>;
  showToast(toast: Omit<Toast, "id">): void;
  closeToast(): void;
}

let lastEdit = { kind: "", at: 0 };
let toastTimer: ReturnType<typeof setTimeout> | undefined;
const t = (key: MessageKey, vars?: Record<string, string | number>) => translate(useDriver.getState().lang, key, vars);
const plural = (n: number, one: MessageKey, many: MessageKey) => t(n === 1 ? one : many, { n });

export const useDraft = create<DraftState>()((set, get) => ({
  draft: emptyDraft(),
  history: [],
  saving: null,
  toast: null,

  edit(kind, mutate) {
    const driver = useDriver.getState();
    const { snapshot } = driver;
    if (!snapshot || !canWrite(driver) || driver.writing || get().saving) return;
    const now = Date.now();
    const merge = lastEdit.kind === kind && now - lastEdit.at < MERGE_MS;
    lastEdit = { kind, at: now };
    const before = get().draft;
    const next = clone(before);
    mutate(next, snapshot);
    set((state) => ({
      draft: normalize(next, snapshot),
      history: merge ? state.history : [...state.history, JSON.stringify(before)].slice(-HISTORY_MAX),
      toast: null,
    }));
  },

  undo() {
    const { history, saving } = get();
    if (!history.length || saving) return;
    lastEdit = { kind: "", at: 0 };
    const snapshot = useDriver.getState().snapshot;
    const previous = JSON.parse(history[history.length - 1]) as Draft;
    set({ draft: snapshot ? normalize(previous, snapshot) : previous, history: history.slice(0, -1), toast: null });
  },

  discard() {
    const { draft, saving } = get();
    if (saving || pendingOf(draft).total === 0) return;
    lastEdit = { kind: "", at: 0 };
    set((state) => ({ draft: emptyDraft(), history: [...state.history, JSON.stringify(draft)].slice(-HISTORY_MAX) }));
    get().showToast({ tone: "info", text: t("save.discarded"), undo: true });
  },

  async save() {
    const driver = useDriver.getState();
    const { draft, saving } = get();
    const pending = pendingOf(draft);
    if (saving || !pending.total || !canWrite(driver) || driver.writing) return;

    const steps: { label: MessageKey; run: () => Promise<boolean> }[] = [];
    const groups = <T>(entries: Record<number, T>) => {
      const byValue = new Map<string, { value: T; positions: number[] }>();
      for (const [pos, value] of Object.entries(entries)) {
        const key = JSON.stringify(value);
        const group = byValue.get(key) ?? { value, positions: [] };
        group.positions.push(Number(pos));
        byValue.set(key, group);
      }
      return [...byValue.values()];
    };
    const every = async <T>(items: T[], write: (item: T) => Promise<boolean>) => {
      for (const item of items) if (!(await write(item))) return false;
      return true;
    };

    // First: a shorter switch can bring the actuation down with it, written next.
    if (pending.sw)
      steps.push({ label: "save.step.switchType", run: () => every(groups(draft.sw), (g) => useDriver.getState().setSwitchType(g.positions, g.value)) });
    if (pending.act)
      steps.push({ label: "save.step.actuation", run: () => every(groups(draft.act), (g) => useDriver.getState().setActuation(g.positions, g.value)) });
    if (pending.rt)
      steps.push({ label: "save.step.rapidTrigger", run: () => every(groups(draft.rt), (g) => useDriver.getState().setRapidTrigger(g.positions, g.value)) });
    if (pending.dz)
      steps.push({ label: "save.step.deadZone", run: () => every(groups(draft.dz), (g) => useDriver.getState().setDeadZones(g.positions, g.value)) });
    if (pending.map)
      steps.push({
        label: "save.step.keymap",
        run: () =>
          every(
            draft.map.map((layer, index) => ({ index, keys: Object.entries(layer).map(([pos, code]) => ({ pos: Number(pos), code })) })).filter((layer) => layer.keys.length),
            (layer) => useDriver.getState().setKeymap(layer.index, layer.keys),
          ),
      });
    const toggles = (Object.keys(draft.set) as (keyof DraftSettings)[]).filter((key): key is ToggleSetting => key !== "pollingLevel");
    if (toggles.length)
      steps.push({ label: "save.step.settings", run: () => every(toggles, (key) => useDriver.getState().setSetting(key, draft.set[key]!)) });
    // Last: the keyboard reconnects and the driver reads everything again.
    if (pending.polling) steps.push({ label: "save.step.polling", run: () => useDriver.getState().setPolling(draft.set.pollingLevel!) });

    lastEdit = { kind: "", at: 0 };
    set({ toast: null });
    const demo = driver.source === "demo";
    for (const [index, step] of steps.entries()) {
      set({ saving: { index: index + 1, count: steps.length, label: step.label } });
      const ok = await step.run().catch(() => false);
      // The driver already put the read-back values in the snapshot: keep only what still differs.
      const snapshot = useDriver.getState().snapshot;
      if (snapshot) set((state) => ({ draft: normalize(state.draft, snapshot) }));
      if (!ok) {
        set({ saving: null });
        get().showToast({ tone: "bad", text: t("save.failed") });
        return;
      }
    }

    const parts = [
      pending.keys > 0 && plural(pending.keys, "save.keysOne", "save.keysMany"),
      pending.set > 0 && plural(pending.set, "save.settingsOne", "save.settingsMany"),
    ].filter(Boolean);
    set({ saving: null, history: [] });
    get().showToast({ tone: "ok", text: t(demo ? "save.doneDemo" : "save.done", { what: parts.join(t("save.and")) }) });
  },

  showToast(toast) {
    clearTimeout(toastTimer);
    const id = Date.now();
    set({ toast: { ...toast, id } });
    toastTimer = setTimeout(
      () => {
        if (get().toast?.id === id) set({ toast: null });
      },
      toast.undo || toast.action ? 7000 : 4000,
    );
  },

  closeToast() {
    clearTimeout(toastTimer);
    set({ toast: null });
  },
}));

// A fresh read, a different source or closing the data starts over: the old draft was relative to other values.
useDriver.subscribe((state, previous) => {
  if (state.snapshot?.readAt === previous.snapshot?.readAt && state.source === previous.source && !!state.snapshot === !!previous.snapshot) return;
  lastEdit = { kind: "", at: 0 };
  useDraft.setState({ draft: emptyDraft(), history: [] });
});
