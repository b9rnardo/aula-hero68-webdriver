import {
  bitIndexes,
  buildFrame,
  chunk,
  Cmd,
  Config,
  frameData,
  frameDataRaw,
  Info,
  readU16,
  readU32,
  Travel,
  u16,
  u32,
} from "./protocol";
import { HidTransport, type RequestOptions } from "./transport";
import { LIGHT_MAX_BRIGHTNESS, LIGHT_MAX_SPEED, LIGHT_MODES, SIDE_LIGHT_MAX_BRIGHTNESS, SIDE_LIGHT_MODES } from "../data/lighting";

export const VENDOR_ID = 0x372e;
export const PRODUCT_ID = 0x103e;
export const HERO68_HE_UUID = 0x110000000003;

/** Models that share VID/PID and are told apart by the 48-bit uuid. */
export const KNOWN_MODELS: Record<number, string> = {
  0x110000000003: "HERO 68 HE",
  0x11000000001a: "HERO 68 HE NEO",
  0x110000000028: "HERO 68 HE JIS",
  0x110000000014: "HERO 68 AIR",
  0x11000000000f: "HERO 68 MINI",
  0x110000000015: "WIN68HE Ultra",
  0x120000000001: "HERO 68 HE wireless",
  0x140000000003: "HERO 68 HE wireless",
  0x110000000005: "HERO 84 HE",
  0x110000000016: "HERO 87 HE",
  0x110000000012: "HERO 99",
  0x11000000003f: "HERO 99 HE",
};

export const LAYER_COUNT = 3;
/** Polling levels go from 0 to 6 (see getPollingLevel). */
export const POLLING_LEVEL_MAX = 6;
export const PROFILE_COUNT = 3;

/** Actuation limits in µm. The real maximum is the switch travel; the firmware accepts up to 4.0 mm. */
export const ACTUATION_MIN_UM = 100;
export const ACTUATION_MAX_UM = 4000;
/** Rapid Trigger sensitivity goes from one precision step up to 4.0 mm, like the official driver. */
export const RAPID_TRIGGER_MAX_UM = 4000;
/** Top and bottom dead zones go from 0 to 0.5 mm, like the official driver. */
export const DEAD_ZONE_MAX_UM = 500;
/** Keys per live travel request. 9 work; a request with 28 made the keyboard reset. */
export const TRAVEL_MAX_KEYS = 9;

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface LightState {
  mode: number;
  rainbow: boolean;
  color: Rgb;
  brightness: number;
  speed: number;
}

export type LightZone = "main" | "side";

/** What the keyboard keeps of a light: in rainbow it ignores the color sent and keeps the previous one. */
export const sameLight = (a: LightState, b: LightState) =>
  a.mode === b.mode &&
  a.rainbow === b.rainbow &&
  a.brightness === b.brightness &&
  a.speed === b.speed &&
  (a.rainbow || (a.color.r === b.color.r && a.color.g === b.color.g && a.color.b === b.color.b));

/** A light record as the keyboard stores it: mode, mix (7 = rainbow, 0 = the color), r, g, b, brightness, speed. */
const lightBytes = ({ mode, rainbow, color, brightness, speed }: LightState) => [mode, rainbow ? 7 : 0, color.r, color.g, color.b, brightness, speed];
const isByte = (n: number) => Number.isInteger(n) && n >= 0 && n <= 0xff;
const isRgb = ({ r, g, b }: Rgb) => isByte(r) && isByte(g) && isByte(b);

function checkLight(light: LightState, modes: Record<number, unknown>, maxBrightness: number) {
  const level = (n: number, max: number) => Number.isInteger(n) && n >= 0 && n <= max;
  if (!(light.mode in modes) || !level(light.brightness, maxBrightness) || !level(light.speed, LIGHT_MAX_SPEED) || !isRgb(light.color))
    throw new RangeError(`light out of range: ${JSON.stringify(light)}`);
}

/** µm per device unit. 10 ⇒ one unit is 0.01 mm. */
export interface Precision {
  /** Reported by GET_INFO 0x06. */
  rt: number;
  /** Reported by GET_INFO 0x08 (0 ⇒ same as rt). The official driver scales every distance with this one. */
  distance: number;
}

