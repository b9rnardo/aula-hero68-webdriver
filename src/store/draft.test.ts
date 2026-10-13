import { beforeEach, describe, expect, it } from "vitest";
import { pendingOf, useDraft } from "./draft";
import { useDriver } from "./driver";

describe("draft: switch type", () => {
  beforeEach(() => useDriver.getState().startDemo());

  it("counts a switch change and drops it when it matches the keyboard again", () => {
    const original = useDriver.getState().snapshot!.keys[59].switchType!;
    useDraft.getState().edit("sw", (d) => void (d.sw[59] = original + 1));
    expect(pendingOf(useDraft.getState().draft)).toMatchObject({ sw: 1, keys: 1, total: 1 });
    useDraft.getState().edit("sw", (d) => void (d.sw[59] = original));
    expect(pendingOf(useDraft.getState().draft).total).toBe(0);
  });

  it("writes the switch type before the actuation it may have brought down", async () => {
    const order: string[] = [];
    const { setSwitchType, setActuation } = useDriver.getState();
    useDriver.setState({
      setSwitchType: (positions, type) => (order.push("sw"), setSwitchType(positions, type)),
      setActuation: (positions, um) => (order.push("act"), setActuation(positions, um)),
    });
    useDraft.getState().edit("sw", (d) => {
      d.sw[59] = 25;
      d.act[59] = 2800;
    });
    await useDraft.getState().save();
    expect(order).toEqual(["sw", "act"]);
    expect(useDriver.getState().snapshot!.keys[59]).toMatchObject({ switchType: 25, actuationUm: 2800 });
    expect(pendingOf(useDraft.getState().draft).total).toBe(0);
  });
});

describe("draft: lighting", () => {
  beforeEach(() => {
    useDriver.getState().startDemo();
    useDraft.getState().discard();
  });

  it("drops a light change that matches the keyboard, and ignores the color in rainbow", () => {
    const main = useDriver.getState().snapshot!.lighting.main!;
    useDraft.getState().edit("light.main", (d) => void (d.light.main = { ...main, brightness: main.brightness - 1 }));
    expect(pendingOf(useDraft.getState().draft)).toMatchObject({ light: 1, total: 1 });
    useDraft.getState().edit("light.main", (d) => void (d.light.main = { ...main }));
    expect(pendingOf(useDraft.getState().draft).total).toBe(0);

    useDriver.setState(({ snapshot }) => ({ snapshot: { ...snapshot!, lighting: { ...snapshot!.lighting, main: { ...main, rainbow: true } } } }));
    useDraft.getState().edit("light.main", (d) => void (d.light.main = { ...main, rainbow: true, color: { r: 1, g: 2, b: 3 } }));
    expect(pendingOf(useDraft.getState().draft).total).toBe(0);
  });

  it("counts key colors per key and writes them before the effect that shows them", async () => {
    const order: string[] = [];
    const original = useDriver.getState();
    const main = original.snapshot!.lighting.main!;
    useDriver.setState({
      setKeyColors: (colors) => (order.push("colors"), original.setKeyColors(colors)),
      setLight: (zone, light) => (order.push(`light.${zone}`), original.setLight(zone, light)),
    });
    try {
      useDraft.getState().edit("color", (d) => {
        d.color[1] = { r: 0, g: 255, b: 0 };
        d.color[2] = { r: 0, g: 255, b: 0 };
      });
      useDraft.getState().edit("light.main", (d) => void (d.light.main = { ...main, mode: 1 }));
      expect(pendingOf(useDraft.getState().draft)).toMatchObject({ color: 2, light: 1, total: 3 });
      await useDraft.getState().save();
      expect(order).toEqual(["colors", "light.main"]);
      const snapshot = useDriver.getState().snapshot!;
      expect(snapshot.keys[2].color).toEqual({ r: 0, g: 255, b: 0 });
      expect(snapshot.lighting.main).toMatchObject({ mode: 1 });
      expect(pendingOf(useDraft.getState().draft).total).toBe(0);
    } finally {
      useDriver.setState({ setKeyColors: original.setKeyColors, setLight: original.setLight });
    }
  });
});
