import { describe, expect, it } from "vitest";
import { simulateRapidTrigger, type Movement } from "./rapidTrigger";

// Down to 2.8 mm, up to 1.7, down to 2.5, back to the top.
const movement: Movement = [
  [0, 0],
  [0.3, 2800],
  [0.5, 1700],
  [0.7, 2500],
  [1, 0],
];
const kinds = (events: { on: boolean }[]) => events.map((e) => (e.on ? "press" : "reset"));

describe("simulateRapidTrigger", () => {
  it("presses and resets only at the actuation point without Rapid Trigger", () => {
    const { events } = simulateRapidTrigger(movement, { actuationUm: 700, enabled: false, pressUm: 400, releaseUm: 400 });
    expect(kinds(events)).toEqual(["press", "reset"]);
    expect(events[1].depthUm).toBeLessThan(700);
  });

  it("resets on the way up and presses again on the way down", () => {
    const { events } = simulateRapidTrigger(movement, { actuationUm: 700, enabled: true, pressUm: 400, releaseUm: 400 });
    expect(kinds(events)).toEqual(["press", "reset", "press", "reset"]);
    expect(events[1].fromUm).toBeCloseTo(2800, -2);
    expect(events[1].depthUm).toBeCloseTo(2400, -2);
    expect(events[2].fromUm).toBeCloseTo(1700, -2);
    expect(events[2].depthUm).toBeCloseTo(2100, -2);
  });

  it("keeps the key on when the rise is smaller than the release distance", () => {
    const { events } = simulateRapidTrigger(movement, { actuationUm: 700, enabled: true, pressUm: 400, releaseUm: 2000 });
    expect(kinds(events)).toEqual(["press", "reset"]);
    expect(events[1].depthUm).toBeCloseTo(800, -2);
  });
});