/** Raw per-key performance values, distances already converted to µm. */
export interface KeyActuation {
  pos: number;
  actuationUm: number;
  globalFlag: number;
}
export interface KeyRapidTrigger {
  pos: number;
  enabled: boolean;
  /** Wire field "rt_up" (first). Confirmed on hardware: the official UI's press sensitivity. */
  pressUm: number;
  /** Wire field "rt_down" (second). Confirmed on hardware: the official UI's release sensitivity. */
  releaseUm: number;
  globalFlag: number;
}
export interface KeyDeadZone {
  pos: number;
  enabled: boolean;
  topUm: number;
  bottomUm: number;
  globalFlag: number;
}

/** One key in a live travel frame. */
export interface TravelSample {
  pos: number;
  /** How far the key is pressed down. */
  depthUm: number;
  /** Raw Hall sensor reading. */
  ad: number;
  /** The keyboard counts the key as pressed (bit 15 of the reading). */
  pressed: boolean;
}

export type AdvancedKey =
  | { type: "TGL"; pos: number; key: number; delayMs: number }
  | { type: "MT"; pos: number; hold: number; tap: number; delayMs: number }
  | { type: "DKS"; pos: number; distances: number[]; keys: { key: number; actions: number[] }[] }
  | { type: "SOCD"; pos: number; positions: number[]; mode: number }
  | { type: "MPT"; pos: number; points: { key: number; distance: number }[] }
  | { type: "END"; pos: number; key: number };

export const ADVANCED_KEY_TYPES = ["TGL", "MT", "DKS", "SOCD", "MPT", "END"] as const;

const ADVANCED_TYPE_BY_ID: Record<number, AdvancedKey["type"]> = { 1: "TGL", 2: "MT", 3: "DKS", 4: "SOCD", 5: "MPT", 6: "END" };

const posBytes = (positions: number[]) => positions.flatMap((pos) => u16(pos));

/** Splits a reply into fixed-size records, keeping only the first `count`. */
function records(data: Uint8Array, size: number, count: number): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (let at = 0; at + size <= data.length && out.length < count; at += size) out.push(data.subarray(at, at + size));
  return out;
}

/**
 * Keys in a live travel frame (`98 01`): 6 bytes each, `pos, distance, reading (bit 15 = pressed)`.
 * `step` is µm per distance unit; the official driver uses the Rapid Trigger precision here.
 * Returns null for any other frame.
 */
export function parseTravel(frame: Uint8Array, step: number): TravelSample[] | null {
  if (frame[0] !== Cmd.TRAVEL_STREAM || frame[1] !== Travel.KEYS) return null;
  return records(frameData(frame), 6, TRAVEL_MAX_KEYS).map((record) => {
    const reading = readU16(record, 4);
    return { pos: readU16(record, 0), depthUm: readU16(record, 2) * step, ad: reading & 0x7fff, pressed: (reading & 0x8000) !== 0 };
  });
}

const travelReply = (sub: number) => (frame: Uint8Array) => frame[0] === Cmd.TRAVEL_STREAM && frame[1] === sub;

/** High-level API for the HERO 68 HE ("kb_by_v3_wired" protocol). Reads everything; writes are added one setting at a time. */
export class Hero68 {
  precision: Precision = { rt: 10, distance: 10 };

  constructor(readonly transport: HidTransport) {}

  get device() {
    return this.transport.device;
  }

  private request(cmd: number, frame: Parameters<typeof buildFrame>[1], options?: RequestOptions) {
    return this.transport.request(buildFrame(cmd, frame), options);
  }

  // ── Identity & capabilities ───────────────────────────────────────────

  async getUuid(): Promise<number> {
    const reply = await this.request(Cmd.GET_INFO, { sub: Info.UUID, length: 6 }, { timeoutMs: 300, retries: 4 });
    const data = frameDataRaw(reply);
    let uuid = 0;
    for (let i = 0; i < 6; i++) uuid = uuid * 256 + data[i];
    return uuid;
  }

  async getFirmwareVersion(): Promise<number> {
    const data = frameDataRaw(await this.request(Cmd.GET_INFO, { sub: Info.FIRMWARE, length: 1 }));
    return data[0] | (data[1] << 8);
  }

  async getPrecision(): Promise<Precision> {
    const rt = frameDataRaw(await this.request(Cmd.GET_INFO, { sub: Info.PRECISION }))[0] || 10;
    const distance = frameDataRaw(await this.request(Cmd.GET_INFO, { sub: Info.PRECISION_DISTANCE }))[0] || rt;
    this.precision = { rt, distance };
    return this.precision;
  }

