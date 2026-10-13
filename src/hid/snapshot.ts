import type { AdvancedKey, Hero68, LightState, Precision, Rgb } from "./hero68";
import { KNOWN_MODELS, LAYER_COUNT, PROFILE_COUNT } from "./hero68";

export const SNAPSHOT_APP = "aula-hero68-driver";
export const SNAPSHOT_FORMAT = 1;

export interface KeySnapshot {
  actuationUm?: number;
  rapidTrigger?: { enabled: boolean; pressUm: number; releaseUm: number };
  deadZone?: { enabled: boolean; topUm: number; bottomUm: number };
  switchType?: number;
  color?: Rgb;
}

/** Everything readable from the keyboard for the active profile. Safe to serialize as JSON. */
export interface KeyboardSnapshot {
  app: typeof SNAPSHOT_APP;
  format: typeof SNAPSHOT_FORMAT;
  readAt: string;
  device: {
    productName: string;
    model: string | null;
    uuid: string | null;
    firmware: number | null;
    precision: Precision | null;
  };
  features: {
    switchTypes: number[];
    advancedKeys: AdvancedKey["type"][];
  };
  profile: {
    active: number | null;
    names: (string | null)[];
  };
  settings: {
    pollingLevel: number | null;
    winLock: boolean | null;
    macMode: boolean | null;
    keyCombo: boolean | null;
    autoCalibrate: boolean | null;
    sleepLevel: number | null;
  };
  lighting: {
    main: LightState | null;
    side: LightState | null;
  };
  /** Key function per position, one record per layer: [base, Fn, Fn2]. */
  layers: Record<number, number>[];
  keys: Record<number, KeySnapshot>;
  /** Advanced keys per layer. */
  advancedKeys: AdvancedKey[][];
  /** Steps that failed; the rest of the snapshot is still valid. */
  errors: { step: string; message: string }[];
}

export interface ReadProgress {
  step: string;
  done: number;
  total: number;
}

export const formatUuid = (uuid: number) => `0x${uuid.toString(16).padStart(12, "0")}`;
export const formatFirmware = (version: number) => `0x${version.toString(16).padStart(4, "0")}`;

/**
 * Reads the whole keyboard state. Never writes. A failing step is recorded in `errors`
 * and the read continues, so a partial backup is still produced.
 */
export async function readSnapshot(
  keyboard: Hero68,
  positions: number[],
  onProgress?: (progress: ReadProgress) => void,
): Promise<KeyboardSnapshot> {
  const snapshot: KeyboardSnapshot = {
    app: SNAPSHOT_APP,
    format: SNAPSHOT_FORMAT,
    readAt: new Date().toISOString(),
    device: { productName: keyboard.device.productName, model: null, uuid: null, firmware: null, precision: null },
    features: { switchTypes: [], advancedKeys: [] },
    profile: { active: null, names: [] },
    settings: { pollingLevel: null, winLock: null, macMode: null, keyCombo: null, autoCalibrate: null, sleepLevel: null },
    lighting: { main: null, side: null },
    layers: [],
    keys: Object.fromEntries(positions.map((pos) => [pos, {}])),
    advancedKeys: [],
    errors: [],
  };
  const key = (pos: number): KeySnapshot => (snapshot.keys[pos] ??= {});

  const steps: [string, () => Promise<void>][] = [
    ["uuid", async () => {
      const uuid = await keyboard.getUuid();
      snapshot.device.uuid = formatUuid(uuid);
      snapshot.device.model = KNOWN_MODELS[uuid] ?? null;
    }],
    ["firmware", async () => void (snapshot.device.firmware = await keyboard.getFirmwareVersion())],
    ["precision", async () => void (snapshot.device.precision = await keyboard.getPrecision())],
    ["switchTypes", async () => void (snapshot.features.switchTypes = await keyboard.getSupportedSwitchTypes())],
    ["advancedKeyTypes", async () => void (snapshot.features.advancedKeys = await keyboard.getSupportedAdvancedKeys())],
    ["activeProfile", async () => void (snapshot.profile.active = await keyboard.getActiveProfile())],
    ["profileNames", async () => {
      for (let profile = 0; profile < PROFILE_COUNT; profile++)
        snapshot.profile.names[profile] = await keyboard.getProfileName(profile);
    }],
    ["polling", async () => void (snapshot.settings.pollingLevel = await keyboard.getPollingLevel())],
    ["winLock", async () => void (snapshot.settings.winLock = await keyboard.getWinLock())],
    ["macMode", async () => void (snapshot.settings.macMode = await keyboard.getMacMode())],
    ["keyCombo", async () => void (snapshot.settings.keyCombo = await keyboard.getKeyCombo())],
    ["autoCalibrate", async () => void (snapshot.settings.autoCalibrate = await keyboard.getAutoCalibrate())],
    ["sleep", async () => void (snapshot.settings.sleepLevel = await keyboard.getSleepLevel())],
    ["light", async () => void (snapshot.lighting.main = await keyboard.getLight())],
    ["sideLight", async () => void (snapshot.lighting.side = await keyboard.getSideLight())],
    ...Array.from({ length: LAYER_COUNT }, (_, layer): [string, () => Promise<void>] => [
      `keymap.${layer}`,
      async () => void (snapshot.layers[layer] = Object.fromEntries(await keyboard.getKeymap(layer, positions))),
    ]),
    ["actuation", async () => {
      for (const item of await keyboard.getActuation(positions)) key(item.pos).actuationUm = item.actuationUm;
    }],
    ["rapidTrigger", async () => {
      for (const { pos, enabled, pressUm, releaseUm } of await keyboard.getRapidTrigger(positions))
        key(pos).rapidTrigger = { enabled, pressUm, releaseUm };
    }],
    ["deadZone", async () => {
      for (const { pos, enabled, topUm, bottomUm } of await keyboard.getDeadZones(positions))
        key(pos).deadZone = { enabled, topUm, bottomUm };
    }],
    ["switchType", async () => {
      for (const [pos, type] of await keyboard.getSwitchTypes(positions)) key(pos).switchType = type;
    }],
    ["keyColors", async () => {
      for (const [pos, color] of await keyboard.getKeyColors(positions)) key(pos).color = color;
    }],
    ...Array.from({ length: LAYER_COUNT }, (_, layer): [string, () => Promise<void>] => [
      `advancedKeys.${layer}`,
      async () => {
        const found: AdvancedKey[] = [];
        for (const pos of await keyboard.getAdvancedKeyPositions(layer)) {
          const advanced = await keyboard.getAdvancedKey(layer, pos);
          if (advanced) found.push(advanced);
        }
        snapshot.advancedKeys[layer] = found;
      },
    ]),
  ];

  for (let i = 0; i < steps.length; i++) {
    const [step, run] = steps[i];
    onProgress?.({ step, done: i, total: steps.length });
    try {
      await run();
    } catch (error) {
      snapshot.errors.push({ step, message: error instanceof Error ? error.message : String(error) });
    }
  }
  onProgress?.({ step: "done", done: steps.length, total: steps.length });
  return snapshot;
}

export function snapshotFileName(snapshot: KeyboardSnapshot) {
  const stamp = snapshot.readAt.slice(0, 19).replace(/[:T]/g, "-");
  const profile = snapshot.profile.active === null ? "" : `-perfil${snapshot.profile.active + 1}`;
  return `hero68he${profile}-${stamp}.json`;
}

export function downloadJson(data: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: fileName });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
