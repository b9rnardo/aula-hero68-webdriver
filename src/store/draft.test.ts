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