  /** Switch type ids the firmware supports (non-empty ⇒ magnetic switches). */
  async getSupportedSwitchTypes(): Promise<number[]> {
    const data = frameDataRaw(await this.request(Cmd.GET_INFO, { sub: Info.SWITCH_TYPES }));
    return bitIndexes(data.subarray(0, 26));
  }

  async getSupportedAdvancedKeys(): Promise<AdvancedKey["type"][]> {
    const data = frameDataRaw(await this.request(Cmd.GET_INFO, { sub: Info.ADVANCED_KEYS }));
    return bitIndexes(data.subarray(1))
      .filter((bit) => bit < ADVANCED_KEY_TYPES.length)
      .map((bit) => ADVANCED_KEY_TYPES[bit]);
  }

  // ── Profiles ──────────────────────────────────────────────────────────

  async getActiveProfile(): Promise<number> {
    return frameDataRaw(await this.request(Cmd.GET_PROFILE, { length: 1 }))[0];
  }

  /** Returns null when the profile has no custom name. */
  async getProfileName(profile: number): Promise<string | null> {
    const data = frameDataRaw(await this.request(Cmd.GET_PROFILE_NAME, { sub: profile, length: 1 }));
    const length = data[0];
    if (length === 0 || length === 0xff) return null;
    return new TextDecoder().decode(data.subarray(1, 1 + Math.min(length, 55)));
  }

  // ── Settings (0x84) ───────────────────────────────────────────────────

  private async getConfig(id: number, length = 0): Promise<Uint8Array> {
    return frameDataRaw(await this.request(Cmd.GET_CONFIG, { sub: id, length }));
  }

  private parseLight(data: Uint8Array): LightState {
    return {
      mode: data[0],
      rainbow: data[1] === 7,
      color: { r: data[2], g: data[3], b: data[4] },
      brightness: data[5],
      speed: data[6],
    };
  }

  async getLight(): Promise<LightState> {
    return this.parseLight(await this.getConfig(Config.LIGHT));
  }

  async getSideLight(): Promise<LightState> {
    return this.parseLight(await this.getConfig(Config.SIDE_LIGHT));
  }

  /** Main light, in the official `sync_light_mode` frame (`04 01 00 01 00 07` + record). The keyboard echoes it. */
  async setLight(light: LightState): Promise<void> {
    checkLight(light, LIGHT_MODES, LIGHT_MAX_BRIGHTNESS);
    await this.request(Cmd.SET_CONFIG, { sub: Config.LIGHT, data: lightBytes(light) }, { timeoutMs: 500, retries: 1 });
  }

  /** Side light, same record. Like the official `sync_light_edge`, the length byte says 4 in rainbow. */
  async setSideLight(light: LightState): Promise<void> {
    checkLight(light, SIDE_LIGHT_MODES, SIDE_LIGHT_MAX_BRIGHTNESS);
    await this.request(
      Cmd.SET_CONFIG,
      { sub: Config.SIDE_LIGHT, data: lightBytes(light), length: light.rainbow ? 4 : 7 },
      { timeoutMs: 500, retries: 1 },
    );
  }

  /** 0=1000 1=500 2=250 3=125 4=8000 5=4000 6=2000 Hz */
  async getPollingLevel(): Promise<number> {
    return (await this.getConfig(Config.POLLING, 1))[0];
  }

  async getWinLock(): Promise<boolean> {
    return (await this.getConfig(Config.WIN_LOCK))[0] === 1;
  }

  async getMacMode(): Promise<boolean> {
    return (await this.getConfig(Config.MAC_MODE))[0] === 1;
  }

  async getKeyCombo(): Promise<boolean> {
    return (await this.getConfig(Config.KEY_COMBO, 1))[0] === 1;
  }

  async getAutoCalibrate(): Promise<boolean> {
    return (await this.getConfig(Config.AUTO_CALIBRATE, 1))[0] === 1;
  }

  /**
   * Writes a one-byte setting, in the same frame as the official driver (`04 id 00 01 00 01 value`).
   * The keyboard echoes the frame; there is no separate save command.
   */
  private async setConfig(id: number, value: number, options: RequestOptions = { timeoutMs: 500, retries: 2 }) {
    await this.request(Cmd.SET_CONFIG, { sub: id, data: [value] }, options);
  }

  /**
   * Level as in getPollingLevel. The keyboard reconnects to the computer after the change, so the
   * echo may never arrive: a timeout here doesn't mean the write failed.
   */
  async setPollingLevel(level: number): Promise<void> {
    if (!(Number.isInteger(level) && level >= 0 && level <= POLLING_LEVEL_MAX)) throw new RangeError(`polling level out of range: ${level}`);
    await this.setConfig(Config.POLLING, level, { timeoutMs: 1000, retries: 0 });
  }

