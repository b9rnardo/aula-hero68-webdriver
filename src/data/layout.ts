import rawLayout from "./hero68-layout.json";

export interface LayoutKey {
  /** Protocol position. */
  pos: number;
  label: string;
  /** Geometry in key units (1u = one alpha key). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Factory key function per layer: [base, Fn, Fn2]. */
  defaults: [number, number, number];
}

export const LAYOUT = rawLayout as LayoutKey[];
export const POSITIONS = LAYOUT.map((key) => key.pos);
export const LAYOUT_WIDTH = Math.max(...LAYOUT.map((key) => key.x + key.w));
export const LAYOUT_HEIGHT = Math.max(...LAYOUT.map((key) => key.y + key.h));
export const keyByPos = new Map(LAYOUT.map((key) => [key.pos, key]));
