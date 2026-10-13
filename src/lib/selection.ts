import { LAYOUT, POSITIONS } from "../data/layout";

const byLabel = (labels: string[]) => labels.map((label) => LAYOUT.find((key) => key.label === label)!.pos);

/** Quick selections used by the stage chips, the empty states and the command palette. */
export const WASD = byLabel(["W", "A", "S", "D"]);
export const LETTERS = LAYOUT.filter((key) => /^[A-Z]$/.test(key.label)).map((key) => key.pos);
export const ALL = POSITIONS;

/** Index of each key in reading order, for Shift + click ranges and sorted lists. */
export const ORDER = new Map(LAYOUT.map((key, index) => [key.pos, index]));
export const byOrder = (a: number, b: number) => (ORDER.get(a) ?? 0) - (ORDER.get(b) ?? 0);

export function sameSet(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((pos) => set.has(pos));
}
