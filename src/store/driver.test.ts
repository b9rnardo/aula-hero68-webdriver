import { beforeEach, describe, expect, it } from "vitest";
import { demoSnapshot } from "../data/demo";
import { fakeDevice, header } from "../hid/__tests__/fake-device";
import { Hero68 } from "../hid/hero68";
import { Cmd, readU16, u16 } from "../hid/protocol";
import { HidTransport } from "../hid/transport";
import { useDriver } from "./driver";

/** Keyboard that stores actuation (raw steps) and global flags per key, like the firmware does. */
function connectedKeyboard(stored: Map<number, { steps: number; global: number }>, { ignoreWrites = false } = {}) {
  const fake = fakeDevice((req) => {
    const length = req[5];
    if (req[0] === Cmd.GET_ACTUATION) {
      const data: number[] = [];
      for (let i = 0; i < length; i += 2) {
        const pos = readU16(req, 6 + i);
        const key = stored.get(pos) ?? { steps: 100, global: 1 };
        data.push(...u16(pos), ...u16(key.steps), key.global);
      }
      return [...header(req, data.length), ...data];
    }
    if (req[0] === Cmd.SET_ACTUATION) {
      for (let i = 0; i < length && !ignoreWrites; i += 5)
        stored.set(readU16(req, 6 + i), { steps: readU16(req, 8 + i), global: req[10 + i] });
      return [...header(req, length), ...req.subarray(6, 6 + length)];
    }
    return null;
  });
  const keyboard = new Hero68(new HidTransport(fake.device));
  useDriver.setState({ keyboard, source: "device", status: "ready", snapshot: demoSnapshot(), writing: false, error: null });
  return fake.sent;
}

/** Keyboard that stores Rapid Trigger records (raw steps) per key. */
function rapidTriggerKeyboard(stored: Map<number, number[]>) {
  const fake = fakeDevice((req) => {
    const length = req[5];
    if (req[0] === Cmd.GET_RAPID_TRIGGER) {
      const data: number[] = [];
      for (let i = 0; i < length; i += 2) {
        const pos = readU16(req, 6 + i);
        data.push(...u16(pos), ...(stored.get(pos) ?? [0, 0, 40, 0, 40, 1]));
      }
      return [...header(req, data.length), ...data];
    }
    if (req[0] === Cmd.SET_RAPID_TRIGGER) {
      for (let i = 0; i < length; i += 8) stored.set(readU16(req, 6 + i), Array.from(req.subarray(8 + i, 14 + i)));
      return [...header(req, length), ...req.subarray(6, 6 + length)];
    }
    return null;
  });
  useDriver.setState({ keyboard: new Hero68(new HidTransport(fake.device)), source: "device", status: "ready", snapshot: demoSnapshot() });
  return fake.sent;
}

describe("driver store: rapid trigger write", () => {
  beforeEach(() => useDriver.setState({ keyboard: null, source: null, snapshot: null, error: null, writing: false }));

  it("changes only the given fields and keeps the rest of each key", async () => {
    // V: on, press 0.84, release 1.51. B: off, press 0.20, release 0.20.
    const stored = new Map([
      [59, [1, ...u16(84), ...u16(151), 1]],
      [60, [0, ...u16(20), ...u16(20), 1]],
    ]);
    rapidTriggerKeyboard(stored);
    expect(await useDriver.getState().setRapidTrigger([59, 60], { pressUm: 300 })).toBe(true);
    expect(stored.get(59)).toEqual([1, ...u16(30), ...u16(151), 1]);
    expect(stored.get(60)).toEqual([0, ...u16(30), ...u16(20), 1]);
    expect(useDriver.getState().snapshot?.keys[60].rapidTrigger).toEqual({ enabled: false, pressUm: 300, releaseUm: 200 });
  });

  it("turns rapid trigger on and reports values the keyboard didn't keep", async () => {
    const stored = new Map([[59, [0, ...u16(40), ...u16(40), 1]]]);
    rapidTriggerKeyboard(stored);
    expect(await useDriver.getState().setRapidTrigger([59], { enabled: true })).toBe(true);
    expect(stored.get(59)?.[0]).toBe(1);

    stored.set = () => stored; // the keyboard ignores writes from now on
    expect(await useDriver.getState().setRapidTrigger([59], { releaseUm: 900 })).toBe(false);
    expect(useDriver.getState().error).not.toBeNull();
  });
});

describe("driver store: actuation write", () => {
  beforeEach(() => useDriver.setState({ keyboard: null, source: null, snapshot: null, error: null, writing: false }));

  it("keeps each key's global flag, writes, and stores the value read back", async () => {
    const stored = new Map([[59, { steps: 10, global: 0 }]]);
    const sent = connectedKeyboard(stored);
    expect(await useDriver.getState().setActuation([59], 505)).toBe(true);
    expect(stored.get(59)).toEqual({ steps: 51, global: 0 });
    expect(sent.map((frame) => frame[0])).toEqual([Cmd.GET_ACTUATION, Cmd.SET_ACTUATION, Cmd.GET_ACTUATION]);
    expect(useDriver.getState().snapshot?.keys[59].actuationUm).toBe(510);
    expect(useDriver.getState().error).toBeNull();
  });

  it("reports a write the keyboard didn't keep", async () => {
    const stored = new Map([[59, { steps: 10, global: 1 }]]);
    connectedKeyboard(stored, { ignoreWrites: true });
    expect(await useDriver.getState().setActuation([59], 500)).toBe(false);
    expect(useDriver.getState().snapshot?.keys[59].actuationUm).toBe(100);
    expect(useDriver.getState().error).not.toBeNull();
  });

  it("never writes to an unknown model", async () => {
    const sent = connectedKeyboard(new Map());
    const snapshot = useDriver.getState().snapshot!;
    useDriver.setState({ snapshot: { ...snapshot, device: { ...snapshot.device, uuid: "999999999999" } } });
    expect(await useDriver.getState().setActuation([59], 500)).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it("only changes the local copy in the demo", async () => {
    useDriver.getState().startDemo();
    expect(await useDriver.getState().setActuation([59, 60], 1500)).toBe(true);
    expect(useDriver.getState().snapshot?.keys[60].actuationUm).toBe(1500);
  });
});
