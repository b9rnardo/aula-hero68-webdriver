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

/** Where a key is in the Rapid Trigger rules, carried from one sample to the next. */
export interface TriggerState {
  on: boolean;
  /** Lowest point while on, highest while off; null when the key came from above the actuation point. */
  extreme: number | null;
}

/**
 * Moves a key to `depthUm` through the usual Rapid Trigger rules:
 * - above the actuation point the key is always released;
 * - coming from above, it actuates at the actuation point;
 * - below it, the key resets after rising `releaseUm` from its lowest point, and actuates again after
 *   going `pressUm` down from its highest point since the reset.
 * Without Rapid Trigger the key is simply on below the actuation point.
 * Updates `state` and returns the depth the movement was measured from when Rapid Trigger switched the key.
 */
export function stepRapidTrigger(state: TriggerState, depthUm: number, settings: RapidTriggerSettings): number | undefined {
  const { actuationUm, enabled, pressUm, releaseUm } = settings;
  const { on, extreme } = state;
  if (!enabled || depthUm < actuationUm) {
    state.on = depthUm >= actuationUm;
    state.extreme = null;
  } else if (on) {
    state.extreme = Math.max(extreme ?? depthUm, depthUm);
    if (depthUm <= state.extreme - releaseUm) return reset(state, false, depthUm);
  } else if (extreme === null) {
    state.on = true;
    state.extreme = depthUm;
  } else {
    state.extreme = Math.min(extreme, depthUm);
    if (depthUm >= state.extreme + pressUm) return reset(state, true, depthUm);
  }
  return undefined;
}

function reset(state: TriggerState, on: boolean, depthUm: number) {
  const from = state.extreme!;
  state.on = on;
  state.extreme = depthUm;
  return from;
}

/** Plays a key movement through stepRapidTrigger. */
export function simulateRapidTrigger(movement: Movement, settings: RapidTriggerSettings, samples = 600) {
  const points: TracePoint[] = [];
  const events: TraceEvent[] = [];
  const state: TriggerState = { on: false, extreme: null };

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const depthUm = depthAt(movement, t);
    const was = state.on;
    const fromUm = stepRapidTrigger(state, depthUm, settings);
    if (state.on !== was) events.push({ t, depthUm, on: state.on, fromUm });
    points.push({ t, depthUm, on: state.on });
  }
  return { points, events };
}
