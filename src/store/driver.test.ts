import { beforeEach, describe, expect, it } from "vitest";
import { demoSnapshot } from "../data/demo";
import { fakeDevice, header } from "../hid/__tests__/fake-device";
import { Hero68 } from "../hid/hero68";
import { Cmd, Config, readU16, readU32, u16, u32 } from "../hid/protocol";
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

/** Keyboard that stores dead zone records (raw steps) per key: top, bottom, global, on/off. */
function deadZoneKeyboard(stored: Map<number, number[]>) {
  const fake = fakeDevice((req) => {
    const length = req[5];
    if (req[0] === Cmd.GET_DEAD_ZONE) {
      const data: number[] = [];
      for (let i = 0; i < length; i += 2) {
        const pos = readU16(req, 6 + i);
        data.push(...u16(pos), ...(stored.get(pos) ?? [...u16(10), ...u16(10), 1, 0]));
      }
      return [...header(req, data.length), ...data];
    }
    if (req[0] === Cmd.SET_DEAD_ZONE) {
      for (let i = 0; i < length; i += 8) stored.set(readU16(req, 6 + i), Array.from(req.subarray(8 + i, 14 + i)));
      return [...header(req, length), ...req.subarray(6, 6 + length)];
    }
    return null;
  });
  useDriver.setState({ keyboard: new Hero68(new HidTransport(fake.device)), source: "device", status: "ready", snapshot: demoSnapshot() });
  return fake.sent;
}

describe("driver store: dead zone write", () => {
  beforeEach(() => useDriver.setState({ keyboard: null, source: null, snapshot: null, error: null, writing: false }));

  it("changes only the given fields and keeps the rest of each key", async () => {
    // V: off, 0.10 / 0.10. B: on, top 0.20, bottom 0.30.
    const stored = new Map([
      [59, [...u16(10), ...u16(10), 1, 0]],
      [60, [...u16(20), ...u16(30), 1, 1]],
    ]);
    deadZoneKeyboard(stored);
    expect(await useDriver.getState().setDeadZones([59, 60], { bottomUm: 250 })).toBe(true);
    expect(stored.get(59)).toEqual([...u16(10), ...u16(25), 1, 0]);
    expect(stored.get(60)).toEqual([...u16(20), ...u16(25), 1, 1]);
    expect(useDriver.getState().snapshot?.keys[60].deadZone).toEqual({ enabled: true, topUm: 200, bottomUm: 250 });
  });

  it("turns dead zones on and reports values the keyboard didn't keep", async () => {
    const stored = new Map([[59, [...u16(10), ...u16(10), 1, 0]]]);
    deadZoneKeyboard(stored);
    expect(await useDriver.getState().setDeadZones([59], { enabled: true, topUm: 0 })).toBe(true);
    expect(stored.get(59)).toEqual([...u16(0), ...u16(10), 1, 1]);

    stored.set = () => stored; // the keyboard ignores writes from now on
    expect(await useDriver.getState().setDeadZones([59], { topUm: 300 })).toBe(false);
    expect(useDriver.getState().error).not.toBeNull();
  });
});

/** Keyboard that keeps a keymap layer and the one-byte settings, like the firmware does. */
function settingsKeyboard(keymap: Map<number, number>, config: Map<number, number>) {
  const fake = fakeDevice((req) => {
    const length = req[5];
    if (req[0] === Cmd.GET_KEYS) {
      const data: number[] = [];
      for (let i = 0; i < length; i += 2) {
        const pos = readU16(req, 6 + i);
        data.push(...u16(pos), ...u32(keymap.get(pos) ?? 0));
      }
      return [...header(req, data.length), ...data];
    }
    if (req[0] === Cmd.SET_KEYS) {
      for (let i = 0; i < length; i += 6) keymap.set(readU16(req, 6 + i), readU32(req, 8 + i));
      return [...header(req, length), ...req.subarray(6, 6 + length)];
    }
    if (req[0] === Cmd.SET_CONFIG) {
      config.set(req[1], req[6]);
      return [...header(req, 1), req[6]];
    }
    if (req[0] === Cmd.GET_CONFIG) return [...header(req, 1), config.get(req[1]) ?? 0];
    return null;
  });
  const keyboard = new Hero68(new HidTransport(fake.device));
  useDriver.setState({ keyboard, source: "device", status: "ready", snapshot: demoSnapshot(), writing: false, error: null });
  return fake.sent;
}

