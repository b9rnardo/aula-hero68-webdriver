import { describe, expect, it } from "vitest";
import { describeKey, keyLegend } from "./keycodes";

describe("keycodes", () => {
  it("names plain keys", () => {
    expect(keyLegend(0x04)).toBe("A");
    expect(keyLegend(0x0d000000)).toBe("Fn");
  });

  it("describes modifier combos and macros", () => {
    expect(describeKey(0x00030400)).toEqual({ kind: "combo", label: "Ctrl+Shift+A" });
    expect(keyLegend(0x00010600)).toBe("Ctrl+C");
    expect(describeKey(0x03010002)).toMatchObject({ kind: "macro", label: "M3" });
  });

  it("names the factory Fn-layer functions", () => {
    expect(keyLegend(0x08030100)).toBe("☀+");
    expect(keyLegend(0x08040001)).toBe("S·Spd");
    expect(keyLegend(0x07000001)).toBe("WinL");
  });

  it("falls back to hex", () => {
    expect(keyLegend(0x0a0b0c0d)).toBe("0x0a0b0c0d");
    expect(keyLegend(0xffffffff)).toBe("??");
  });
});
