export interface RapidTriggerSettings {
  actuationUm: number;
  enabled: boolean;
  pressUm: number;
  releaseUm: number;
}

export interface TracePoint {
  t: number;
  depthUm: number;
  on: boolean;
}

export interface TraceEvent extends TracePoint {
  /** Depth the movement was measured from, for Rapid Trigger presses and resets. */
  fromUm?: number;
}

/** Key movement as (time 0–1, depth in µm) waypoints, linear in between. */
export type Movement = [number, number][];

function depthAt(movement: Movement, t: number) {
  for (let i = 1; i < movement.length; i++) {
    const [t0, d0] = movement[i - 1];
    const [t1, d1] = movement[i];
    if (t <= t1) return t1 === t0 ? d1 : d0 + ((d1 - d0) * (t - t0)) / (t1 - t0);
  }
  return movement[movement.length - 1][1];
}

/**
 * Plays a key movement through the usual Rapid Trigger rules:
 * - above the actuation point the key is always released;
 * - coming from above, it actuates at the actuation point;
 * - below it, the key resets after rising `releaseUm` from its lowest point, and actuates again after
 *   going `pressUm` down from its highest point since the reset.
 * Without Rapid Trigger the key is simply on below the actuation point.
 */
export function simulateRapidTrigger(movement: Movement, settings: RapidTriggerSettings, samples = 600) {
  const { actuationUm, enabled, pressUm, releaseUm } = settings;
  const points: TracePoint[] = [];
  const events: TraceEvent[] = [];
  let on = false;
  /** Lowest point while on, highest while off; null when the key came from above the actuation point. */
  let extreme: number | null = null;

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const depthUm = depthAt(movement, t);
    let next: boolean = on;
    let fromUm: number | undefined;

    if (!enabled || depthUm < actuationUm) {
      next = depthUm >= actuationUm;
      extreme = null;
    } else if (on) {
      extreme = Math.max(extreme ?? depthUm, depthUm);
      if (depthUm <= extreme - releaseUm) [next, fromUm, extreme] = [false, extreme, depthUm];
    } else if (extreme === null) {
      [next, extreme] = [true, depthUm];
    } else {
      extreme = Math.min(extreme, depthUm);
      if (depthUm >= extreme + pressUm) [next, fromUm, extreme] = [true, extreme, depthUm];
    }

    if (next !== on) events.push({ t, depthUm, on: next, fromUm });
    on = next;
    points.push({ t, depthUm, on });
  }
  return { points, events };
}
