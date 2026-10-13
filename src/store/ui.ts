import { create } from "zustand";
import { POSITIONS } from "../data/layout";

export type SelectMode = "replace" | "add" | "remove";
export type SwitchMode = "type" | "calibration" | "live";

const PREFS_KEY = "hero68.ui";

interface Prefs {
  /** Show each key's value on the keyboard stage. */
  showValues: boolean;
  /** Sidebar collapsed to icons. */
  sideMini: boolean;
}

function loadPrefs(): Prefs {
  const defaults: Prefs = { showValues: true, sideMini: false };
  try {
    const stored = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Partial<Prefs>;
    return {
      showValues: typeof stored.showValues === "boolean" ? stored.showValues : defaults.showValues,
      sideMini: typeof stored.sideMini === "boolean" ? stored.sideMini : defaults.sideMini,
    };
  } catch {
    return defaults;
  }
}

function savePrefs(prefs: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // storage blocked: the preference lasts for this visit only
  }
}

interface UiState extends Prefs {
  /** Selected key positions, in the order they were picked. */
  selected: number[];
  /** Last clicked key, the start of a Shift + click range. */
  anchor: number | null;
  /** Layer shown on layer-aware pages (remap, advanced keys). */
  layer: number;
  /** Rapid Trigger: press and release move together. */
  linkRt: boolean;
  switchMode: SwitchMode;
  paletteOpen: boolean;
  /** Sidebar drawer on phones. */
  drawerOpen: boolean;

  toggle(pos: number): void;
  select(positions: number[], mode?: SelectMode): void;
  selectAll(): void;
  clear(): void;
  setAnchor(pos: number | null): void;
  setLayer(layer: number): void;
  setLinkRt(on: boolean): void;
  setSwitchMode(mode: SwitchMode): void;
  setShowValues(on: boolean): void;
  setSideMini(on: boolean): void;
  setPaletteOpen(open: boolean): void;
  setDrawerOpen(open: boolean): void;
}

export const useUi = create<UiState>()((set, get) => ({
  ...loadPrefs(),
  selected: [],
  anchor: null,
  layer: 0,
  linkRt: false,
  switchMode: "type",
  paletteOpen: false,
  drawerOpen: false,

  toggle: (pos) =>
    set((state) => ({
      selected: state.selected.includes(pos) ? state.selected.filter((p) => p !== pos) : [...state.selected, pos],
    })),
  select: (positions, mode = "replace") =>
    set((state) => {
      if (mode === "replace") return { selected: [...new Set(positions)] };
      if (mode === "remove") return { selected: state.selected.filter((p) => !positions.includes(p)) };
      return { selected: [...new Set([...state.selected, ...positions])] };
    }),
  selectAll: () => set({ selected: [...POSITIONS] }),
  clear: () => set({ selected: [], anchor: null }),
  setAnchor: (anchor) => set({ anchor }),
  setLayer: (layer) => set({ layer }),
  setLinkRt: (linkRt) => set({ linkRt }),
  setSwitchMode: (switchMode) => set({ switchMode }),
  setShowValues(showValues) {
    set({ showValues });
    savePrefs({ showValues, sideMini: get().sideMini });
  },
  setSideMini(sideMini) {
    set({ sideMini });
    savePrefs({ showValues: get().showValues, sideMini });
  },
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
}));
