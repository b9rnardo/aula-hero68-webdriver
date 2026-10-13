// Wire format of the AULA "kb_by_v3_wired" protocol used by the HERO 68 HE.
// Reference: docs/analise.md (reverse-engineered from the official web driver).

export const REPORT_ID = 9;
export const PAYLOAD_LENGTH = 63; // bytes after the report id
export const DATA_OFFSET = 6;
export const MAX_DATA_LENGTH = PAYLOAD_LENGTH - DATA_OFFSET - 1; // 56

export const Cmd = {
  SET_KEYS: 0x03,
  SET_CONFIG: 0x04,
  SET_MACROS: 0x05,
  SET_KEY_COLORS: 0x06,
  SET_PROFILE: 0x10,
  RESET: 0x11,
  SET_ADVANCED_KEY: 0x12,
  SET_ACTUATION: 0x13,
  SET_SWITCH_TYPE: 0x15,
  SET_DEAD_ZONE: 0x16,
  SET_RAPID_TRIGGER: 0x19,
  SET_PROFILE_NAME: 0x1a,
  GET_INFO: 0x82,
  GET_KEYS: 0x83,
  GET_CONFIG: 0x84,
  GET_KEY_COLORS: 0x86,
  GET_BATTERY: 0x87,
  GET_PROFILE: 0x90,
  GET_ADVANCED_KEY: 0x92,
  GET_ACTUATION: 0x93,
  CALIBRATION: 0x94,
  GET_SWITCH_TYPE: 0x95,
  GET_DEAD_ZONE: 0x96,
  TRAVEL_STREAM: 0x98,
  GET_RAPID_TRIGGER: 0x99,
  GET_PROFILE_NAME: 0x9a,
} as const;

/** Sub-commands of Cmd.GET_INFO. */
export const Info = {
  UUID: 0x01,
  FIRMWARE: 0x02,
  SWITCH_TYPES: 0x03,
  ADVANCED_KEYS: 0x04,
  PRECISION: 0x06,
  PRECISION_DISTANCE: 0x08,
  RHYTHM: 0x09,
} as const;

/** Sub-commands of Cmd.TRAVEL_STREAM. */
export const Travel = {
  START: 0x00,
  /** Asks for some keys; also the sub of every travel frame the keyboard sends. */
  KEYS: 0x01,
  EXIT: 0x02,
} as const;

/** Setting ids shared by Cmd.SET_CONFIG (write) and Cmd.GET_CONFIG (read). */
export const Config = {
  LIGHT: 0x01,
  SIDE_LIGHT: 0x06,
  MAC_MODE: 0x11,
  SLEEP: 0x13,
  WIN_LOCK: 0x15,
  POLLING: 0x17,
  KEY_COMBO: 0x18,
  AUTO_CALIBRATE: 0x19,
} as const;

export interface FrameOptions {
  sub?: number;
  type?: number;
  total?: number;
  index?: number;
  data?: ArrayLike<number>;
  /** Value for byte 5. Defaults to data.length; some requests send a length with zeroed data. */
  length?: number;
}

/** checksum = 255 − ((reportId + Σ bytes[0..61]) mod 256) */
export function checksum(frame: Uint8Array): number {
  let sum = REPORT_ID;
  for (let i = 0; i < PAYLOAD_LENGTH - 1; i++) sum += frame[i];
  return 255 - (sum % 256);
}

export function buildFrame(cmd: number, opts: FrameOptions = {}): Uint8Array {
  const data = opts.data ?? [];
  if (data.length > MAX_DATA_LENGTH) throw new Error(`frame data too long: ${data.length}`);
  const frame = new Uint8Array(PAYLOAD_LENGTH);
  frame[0] = cmd;
  frame[1] = opts.sub ?? 0;
  frame[2] = opts.type ?? 0;
  frame[3] = opts.total ?? 1;
  frame[4] = opts.index ?? 0;
  frame[5] = opts.length ?? data.length;
  frame.set(Array.from(data), DATA_OFFSET);
  frame[PAYLOAD_LENGTH - 1] = checksum(frame);
  return frame;
}

export function isValidChecksum(frame: Uint8Array): boolean {
  return frame.length === PAYLOAD_LENGTH && frame[PAYLOAD_LENGTH - 1] === checksum(frame);
}

/** Data bytes of a reply, trimmed to the length in byte 5. */
export function frameData(frame: Uint8Array): Uint8Array {
  const length = Math.min(frame[5], MAX_DATA_LENGTH);
  return frame.slice(DATA_OFFSET, DATA_OFFSET + length);
}

/** All 56 data bytes, ignoring byte 5 (some replies don't fill in the length). */
export function frameDataRaw(frame: Uint8Array): Uint8Array {
  return frame.slice(DATA_OFFSET, PAYLOAD_LENGTH - 1);
}

export const u16 = (value: number): [number, number] => [(value >> 8) & 0xff, value & 0xff];
export const u32 = (value: number): [number, number, number, number] => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
];
export const readU16 = (bytes: ArrayLike<number>, at: number) => (bytes[at] << 8) | bytes[at + 1];
export const readU32 = (bytes: ArrayLike<number>, at: number) =>
  ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Bit indexes set in a little-endian-per-byte bitfield. */
export function bitIndexes(bytes: ArrayLike<number>): number[] {
  const out: number[] = [];
  for (let i = 0; i < bytes.length; i++)
    for (let bit = 0; bit < 8; bit++) if (bytes[i] & (1 << bit)) out.push(i * 8 + bit);
  return out;
}

export const toHex = (bytes: ArrayLike<number>) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(" ");
