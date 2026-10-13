import { describe, expect, it } from "vitest";
import { Hero68 } from "../hero68";
import { Cmd, Info, readU16, u16, u32 } from "../protocol";
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

  it("retries and then times out", async () => {
    const { device, sent } = fakeDevice(() => null);
    const transport = new HidTransport(device);
    await expect(transport.request(new Uint8Array(63).fill(0x84, 0, 1), { timeoutMs: 10, retries: 2 })).rejects.toBeInstanceOf(
      HidTimeoutError,
    );
    expect(sent).toHaveLength(3);
  });
});