  async setWinLock(on: boolean): Promise<void> {
    await this.setConfig(Config.WIN_LOCK, on ? 1 : 0);
  }

  async setMacMode(on: boolean): Promise<void> {
    await this.setConfig(Config.MAC_MODE, on ? 1 : 0);
  }

  async setKeyCombo(on: boolean): Promise<void> {
    await this.setConfig(Config.KEY_COMBO, on ? 1 : 0);
  }

  async setAutoCalibrate(on: boolean): Promise<void> {
    await this.setConfig(Config.AUTO_CALIBRATE, on ? 1 : 0);
  }

  /** Experimental: the official driver never reads this one successfully. */
  async getSleepLevel(): Promise<number> {
    const reply = await this.request(Cmd.GET_CONFIG, { sub: Config.SLEEP, length: 1 }, { timeoutMs: 400, retries: 1 });
    return frameDataRaw(reply)[0];
  }

  // ── Keymap ────────────────────────────────────────────────────────────

  /** Key function per position for one layer (0 base, 1 Fn, 2 Fn2). */
  async getKeymap(layer: number, positions: number[]): Promise<Map<number, number>> {
    const result = new Map<number, number>();
    for (const group of chunk(positions, 9)) {
      const reply = await this.request(Cmd.GET_KEYS, { sub: layer, data: posBytes(group) }, { timeoutMs: 400, retries: 4 });
      for (const record of records(frameDataRaw(reply), 6, group.length)) result.set(readU16(record, 0), readU32(record, 2));
    }
    return result;
  }

  /** Sets key functions on one layer, up to 9 keys per frame (`pos u16, keycode u32`), like the official driver. */
  async setKeymap(layer: number, keys: { pos: number; code: number }[]): Promise<void> {
    if (!(Number.isInteger(layer) && layer >= 0 && layer < LAYER_COUNT)) throw new RangeError(`layer out of range: ${layer}`);
    for (const group of chunk(keys, 9)) {
      const data = group.flatMap(({ pos, code }) => [...u16(pos), ...u32(code)]);
      await this.request(Cmd.SET_KEYS, { sub: layer, data }, { timeoutMs: 500, retries: 2 });
    }
  }

  // ── Per-key performance ───────────────────────────────────────────────

  async getActuation(positions: number[]): Promise<KeyActuation[]> {
    const out: KeyActuation[] = [];
    for (const group of chunk(positions, 11)) {
      const reply = await this.request(Cmd.GET_ACTUATION, { data: posBytes(group) }, { timeoutMs: 500, retries: 3 });
      for (const record of records(frameDataRaw(reply), 5, group.length))
        out.push({
          pos: readU16(record, 0),
          actuationUm: readU16(record, 2) * this.precision.distance,
          globalFlag: record[4],
        });
    }
    return out;
  }

  /**
   * Writes the actuation point of each key (sub 0, as the official driver always sends).
   * Values are rounded to the device precision; the keyboard echoes each frame as the acknowledgement.
   */
  async setActuation(keys: KeyActuation[]): Promise<void> {
    for (const { actuationUm } of keys)
      if (!(actuationUm >= ACTUATION_MIN_UM && actuationUm <= ACTUATION_MAX_UM))
        throw new RangeError(`actuation out of range: ${actuationUm} µm`);
    for (const group of chunk(keys, 11)) {
      const data = group.flatMap(({ pos, actuationUm, globalFlag }) => [
        ...u16(pos),
        ...u16(Math.round(actuationUm / this.precision.distance)),
        globalFlag,
      ]);
      await this.request(Cmd.SET_ACTUATION, { data }, { timeoutMs: 1000, retries: 1 });
    }
  }

  async getRapidTrigger(positions: number[]): Promise<KeyRapidTrigger[]> {
    const out: KeyRapidTrigger[] = [];
    for (const group of chunk(positions, 6)) {
      const reply = await this.request(Cmd.GET_RAPID_TRIGGER, { data: posBytes(group) }, { timeoutMs: 400, retries: 4 });
      for (const record of records(frameDataRaw(reply), 8, group.length))
        out.push({
          pos: readU16(record, 0),
          enabled: record[2] === 1,
          pressUm: readU16(record, 3) * this.precision.distance,
          releaseUm: readU16(record, 5) * this.precision.distance,
          globalFlag: record[7],
        });
    }
    return out;
  }

