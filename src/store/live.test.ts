import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoSnapshot } from "../data/demo";
import { fakeDevice, header } from "../hid/__tests__/fake-device";
import { Hero68 } from "../hid/hero68";
import { buildFrame, Cmd, readU16, Travel, u16 } from "../hid/protocol";
import { HidTransport } from "../hid/transport";
import { useDriver } from "./driver";
import { useLive } from "./live";

const W = 30;
const A = 43;
const C = 58;

/** Keyboard in measure mode: echoes start and exit; requests are answered from `depth` (µm / 10). */
function measuringKeyboard(depth: Map<number, [number, boolean]>) {
  const fake = fakeDevice((req) => {
    if (req[0] !== Cmd.TRAVEL_STREAM) return null;
    if (req[1] !== Travel.KEYS) return header(req, 0);
    const data: number[] = [];
    for (let i = 0; i < req[5]; i += 2) {
      const pos = readU16(req, 6 + i);
      const [steps, pressed] = depth.get(pos) ?? [0, false];
      data.push(...u16(pos), ...u16(steps), ...u16((pressed ? 0x8000 : 0) | 9000));
    }
    return [...header(req, data.length), ...data];
  });
  /** A frame the keyboard sends by itself. */
  const report = (pos: number, steps: number, pressed: boolean) => {
    const frame = buildFrame(Cmd.TRAVEL_STREAM, { sub: Travel.KEYS, data: [...u16(pos), ...u16(steps), ...u16((pressed ? 0x8000 : 0) | 9000)] });
    fake.device.dispatchEvent(Object.assign(new Event("inputreport"), { reportId: 9, data: new DataView(frame.buffer) }));
  };
  const keyboard = new Hero68(new HidTransport(fake.device));
  useDriver.setState({ keyboard, source: "device", status: "ready", snapshot: demoSnapshot(), writing: false, error: null });
  return { sent: fake.sent, report };
}

const subs = (sent: Uint8Array[]) => sent.filter((frame) => frame[0] === Cmd.TRAVEL_STREAM).map((frame) => frame[1]);

describe("live travel store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("window", new EventTarget());
    vi.stubGlobal("document", Object.assign(new EventTarget(), { hidden: false }));
  });
  afterEach(async () => {
    await useLive.getState().stop();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("follows the first key reported, then the next key pressed, and counts presses", async () => {
    const { report } = measuringKeyboard(new Map());
    await useLive.getState().start();
    expect(useLive.getState().status).toBe("on");

    report(C, 0, false);
    expect(useLive.getState().focus).toBe(C);
    report(W, 120, false);
    expect(useLive.getState().focus).toBe(C);
    report(W, 210, true);
    expect(useLive.getState().focus).toBe(W);
    expect(useLive.getState().trace).toEqual([expect.objectContaining({ depthUm: 2100, pressed: true })]);
    report(W, 220, true);
    report(W, 10, false);
    report(W, 230, true);
    expect(useLive.getState().hits[W]).toBe(2);

    // While W is held, pressing A doesn't take the focus away.
    report(W, 250, true);
    report(A, 300, true);
    expect(useLive.getState().focus).toBe(W);
  });

  it("stays on a key picked on screen until it's picked again", async () => {
    const { report } = measuringKeyboard(new Map());
    await useLive.getState().start();
    report(C, 0, false);
    useLive.getState().follow(W);
    report(A, 300, true);
    expect(useLive.getState().focus).toBe(W);
    useLive.getState().follow(W);
    report(A, 10, false);
    report(A, 300, true);
    expect(useLive.getState().focus).toBe(A);
  });

  it("asks for the followed key first and never more than 9 keys per frame", async () => {
    const { sent, report } = measuringKeyboard(new Map([[W, [150, false]]]));
    await useLive.getState().start();
    report(W, 150, false);
    for (let pos = 1; pos <= 12; pos++) report(pos, 100, false);
    await vi.advanceTimersByTimeAsync(100);
    const request = sent.filter((frame) => frame[0] === Cmd.TRAVEL_STREAM && frame[1] === Travel.KEYS)[0];
    expect(request[5]).toBe(18);
    expect(readU16(request, 6)).toBe(W);
  });

  it("forgets keys that stop being reported, except the followed one", async () => {
    const { report } = measuringKeyboard(new Map());
    await useLive.getState().start();
    report(W, 0, false);
    report(A, 300, false);
    await vi.advanceTimersByTimeAsync(500);
    // A is still asked for while it's down; the fake keyboard answers it back at rest.
    report(A, 0, false);
    await vi.advanceTimersByTimeAsync(500);
    expect(Object.keys(useLive.getState().keys).map(Number)).toEqual([W]);
  });

  it("exits measure mode before anything else is written", async () => {
    const { sent } = measuringKeyboard(new Map());
    await useLive.getState().start();
    useDriver.setState({ writing: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(useLive.getState().status).toBe("off");
    expect(subs(sent)).toEqual([Travel.START, Travel.EXIT]);
  });

  it("stops when the tab is hidden", async () => {
    const { sent } = measuringKeyboard(new Map());
    await useLive.getState().start();
    Object.assign(document, { hidden: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(useLive.getState().status).toBe("off");
    expect(subs(sent).at(-1)).toBe(Travel.EXIT);
  });

  it("stays off for a backup file", async () => {
    useDriver.setState({ keyboard: null, source: "file", status: "ready", snapshot: demoSnapshot() });
    await useLive.getState().start();
    expect(useLive.getState().status).toBe("off");
  });
});
