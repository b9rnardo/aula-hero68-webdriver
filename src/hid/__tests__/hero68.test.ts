import { describe, expect, it } from "vitest";
import { Hero68, parseCalibration, parseTravel, type TravelSample } from "../hero68";
import { buildFrame, Calibration, Cmd, Config, Info, readU16, Travel, u16, u32 } from "../protocol";
import { HidTimeoutError, HidTransport } from "../transport";
import { fakeDevice, header } from "./fake-device";

const keyboardWith = (respond: Parameters<typeof fakeDevice>[0]) => {
  const fake = fakeDevice(respond);
  return { keyboard: new Hero68(new HidTransport(fake.device)), sent: fake.sent };
};

describe("Hero68", () => {
  it("reads the uuid", async () => {
    const { keyboard } = keyboardWith((req) =>
      req[0] === Cmd.GET_INFO && req[1] === Info.UUID ? [...header(req, 6), 0x11, 0, 0, 0, 0, 0x03] : null,
    );
    expect(await keyboard.getUuid()).toBe(0x110000000003);
  });

  it("reads a keymap layer in chunks of 9 keys", async () => {
    const keymap = new Map([[1, 0x29], [15, 0x1e], [72, 0x0d000000]]);
    const positions = Array.from({ length: 12 }, (_, i) => i + 1).concat([15, 72]);
    const { keyboard, sent } = keyboardWith((req) => {
      const count = req[5] / 2;
      const data: number[] = [];
      for (let i = 0; i < count; i++) {
        const pos = readU16(req, 6 + i * 2);
        data.push(...u16(pos), ...u32(keymap.get(pos) ?? 0));
      }
      return [...header(req, data.length), ...data];
    });
    const result = await keyboard.getKeymap(1, positions);
    expect(sent).toHaveLength(2);
    expect(sent.every((frame) => frame[0] === Cmd.GET_KEYS && frame[1] === 1)).toBe(true);
    expect(result.get(1)).toBe(0x29);
    expect(result.get(72)).toBe(0x0d000000);
    expect(result.size).toBe(positions.length);
  });

  it("scales rapid trigger values by the distance precision", async () => {
    const { keyboard } = keyboardWith((req) =>
      req[0] === Cmd.GET_RAPID_TRIGGER ? [...header(req, 8), 0, 43, 1, ...u16(15), ...u16(30), 0] : null,
    );
    keyboard.precision = { rt: 10, distance: 10 };
    expect(await keyboard.getRapidTrigger([43])).toEqual([
      { pos: 43, enabled: true, pressUm: 150, releaseUm: 300, globalFlag: 0 },
    ]);
  });

  it("writes actuation in frames of 11 keys, rounded to the precision", async () => {
    const { keyboard, sent } = keyboardWith((req) => (req[0] === Cmd.SET_ACTUATION ? header(req, 0) : null));
    keyboard.precision = { rt: 10, distance: 10 };
    const keys = Array.from({ length: 12 }, (_, i) => ({ pos: i + 1, actuationUm: 1234, globalFlag: 1 }));
    await keyboard.setActuation(keys);
    expect(sent).toHaveLength(2);
    expect(sent[0][1]).toBe(0);
    expect(sent[0][5]).toBe(55);
    expect(Array.from(sent[0].subarray(6, 11))).toEqual([0, 1, ...u16(123), 1]);
    expect(sent[1][5]).toBe(5);
  });

  it("refuses actuation outside the supported range", async () => {
    const { keyboard, sent } = keyboardWith(() => null);
    await expect(keyboard.setActuation([{ pos: 1, actuationUm: 50, globalFlag: 1 }])).rejects.toBeInstanceOf(RangeError);
    await expect(keyboard.setActuation([{ pos: 1, actuationUm: 4100, globalFlag: 1 }])).rejects.toBeInstanceOf(RangeError);
    expect(sent).toHaveLength(0);
  });

  it("writes rapid trigger in frames of 6 keys, press before release", async () => {
    const { keyboard, sent } = keyboardWith((req) => (req[0] === Cmd.SET_RAPID_TRIGGER ? header(req, 0) : null));
    keyboard.precision = { rt: 10, distance: 10 };
    const keys = Array.from({ length: 7 }, (_, i) => ({ pos: i + 1, enabled: i > 0, pressUm: 304, releaseUm: 500, globalFlag: 0 }));
    await keyboard.setRapidTrigger(keys);
    expect(sent).toHaveLength(2);
    expect(sent[0][0]).toBe(Cmd.SET_RAPID_TRIGGER);
    expect(sent[0][5]).toBe(48);
    expect(Array.from(sent[0].subarray(6, 14))).toEqual([0, 1, 0, ...u16(30), ...u16(50), 1]);
    expect(Array.from(sent[0].subarray(14, 17))).toEqual([0, 2, 1]);
    expect(sent[1][5]).toBe(8);
  });

  it("writes dead zones in frames of 6 keys, top, bottom, global, then on/off", async () => {
    const { keyboard, sent } = keyboardWith((req) => (req[0] === Cmd.SET_DEAD_ZONE ? header(req, 0) : null));
    keyboard.precision = { rt: 10, distance: 10 };
    const keys = Array.from({ length: 7 }, (_, i) => ({ pos: i + 1, enabled: i > 0, topUm: 204, bottomUm: 0, globalFlag: 0 }));
    await keyboard.setDeadZones(keys);
    expect(sent).toHaveLength(2);
    expect(sent[0][0]).toBe(Cmd.SET_DEAD_ZONE);
    expect(sent[0][1]).toBe(0);
    expect(sent[0][5]).toBe(48);
    expect(Array.from(sent[0].subarray(6, 14))).toEqual([0, 1, ...u16(20), ...u16(0), 1, 0]);
    expect(sent[0][21]).toBe(1);
    expect(sent[1][5]).toBe(8);
  });

  it("refuses dead zones outside the supported range", async () => {
    const { keyboard, sent } = keyboardWith(() => null);
    const key = { pos: 1, enabled: true, topUm: 100, bottomUm: 100, globalFlag: 1 };
    await expect(keyboard.setDeadZones([{ ...key, topUm: -10 }])).rejects.toBeInstanceOf(RangeError);
    await expect(keyboard.setDeadZones([{ ...key, bottomUm: 510 }])).rejects.toBeInstanceOf(RangeError);
    expect(sent).toHaveLength(0);
  });

  it("writes switch types in frames of 18 keys, position then type", async () => {
    const { keyboard, sent } = keyboardWith((req) => (req[0] === Cmd.SET_SWITCH_TYPE ? header(req, 0) : null));
    const keys = Array.from({ length: 19 }, (_, i) => ({ pos: i + 1, type: i === 0 ? 25 : 0 }));
    await keyboard.setSwitchTypes(keys);
    expect(sent).toHaveLength(2);
    expect(Array.from(sent[0].subarray(0, 6))).toEqual([Cmd.SET_SWITCH_TYPE, 0, 0, 1, 0, 54]);
    expect(Array.from(sent[0].subarray(6, 12))).toEqual([0, 1, 25, 0, 2, 0]);
    expect(Array.from(sent[1].subarray(0, 9))).toEqual([Cmd.SET_SWITCH_TYPE, 0, 0, 1, 0, 3, 0, 19, 0]);
  });

  it("writes the main and side light like the official driver", async () => {
    const { keyboard, sent } = keyboardWith((req) => (req[0] === Cmd.SET_CONFIG ? header(req, req[5]) : null));
    await keyboard.setLight({ mode: 1, rainbow: false, color: { r: 255, g: 0, b: 0 }, brightness: 10, speed: 2 });
    expect(Array.from(sent[0].subarray(0, 13))).toEqual([Cmd.SET_CONFIG, Config.LIGHT, 0, 1, 0, 7, 1, 0, 255, 0, 0, 10, 2]);
    // In rainbow the official side light frame says 4 bytes; the keyboard still takes brightness and speed.
    await keyboard.setSideLight({ mode: 1, rainbow: true, color: { r: 9, g: 8, b: 7 }, brightness: 1, speed: 3 });
    expect(Array.from(sent[1].subarray(0, 13))).toEqual([Cmd.SET_CONFIG, Config.SIDE_LIGHT, 0, 1, 0, 4, 1, 7, 9, 8, 7, 1, 3]);
  });

  it("refuses a light the keyboard doesn't have", async () => {
    const { keyboard, sent } = keyboardWith(() => null);
    const light = { mode: 1, rainbow: false, color: { r: 0, g: 0, b: 0 }, brightness: 4, speed: 4 };
    await expect(keyboard.setLight({ ...light, mode: 20 })).rejects.toBeInstanceOf(RangeError);
    await expect(keyboard.setLight({ ...light, brightness: 21 })).rejects.toBeInstanceOf(RangeError);
    await expect(keyboard.setSideLight({ ...light, brightness: 5 })).rejects.toBeInstanceOf(RangeError);
    await expect(keyboard.setSideLight({ ...light, mode: 6 })).rejects.toBeInstanceOf(RangeError);
    await expect(keyboard.setLight({ ...light, speed: 5 })).rejects.toBeInstanceOf(RangeError);
    await expect(keyboard.setKeyColors([{ pos: 1, color: { r: 256, g: 0, b: 0 } }])).rejects.toBeInstanceOf(RangeError);
    expect(sent).toHaveLength(0);
  });

  it("writes key colors in numbered frames of 11 keys", async () => {
    const { keyboard, sent } = keyboardWith((req) => (req[0] === Cmd.SET_KEY_COLORS ? header(req, req[5]) : null));
    await keyboard.setKeyColors(Array.from({ length: 12 }, (_, i) => ({ pos: i + 1, color: { r: i, g: 2, b: 3 } })));
    expect(sent).toHaveLength(2);
    expect(Array.from(sent[0].subarray(0, 11))).toEqual([Cmd.SET_KEY_COLORS, 0, 0, 2, 0, 55, 0, 1, 0, 2, 3]);
    expect(Array.from(sent[1].subarray(0, 11))).toEqual([Cmd.SET_KEY_COLORS, 0, 0, 2, 1, 5, 0, 12, 11, 2, 3]);
  });

  it("refuses a switch type that isn't one byte", async () => {
    const { keyboard, sent } = keyboardWith(() => null);
    await expect(keyboard.setSwitchTypes([{ pos: 1, type: 256 }])).rejects.toBeInstanceOf(RangeError);
    await expect(keyboard.setSwitchTypes([{ pos: 1, type: 1.5 }])).rejects.toBeInstanceOf(RangeError);
    expect(sent).toHaveLength(0);
  });

  it("writes a keymap layer in frames of 9 keys, position then 32-bit function", async () => {
    const { keyboard, sent } = keyboardWith((req) => (req[0] === Cmd.SET_KEYS ? header(req, req[5]) : null));
    const keys = Array.from({ length: 10 }, (_, i) => ({ pos: i + 1, code: 0x0d010000 + i }));
    await keyboard.setKeymap(2, keys);
    expect(sent).toHaveLength(2);
    expect(sent.every((frame) => frame[0] === Cmd.SET_KEYS && frame[1] === 2)).toBe(true);
    expect(sent[0][5]).toBe(54);
    expect(Array.from(sent[0].subarray(6, 12))).toEqual([0, 1, 0x0d, 0x01, 0, 0]);
    expect(Array.from(sent[1].subarray(5, 12))).toEqual([6, 0, 10, 0x0d, 0x01, 0, 9]);
    await expect(keyboard.setKeymap(3, keys)).rejects.toBeInstanceOf(RangeError);
  });

  it("writes one-byte settings like the official driver", async () => {
    const { keyboard, sent } = keyboardWith((req) => (req[0] === Cmd.SET_CONFIG ? header(req, 1) : null));
    await keyboard.setWinLock(false);
    await keyboard.setMacMode(true);
    await keyboard.setKeyCombo(true);
    await keyboard.setAutoCalibrate(false);
    await keyboard.setPollingLevel(4);
    expect(sent.map((frame) => Array.from(frame.subarray(0, 7)))).toEqual([
      [0x04, 0x15, 0, 1, 0, 1, 0],
      [0x04, 0x11, 0, 1, 0, 1, 1],
      [0x04, 0x18, 0, 1, 0, 1, 1],
      [0x04, 0x19, 0, 1, 0, 1, 0],
      [0x04, 0x17, 0, 1, 0, 1, 4],
    ]);
    await expect(keyboard.setPollingLevel(7)).rejects.toBeInstanceOf(RangeError);
  });

  it("refuses rapid trigger outside the supported range", async () => {
    const { keyboard, sent } = keyboardWith(() => null);
    const key = { pos: 1, enabled: true, pressUm: 100, releaseUm: 100, globalFlag: 1 };
    await expect(keyboard.setRapidTrigger([{ ...key, pressUm: 0 }])).rejects.toBeInstanceOf(RangeError);
    await expect(keyboard.setRapidTrigger([{ ...key, releaseUm: 4010 }])).rejects.toBeInstanceOf(RangeError);
    expect(sent).toHaveLength(0);
  });

  it("parses a mod-tap advanced key", async () => {
    const { keyboard } = keyboardWith((req) =>
      req[0] === Cmd.GET_ADVANCED_KEY ? [req[0], req[1], 2, 1, 0, 12, ...u16(42), ...u32(0x00e00000), ...u32(0x29), ...u16(200)] : null,
    );
    expect(await keyboard.getAdvancedKey(0, 42)).toEqual({ type: "MT", pos: 42, hold: 0x00e00000, tap: 0x29, delayMs: 200 });
  });

  it("parses live travel frames: distance in precision steps, bit 15 of the reading is pressed", () => {
    // Recorded on the keyboard: W at rest, then C pressed 2.05 mm.
    const rest = buildFrame(Cmd.TRAVEL_STREAM, { sub: Travel.KEYS, data: [0x00, 0x1e, 0x00, 0x01, 0x25, 0x2e] });
    expect(parseTravel(rest, 10)).toEqual([{ pos: 30, depthUm: 10, ad: 0x252e, pressed: false }]);
    const pressed = buildFrame(Cmd.TRAVEL_STREAM, { sub: Travel.KEYS, data: [0x00, 0x3a, ...u16(205), ...u16(0x8000 | 4200)] });
    expect(parseTravel(pressed, 10)).toEqual([{ pos: 58, depthUm: 2050, ad: 4200, pressed: true }]);
    expect(parseTravel(buildFrame(Cmd.TRAVEL_STREAM, { sub: Travel.EXIT }), 10)).toBeNull();
    expect(parseTravel(buildFrame(Cmd.GET_ACTUATION), 10)).toBeNull();
  });

  it("starts, requests and exits live travel, sending the samples to listeners", async () => {
    const { keyboard, sent } = keyboardWith((req) => {
      if (req[0] !== Cmd.TRAVEL_STREAM) return null;
      if (req[1] !== Travel.KEYS) return header(req, 0);
      const data: number[] = [];
      for (let i = 0; i < req[5] / 2; i++) data.push(...u16(readU16(req, 6 + i * 2)), ...u16(i), ...u16(9000));
      return [...header(req, data.length), ...data];
    });
    const got: TravelSample[][] = [];
    const off = keyboard.onTravel((samples) => got.push(samples));
    await keyboard.startTravel();
    await keyboard.requestTravel([30, 43]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await keyboard.stopTravel();
    off();
    expect(sent.map((frame) => [frame[0], frame[1]])).toEqual([
      [0x98, Travel.START],
      [0x98, Travel.KEYS],
      [0x98, Travel.EXIT],
    ]);
    expect(Array.from(sent[1].subarray(5, 10))).toEqual([4, 0, 30, 0, 43]);
    expect(got).toEqual([
      [
        { pos: 30, depthUm: 0, ad: 9000, pressed: false },
        { pos: 43, depthUm: 10, ad: 9000, pressed: false },
      ],
    ]);
  });

  it("never asks for more than 9 keys of live travel in one frame", async () => {
    const { keyboard, sent } = keyboardWith(() => null);
    await expect(keyboard.requestTravel(Array.from({ length: 10 }, (_, i) => i + 1))).rejects.toBeInstanceOf(RangeError);
    expect(sent).toHaveLength(0);
  });

  it("reads calibration ranges 9 keys per request", async () => {
    const { keyboard, sent } = keyboardWith((req) => {
      if (req[0] !== Cmd.CALIBRATION || req[1] !== Calibration.RANGE) return null;
      const data: number[] = [];
      for (let i = 0; i < req[5] / 2; i++) {
        const pos = readU16(req, 6 + i * 2);
        data.push(...u16(pos), ...u16(9000 + pos), ...u16(900 + pos));
      }
      return [...header(req, data.length), ...data];
    });
    const positions = Array.from({ length: 10 }, (_, i) => i + 15);
    const ranges = await keyboard.getCalibrationRanges(positions);
    expect(sent.map((frame) => frame[5])).toEqual([18, 2]);
    expect(ranges).toHaveLength(10);
    expect(ranges[0]).toEqual({ pos: 15, max: 9015, min: 915 });
  });

  it("parses calibration progress: bit 15 of the reading clear means the key finished", () => {
    // Recorded on the keyboard: Z at the bottom, then the frame sent when it came back up.
    const down = buildFrame(Cmd.CALIBRATION, { sub: Calibration.PROGRESS, data: [0x00, 0x38, 0x85, 0xe4, 0x05, 0xe4] });
    expect(parseCalibration(down)).toEqual([{ pos: 56, reading: 1508, min: 1508, finished: false }]);
    const up = buildFrame(Cmd.CALIBRATION, { sub: Calibration.PROGRESS, data: [...u16(56), ...u16(9638), ...u16(1457)] });
    expect(parseCalibration(up)).toEqual([{ pos: 56, reading: 9638, min: 1457, finished: true }]);
    expect(parseCalibration(buildFrame(Cmd.CALIBRATION, { sub: Calibration.START }))).toBeNull();
    expect(parseCalibration(buildFrame(Cmd.TRAVEL_STREAM, { sub: Travel.KEYS }))).toBeNull();
  });

  it("starts and stops calibration; the stop goes out 3 times", async () => {
    const { keyboard, sent } = keyboardWith((req) => (req[0] === Cmd.CALIBRATION ? header(req, 0) : null));
    await keyboard.startCalibration();
    await keyboard.keepCalibrating();
    await keyboard.stopCalibration();
    expect(sent.map((frame) => [frame[0], frame[1]])).toEqual([
      [0x94, Calibration.START],
      [0x94, Calibration.START],
      [0x94, Calibration.STOP],
      [0x94, Calibration.STOP],
      [0x94, Calibration.STOP],
    ]);
  });

  it("a progress frame doesn't count as the echo of start", async () => {
    const { keyboard } = keyboardWith((req) =>
      req[0] === Cmd.CALIBRATION ? [Cmd.CALIBRATION, Calibration.PROGRESS, 0, 1, 0, 6, ...u16(56), ...u16(9000), ...u16(900)] : null,
    );
    await expect(keyboard.keepCalibrating()).rejects.toBeInstanceOf(HidTimeoutError);
  });

  it("retries and then times out", async () => {
    const { device, sent } = fakeDevice(() => null);
    const transport = new HidTransport(device);
    await expect(transport.request(new Uint8Array(63).fill(0x84, 0, 1), { timeoutMs: 10, retries: 2 })).rejects.toBeInstanceOf(
      HidTimeoutError,
    );
    expect(sent).toHaveLength(3);
  });
});