  /**
   * Writes Rapid Trigger per key: on/off and press/release sensitivity, rounded to the precision.
   * Like the official driver, a global flag of 0 goes out as 1. The keyboard echoes each frame.
   */
  async setRapidTrigger(keys: KeyRapidTrigger[]): Promise<void> {
    const min = this.precision.rt || 10;
    for (const { pressUm, releaseUm } of keys)
      for (const um of [pressUm, releaseUm])
        if (!(um >= min && um <= RAPID_TRIGGER_MAX_UM)) throw new RangeError(`rapid trigger out of range: ${um} µm`);
    for (const group of chunk(keys, 6)) {
      const data = group.flatMap(({ pos, enabled, pressUm, releaseUm, globalFlag }) => [
        ...u16(pos),
        enabled ? 1 : 0,
        ...u16(Math.round(pressUm / this.precision.distance)),
        ...u16(Math.round(releaseUm / this.precision.distance)),
        globalFlag || 1,
      ]);
      // The official driver sends each frame up to 3 times.
      await this.request(Cmd.SET_RAPID_TRIGGER, { data }, { timeoutMs: 1000, retries: 2 });
    }
  }

  async getDeadZones(positions: number[]): Promise<KeyDeadZone[]> {
    const out: KeyDeadZone[] = [];
    for (const group of chunk(positions, 6)) {
      const reply = await this.request(Cmd.GET_DEAD_ZONE, { data: posBytes(group) }, { timeoutMs: 400, retries: 4 });
      for (const record of records(frameDataRaw(reply), 8, group.length))
        out.push({
          pos: readU16(record, 0),
          topUm: readU16(record, 2) * this.precision.distance,
          bottomUm: readU16(record, 4) * this.precision.distance,
          globalFlag: record[6],
          enabled: record[7] === 1,
        });
    }
    return out;
  }

  /**
   * Writes the dead zones of each key: top and bottom distance and on/off, rounded to the precision.
   * Like the official driver when keys are edited one by one, the global flag goes out as 1.
   * The keyboard echoes each frame.
   */
  async setDeadZones(keys: KeyDeadZone[]): Promise<void> {
    for (const { topUm, bottomUm } of keys)
      for (const um of [topUm, bottomUm])
        if (!(um >= 0 && um <= DEAD_ZONE_MAX_UM)) throw new RangeError(`dead zone out of range: ${um} µm`);
    for (const group of chunk(keys, 6)) {
      const data = group.flatMap(({ pos, enabled, topUm, bottomUm, globalFlag }) => [
        ...u16(pos),
        ...u16(Math.round(topUm / this.precision.distance)),
        ...u16(Math.round(bottomUm / this.precision.distance)),
        globalFlag || 1,
        enabled ? 1 : 0,
      ]);
      // The official driver sends each frame up to 3 times.
      await this.request(Cmd.SET_DEAD_ZONE, { data }, { timeoutMs: 1000, retries: 2 });
    }
  }

  async getSwitchTypes(positions: number[]): Promise<Map<number, number>> {
    const result = new Map<number, number>();
    for (const group of chunk(positions, 18)) {
      const reply = await this.request(Cmd.GET_SWITCH_TYPE, { data: posBytes(group) }, { timeoutMs: 400, retries: 3 });
      for (const record of records(frameData(reply), 3, group.length)) result.set(readU16(record, 0), record[2]);
    }
    return result;
  }

  /**
   * Tells the keyboard which switch is in each key (official `sync_key_type`): position and type id,
   * 18 keys per frame. The keyboard echoes each frame; the official driver sends it up to 3 times.
   */
  async setSwitchTypes(keys: { pos: number; type: number }[]): Promise<void> {
    for (const { type } of keys) if (!(Number.isInteger(type) && type >= 0 && type <= 0xff)) throw new RangeError(`switch type out of range: ${type}`);
    for (const group of chunk(keys, 18)) {
      const data = group.flatMap(({ pos, type }) => [...u16(pos), type]);
      await this.request(Cmd.SET_SWITCH_TYPE, { data }, { timeoutMs: 1000, retries: 2 });
    }
  }

  async getKeyColors(positions: number[]): Promise<Map<number, Rgb>> {
    const result = new Map<number, Rgb>();
    for (const group of chunk(positions, 11)) {
      const reply = await this.request(Cmd.GET_KEY_COLORS, { data: posBytes(group) }, { timeoutMs: 400, retries: 3 });
      for (const record of records(frameDataRaw(reply), 5, group.length))
        result.set(readU16(record, 0), { r: record[2], g: record[3], b: record[4] });
    }
    return result;
  }