describe("driver store: keymap and settings writes", () => {
  beforeEach(() => useDriver.setState({ keyboard: null, source: null, snapshot: null, error: null, writing: false }));

  it("writes key functions on a layer and keeps what the keyboard reads back", async () => {
    const keymap = new Map([[59, 0x19], [60, 0x05], [61, 0x06]]);
    settingsKeyboard(keymap, new Map());
    expect(await useDriver.getState().setKeymap(1, [{ pos: 59, code: 0x0d010000 }, { pos: 60, code: 0 }])).toBe(true);
    expect(keymap.get(59)).toBe(0x0d010000);
    expect(useDriver.getState().snapshot?.layers[1][59]).toBe(0x0d010000);
    expect(useDriver.getState().snapshot?.layers[1][60]).toBe(0);

    keymap.set = () => keymap; // the keyboard ignores writes from now on
    expect(await useDriver.getState().setKeymap(0, [{ pos: 61, code: 0x05 }])).toBe(false);
    expect(useDriver.getState().snapshot?.layers[0][61]).toBe(0x06);
    expect(useDriver.getState().error).not.toBeNull();
  });

  it("switches a setting and confirms it with a read", async () => {
    const config = new Map([[Config.WIN_LOCK, 1]]);
    const sent = settingsKeyboard(new Map(), config);
    expect(await useDriver.getState().setSetting("winLock", false)).toBe(true);
    expect(config.get(Config.WIN_LOCK)).toBe(0);
    expect(sent.map((frame) => frame[0])).toEqual([Cmd.SET_CONFIG, Cmd.GET_CONFIG]);
    expect(useDriver.getState().snapshot?.settings.winLock).toBe(false);
  });

  it("reads the polling level back when the keyboard doesn't reconnect", async () => {
    const config = new Map([[Config.POLLING, 0]]);
    settingsKeyboard(new Map(), config);
    expect(await useDriver.getState().setPolling(1)).toBe(true);
    expect(useDriver.getState().snapshot?.settings.pollingLevel).toBe(1);
  }, 5000);

  it("only changes the local copy in the demo", async () => {
    useDriver.getState().startDemo();
    expect(await useDriver.getState().setSetting("macMode", true)).toBe(true);
    expect(await useDriver.getState().setPolling(4)).toBe(true);
    expect(await useDriver.getState().setKeymap(0, [{ pos: 59, code: 0x05 }])).toBe(true);
    const { settings, layers } = useDriver.getState().snapshot!;
    expect([settings.macMode, settings.pollingLevel, layers[0][59]]).toEqual([true, 4, 0x05]);
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

/** Keyboard that keeps one switch type per key. */
function switchKeyboard(stored: Map<number, number>, { ignoreWrites = false } = {}) {
  const fake = fakeDevice((req) => {
    const length = req[5];
    if (req[0] === Cmd.GET_SWITCH_TYPE) {
      const data: number[] = [];
      for (let i = 0; i < length; i += 2) {
        const pos = readU16(req, 6 + i);
        data.push(...u16(pos), stored.get(pos) ?? 0);
      }
      return [...header(req, data.length), ...data];
    }
    if (req[0] === Cmd.SET_SWITCH_TYPE) {
      for (let i = 0; i < length && !ignoreWrites; i += 3) stored.set(readU16(req, 6 + i), req[8 + i]);
      return [...header(req, length), ...req.subarray(6, 6 + length)];
    }
    return null;
  });
  useDriver.setState({ keyboard: new Hero68(new HidTransport(fake.device)), source: "device", status: "ready", snapshot: demoSnapshot() });
  return fake.sent;
}

describe("driver store: switch type write", () => {
  beforeEach(() => useDriver.setState({ keyboard: null, source: null, snapshot: null, error: null, writing: false }));

  it("writes the type, reads it back and stores it", async () => {
    const stored = new Map([[59, 0], [60, 0]]);
    const sent = switchKeyboard(stored);
    expect(await useDriver.getState().setSwitchType([59, 60], 25)).toBe(true);
    expect([stored.get(59), stored.get(60)]).toEqual([25, 25]);
    expect(sent.map((frame) => frame[0])).toEqual([Cmd.SET_SWITCH_TYPE, Cmd.GET_SWITCH_TYPE]);
    expect(useDriver.getState().snapshot?.keys[60].switchType).toBe(25);
    expect(useDriver.getState().error).toBeNull();
  });

  it("reports a type the keyboard didn't keep", async () => {
    switchKeyboard(new Map([[59, 0]]), { ignoreWrites: true });
    expect(await useDriver.getState().setSwitchType([59], 25)).toBe(false);
    expect(useDriver.getState().snapshot?.keys[59].switchType).toBe(0);
    expect(useDriver.getState().error).not.toBeNull();
  });

  it("only changes the local copy in the demo", async () => {
    useDriver.getState().startDemo();
    expect(await useDriver.getState().setSwitchType([59], 25)).toBe(true);
    expect(useDriver.getState().snapshot?.keys[59].switchType).toBe(25);
  });
});
