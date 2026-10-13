import { useI18n } from "../i18n";
import { simulateRapidTrigger, type Movement, type RapidTriggerSettings, type TraceEvent, type TracePoint } from "../lib/rapidTrigger";

interface Props extends RapidTriggerSettings {
  travelUm: number;
}

const WIDTH = 324;
const HEIGHT = 168;
const LEFT = 40;
const RIGHT = 318;
const TOP = 10;
const BOTTOM = 148;

/** Typical repeated press: down deep, partly up, down again, fully up (fractions of the travel). */
const MOVEMENT: [number, number][] = [
  [0, 0],
  [0.04, 0],
  [0.3, 0.82],
  [0.47, 0.5],
  [0.64, 0.76],
  [0.92, 0],
  [1, 0],
];

/** Splits the trace into runs with the same on/off state; each run starts where the previous ended. */
function runs(points: TracePoint[]) {
  const out: { on: boolean; points: TracePoint[] }[] = [];
  for (const point of points) {
    const last = out[out.length - 1];
    if (last?.on === point.on) last.points.push(point);
    else out.push({ on: point.on, points: last ? [last.points[last.points.length - 1], point] : [point] });
  }
  return out;
}

/**
 * Depth-over-time picture of a key pressed and released with the given settings: where it actuates,
 * where it resets, and the Rapid Trigger distances that caused each.
 */
export function RapidTriggerChart({ travelUm, ...settings }: Props) {
  const { t, mm } = useI18n();
  const movement: Movement = MOVEMENT.map(([time, depth]) => [time, depth * travelUm]);
  const { points, events } = simulateRapidTrigger(movement, settings);

  const x = (time: number) => LEFT + time * (RIGHT - LEFT);
  const y = (um: number) => TOP + (Math.max(0, Math.min(travelUm, um)) / travelUm) * (BOTTOM - TOP);
  const path = (run: TracePoint[]) => run.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)} ${y(p.depthUm).toFixed(1)}`).join(" ");
  const firstOf = (on: boolean) => events.find((e) => e.on === on && e.fromUm !== undefined);
  const brackets = [firstOf(false), firstOf(true)].filter((e): e is TraceEvent & { fromUm: number } => e !== undefined);
  const actuationY = y(settings.actuationUm);
  /** Travel ends are labelled only when the actuation label leaves them room. */
  const clear = (edgeY: number) => Math.abs(edgeY - actuationY) >= 12;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-42 w-auto max-w-full" role="img" aria-label={t("rt.chart")}>
      {/* Axes: top and bottom of the travel, actuation point (named in the legend) */}
      <line x1={LEFT} y1={TOP} x2={RIGHT} y2={TOP} className="stroke-key-line" />
      <line x1={LEFT} y1={BOTTOM} x2={RIGHT} y2={BOTTOM} className="stroke-key-line" />
      {clear(TOP) && (
        <text x={LEFT - 6} y={TOP + 4} textAnchor="end" className="fill-subtle text-[10px]">
          0 mm
        </text>
      )}
      {clear(BOTTOM) && (
        <text x={LEFT - 6} y={BOTTOM + 4} textAnchor="end" className="fill-subtle text-[10px]">
          {mm(travelUm)}
        </text>
      )}
      <line x1={LEFT} y1={actuationY} x2={RIGHT} y2={actuationY} className="stroke-muted" strokeDasharray="3 4" />
      <text x={LEFT - 6} y={actuationY + 4} textAnchor="end" className="fill-fg-2 text-[10px] font-semibold">
        {mm(settings.actuationUm)}
      </text>
      <text x={RIGHT} y={BOTTOM + 16} textAnchor="end" className="fill-subtle text-[10px]">
        {t("rt.chartTime")} →
      </text>

      {/* Key movement: muted while released, accent while active */}
      {runs(points).map((run, i) =>
        run.on ? (
          <path
            key={i}
            d={path(run.points)}
            fill="none"
            className="stroke-accent"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: "drop-shadow(0 0 4px var(--color-glow))" }}
          />
        ) : (
          <path key={i} d={path(run.points)} fill="none" className="stroke-subtle" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        ),
      )}

      {/* Rapid Trigger distances: release before the first reset, press before the second actuation */}
      {brackets.map((event) => {
        // Drawn and labelled with the configured distance; the sampled trace only lands close to it.
        const distance = event.on ? settings.pressUm : settings.releaseUm;
        const toUm = event.fromUm + (event.on ? distance : -distance);
        const bx = x(event.t) + 9;
        const label = `${event.on ? "↓" : "↑"} ${mm(distance)}`;
        return (
          <g key={event.t} className="stroke-accent" strokeWidth="1.2">
            <line x1={bx - 4} y1={y(event.fromUm)} x2={bx + 4} y2={y(event.fromUm)} />
            <line x1={bx} y1={y(event.fromUm)} x2={bx} y2={y(toUm)} />
            <line x1={bx - 4} y1={y(toUm)} x2={bx + 4} y2={y(toUm)} />
            {/* Outlined in the background color so the label stays legible over the trace */}
            <text
              x={bx + 7}
              y={(y(event.fromUm) + y(toUm)) / 2 + 4}
              strokeWidth="4"
              strokeLinejoin="round"
              paintOrder="stroke"
              className="fill-accent stroke-panel text-[11px] font-bold"
            >
              {label}
            </text>
          </g>
        );
      })}

      {/* Actuations (filled) and resets (hollow) */}
      {events.map((event) => (
        <circle
          key={event.t}
          cx={x(event.t)}
          cy={y(event.depthUm)}
          r="4.5"
          strokeWidth="2"
          className={event.on ? "fill-accent stroke-accent" : "fill-panel stroke-accent"}
        />
      ))}
    </svg>
  );
}