  /**
   * Per-key colors (official `sync_custom_light`): `pos u16, r, g, b`, 11 keys per frame. Unlike the other
   * per-key writes the frames are numbered, byte 3 the count and byte 4 the index. Each one is echoed.
   */
  async setKeyColors(keys: { pos: number; color: Rgb }[]): Promise<void> {
    for (const { color } of keys) if (!isRgb(color)) throw new RangeError(`color out of range: ${JSON.stringify(color)}`);
    const groups = chunk(keys, 11);
    for (const [index, group] of groups.entries()) {
      const data = group.flatMap(({ pos, color }) => [...u16(pos), color.r, color.g, color.b]);
      await this.request(Cmd.SET_KEY_COLORS, { data, total: groups.length, index }, { timeoutMs: 1000, retries: 1 });
    }
  }

  // ── Live travel ───────────────────────────────────────────────────────
  // Measure mode only reports; it changes no setting. Tested on the keyboard: start and exit are echoed,
  // each request gets one frame back, and the keyboard also reports a key by itself about every 50 ms.

  async startTravel(): Promise<void> {
    await this.request(Cmd.TRAVEL_STREAM, { sub: Travel.START }, { match: travelReply(Travel.START), timeoutMs: 500, retries: 2 });
  }

  /** Asks for the travel of up to 9 keys. The answer goes to onTravel listeners. */
  async requestTravel(positions: number[]): Promise<void> {
    if (positions.length > TRAVEL_MAX_KEYS) throw new RangeError(`too many keys for one travel request: ${positions.length}`);
    await this.transport.send(buildFrame(Cmd.TRAVEL_STREAM, { sub: Travel.KEYS, data: posBytes(positions) }));
  }

  async stopTravel(): Promise<void> {
    await this.request(Cmd.TRAVEL_STREAM, { sub: Travel.EXIT }, { match: travelReply(Travel.EXIT), timeoutMs: 500, retries: 2 });
  }

  /** Travel frames, requested or not. Returns an unsubscribe function. */
  onTravel(listener: (samples: TravelSample[]) => void): () => void {
    return this.transport.subscribe((frame) => {
      const samples = parseTravel(frame, this.precision.rt || 10);
      if (samples) listener(samples);
    });
  }

  // ── Advanced keys ─────────────────────────────────────────────────────

  async getAdvancedKeyPositions(layer: number): Promise<number[]> {
    const reply = await this.request(Cmd.GET_ADVANCED_KEY, { sub: layer, length: 0 });
    const data = frameData(reply);
    const positions: number[] = [];
    for (let at = 0; at + 1 < data.length; at += 2) positions.push(readU16(data, at));
    return positions;
  }

  async getAdvancedKey(layer: number, pos: number): Promise<AdvancedKey | null> {
    const reply = await this.request(Cmd.GET_ADVANCED_KEY, { sub: layer, data: u16(pos) });
    // Fields are addressed by absolute frame offset; byte 2 carries the type.
    const f = reply;
    const type = ADVANCED_TYPE_BY_ID[f[2]];
    switch (type) {
      case "TGL":
        return { type, pos, key: readU32(f, 8), delayMs: readU16(f, 12) };
      case "MT":
        return { type, pos, hold: readU32(f, 8), tap: readU32(f, 12), delayMs: readU16(f, 16) };
      case "DKS":
        return {
          type,
          pos,
          distances: [0, 1, 2, 3].map((i) => readU16(f, 8 + i * 2)),
          keys: [0, 1, 2, 3].map((i) => ({
            key: readU32(f, 16 + i * 8),
            actions: Array.from(f.subarray(20 + i * 8, 24 + i * 8)),
          })),
        };
      case "SOCD": {
        const count = f[6];
        return {
          type,
          pos,
          positions: Array.from({ length: count }, (_, i) => readU16(f, 7 + i * 2)),
          mode: f[7 + count * 2],
        };
      }
      case "MPT":
        return {
          type,
          pos,
          points: Array.from({ length: f[8] }, (_, i) => ({
            key: readU32(f, 9 + i * 6),
            distance: readU16(f, 13 + i * 6),
          })),
        };
      case "END":
        return { type, pos, key: readU32(f, 8) };
      default:
        return null;
    }
  }
}
