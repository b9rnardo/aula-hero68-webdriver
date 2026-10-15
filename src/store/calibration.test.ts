import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoSnapshot } from "../data/demo";
import { POSITIONS } from "../data/layout";
import { fakeDevice, header } from "../hid/__tests__/fake-device";
import { Hero68 } from "../hid/hero68";
import { buildFrame, Calibration, Cmd, readU16, u16 } from "../hid/protocol";
import { HidTransport } from "../hid/transport";
import { useCalibration } from "./calibration";
import { useDraft } from "./draft";
import { useDriver } from "./driver";

const Z = 56;
const X = 57;

/** Keyboard that echoes start and stop and answers ranges from `ranges` (pos → [max, min]). */
function calibratingKeyboard(ranges: Map<number, [number, number]>) {
  const fake = fakeDevice((req) => {
    if (req[0] !== Cmd.CALIBRATION) return null;
    if (req[1] !== Calibration.RANGE) return header(req, 0);
    const data: number[] = [];
    for (let i = 0; i < req[5]; i += 2) {
      const pos = readU16(req, 6 + i);
      const [max, min] = ranges.get(pos) ?? [9000, 900];
      data.push(...u16(pos), ...u16(max), ...u16(min));
    }
    return [...header(req, data.length), ...data];
  });
  /** A progress frame the keyboard sends by itself. */
  const report = (pos: number, reading: number, min: number, finished: boolean) => {
    const frame = buildFrame(Cmd.CALIBRATION, { sub: Calibration.PROGRESS, data: [...u16(pos), ...u16((finished ? 0 : 0x8000) | reading), ...u16(min)] });
    fake.device.dispatchEvent(Object.assign(new Event("inputreport"), { reportId: 9, data: new DataView(frame.buffer) }));
  };
  /** Presses a key to `min` and lets it back up to `max`, like the keyboard reports it. */
  const press = (pos: number, min: number, max = 9000) => {
    report(pos, min, min, false);
    report(pos, max, min, true);
    ranges.set(pos, [max, min]);
  };
  const keyboard = new Hero68(new HidTransport(fake.device));
  useDriver.setState({ keyboard, source: "device", status: "ready", snapshot: demoSnapshot(), writing: false, error: null });
  return { sent: fake.sent, report, press };
}

const subs = (sent: Uint8Array[]) => sent.filter((frame) => frame[0] === Cmd.CALIBRATION).map((frame) => frame[1]);

/** Stop waits 100 ms between its frames. */
async function finish() {
  const done = useCalibration.getState().stop();
  await vi.advanceTimersByTimeAsync(1000);
  await done;
}

describe("calibration store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("window", new EventTarget());
    vi.stubGlobal("document", Object.assign(new EventTarget(), { hidden: false }));
    useCalibration.setState({ keys: {}, ranges: {}, error: null });
    useDraft.setState({ toast: null, saving: null });
    useDriver.setState({ lang: "pt" });
  });
  afterEach(async () => {
    await finish();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reads the ranges, starts, keeps calibrating every second and marks keys that finished", async () => {
    const { sent, report } = calibratingKeyboard(new Map());
    await useCalibration.getState().start();
    expect(useCalibration.getState().status).toBe("on");
    expect(Object.keys(useCalibration.getState().ranges)).toHaveLength(POSITIONS.length);
    expect(subs(sent).filter((sub) => sub === Calibration.RANGE)).toHaveLength(Math.ceil(POSITIONS.length / 9));

    report(Z, 1500, 1500, false);
    expect(useCalibration.getState().keys[Z]).toEqual({ reading: 1500, min: 1500, done: false });
    report(Z, 9600, 1450, true);
    // The keyboard keeps reporting the key after it finished; it stays done.
    report(Z, 9600, 1450, false);
    expect(useCalibration.getState().keys[Z].done).toBe(true);

    await vi.advanceTimersByTimeAsync(2100);
    expect(subs(sent).filter((sub) => sub === Calibration.START)).toHaveLength(3);
  });

  it("finishes with 3 stops and confirms the keys against the ranges read back", async () => {
    const { sent, press } = calibratingKeyboard(new Map());
    await useCalibration.getState().start();
    press(Z, 1450);
    press(X, 490);
    sent.length = 0;
    await finish();
    expect(useCalibration.getState().status).toBe("off");
    expect(subs(sent)).toEqual([Calibration.STOP, Calibration.STOP, Calibration.STOP, Calibration.RANGE]);
    expect(useDraft.getState().toast).toMatchObject({ tone: "ok", text: "2 teclas calibradas" });
    // The stage keeps showing what was calibrated.
    expect(useCalibration.getState().keys[Z].done).toBe(true);
  });

  it("says so when the keyboard didn't keep a key", async () => {
    const ranges = new Map<number, [number, number]>();
    const { press } = calibratingKeyboard(ranges);
    await useCalibration.getState().start();
    press(Z, 1450);
    press(X, 490);
    ranges.set(X, [9000, 900]);
    await finish();
    expect(useDraft.getState().toast).toMatchObject({ tone: "bad" });
  });

  it("ignores the keyboard on the page while calibrating", async () => {
    calibratingKeyboard(new Map());
    await useCalibration.getState().start();
    const key = new Event("keydown", { cancelable: true });
    window.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(true);
    await finish();
    const after = new Event("keydown", { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });

  it("leaves calibration before anything else is written, without reading back", async () => {
    const { sent, press } = calibratingKeyboard(new Map());
    await useCalibration.getState().start();
    press(Z, 1450);
    sent.length = 0;
    useDriver.setState({ writing: true });
    await vi.advanceTimersByTimeAsync(1000);
    expect(useCalibration.getState().status).toBe("off");
    expect(subs(sent)).toEqual([Calibration.STOP, Calibration.STOP, Calibration.STOP]);
  });

  it("finishes when the tab is hidden", async () => {
    const { sent } = calibratingKeyboard(new Map());
    await useCalibration.getState().start();
    Object.assign(document, { hidden: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(useCalibration.getState().status).toBe("off");
    expect(subs(sent).at(-1)).toBe(Calibration.STOP);
    expect(useDraft.getState().toast).toMatchObject({ tone: "info" });
  });

  it("doesn't start for a backup file or while writing", async () => {
    useDriver.setState({ keyboard: null, source: "file", status: "ready", snapshot: demoSnapshot() });
    await useCalibration.getState().start();
    expect(useCalibration.getState().status).toBe("off");
    const { sent } = calibratingKeyboard(new Map());
    useDriver.setState({ writing: true });
    await useCalibration.getState().start();
    expect(useCalibration.getState().status).toBe("off");
    expect(sent).toHaveLength(0);
  });
});
