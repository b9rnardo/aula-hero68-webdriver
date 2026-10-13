import { create } from "zustand";
import { POSITIONS } from "../data/layout";

export type SelectMode = "replace" | "add" | "remove";

interface UiState {
  /** Selected key positions, in the order they were picked. */
  selected: number[];
  /** Layer shown on layer-aware pages (remap, advanced keys). */
  layer: number;

  toggle(pos: number): void;
  select(positions: number[], mode?: SelectMode): void;
  selectAll(): void;
  clear(): void;
  setLayer(layer: number): void;
}

export const useUi = create<UiState>()((set) => ({
  selected: [],
  layer: 0,

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
  clear: () => set({ selected: [] }),
  setLayer: (layer) => set({ layer }),
}));
