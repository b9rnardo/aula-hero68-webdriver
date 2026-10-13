import { HERO68_HE_UUID, KNOWN_MODELS, type AdvancedKey } from "../hid/hero68";
import { formatUuid, SNAPSHOT_APP, SNAPSHOT_FORMAT, type KeyboardSnapshot, type KeySnapshot } from "../hid/snapshot";
import { LAYOUT } from "./layout";

const HID_HOME = 0x4a;
/** What a HERO 68 HE reports: Jade King on every key, and the models its firmware accepts. */
const JADE_KING = 14;
const SWITCH_TYPES = [1, 3, 4, 5, 8, 13, 14, 15, 16, 22, 24];
const posOf = (label: string) => LAYOUT.find((key) => key.label === label)?.pos ?? -1;

/**
 * Sample profile for the demo mode: factory keymap (one remap), 1.0 mm actuation and a "gaming" tweak
 * on WASD so every page has something to show. Never presented as real keyboard data.
 */
export function demoSnapshot(): KeyboardSnapshot {
  const wasd = ["W", "A", "S", "D"].map(posOf);
  const maxX = Math.max(...LAYOUT.map((key) => key.x));

  const keys: Record<number, KeySnapshot> = {};
  for (const key of LAYOUT) {
    const gaming = wasd.includes(key.pos);
    // Purple-to-pink gradient across the board for the per-key colors.
    const t = key.x / maxX;
    keys[key.pos] = {
      actuationUm: gaming ? 400 : key.label === "Esc" ? 1500 : 1000,
      rapidTrigger: { enabled: gaming, pressUm: gaming ? 150 : 100, releaseUm: gaming ? 200 : 100 },
      deadZone: { enabled: false, topUm: 100, bottomUm: 100 },
      switchType: JADE_KING,
      color: { r: Math.round(110 + 120 * t), g: Math.round(60 - 20 * t), b: Math.round(240 - 60 * t) },
    };
  }

  const advanced: AdvancedKey[] = [
    { type: "SOCD", pos: posOf("A"), positions: [posOf("A"), posOf("D")], mode: 1 },
    { type: "MT", pos: posOf("Caps"), tap: 0x29, hold: 0x0d000000, delayMs: 200 },
  ];

  return {
    app: SNAPSHOT_APP,
    format: SNAPSHOT_FORMAT,
    readAt: new Date().toISOString(),
    device: {
      productName: "HERO 68 HE",
      model: KNOWN_MODELS[HERO68_HE_UUID],
      uuid: formatUuid(HERO68_HE_UUID),
      firmware: null,
      precision: { rt: 10, distance: 10 },
    },
    features: { switchTypes: SWITCH_TYPES, advancedKeys: ["TGL", "MT", "DKS", "SOCD", "MPT", "END"] },
    profile: { active: 0, names: [null, null, null] },
    settings: { pollingLevel: 4, winLock: false, macMode: false, keyCombo: false, autoCalibrate: true, sleepLevel: 10 },
    lighting: {
      main: { mode: 19, rainbow: false, color: { r: 139, g: 92, b: 246 }, brightness: 16, speed: 2 },
      side: { mode: 3, rainbow: false, color: { r: 139, g: 92, b: 246 }, brightness: 3, speed: 2 },
    },
    layers: [0, 1, 2].map((layer) =>
      Object.fromEntries(
        // One remap so the Remap page has something to show: Ins → Home.
        LAYOUT.map((key) => [key.pos, layer === 0 && key.label === "Ins" ? HID_HOME : key.defaults[layer]]),
      ),
    ),
    keys,
    advancedKeys: [advanced, [], []],
    errors: [],
  };
}
