import { useId } from "react";
import { useI18n } from "../i18n";

interface Props {
  travelUm: number;
  actuationUm: number;
  enabled: boolean;
  topUm: number;
  bottomUm: number;
}

const WIDTH = 324;
const HEIGHT = 168;
const LEFT = 40;
const RIGHT = 318;
const TOP = 10;
const BOTTOM = 148;

/** A full press: down to the bottom, held, and back up (time 0–1, fraction of the travel). */
const MOVEMENT: [number, number][] = [
  [0, 0],
  [0.06, 0],
  [0.35, 1],
  [0.65, 1],
  [0.94, 0],
  [1, 0],
];
const SAMPLES = 400;

function depthAt(time: number) {
  for (let i = 1; i < MOVEMENT.length; i++) {
    const [t0, d0] = MOVEMENT[i - 1];
    const [t1, d1] = MOVEMENT[i];
    if (time <= t1) return t1 === t0 ? d1 : d0 + ((d1 - d0) * (time - t0)) / (t1 - t0);
  }
  return MOVEMENT[MOVEMENT.length - 1][1];
}

/**
 * Depth-over-time picture of a full key press with the dead zones as hatched bands: the parts of the
 * movement inside them are ignored, the rest is where the key responds.
 */
export function DeadZoneChart({ travelUm, actuationUm, enabled, topUm, bottomUm }: Props) {
  const { t, mm } = useI18n();
  const hatch = `${useId()}hatch`;
  const x = (time: number) => LEFT + time * (RIGHT - LEFT);
  const y = (um: number) => TOP + (Math.max(0, Math.min(travelUm, um)) / travelUm) * (BOTTOM - TOP);
  const ignored = (um: number) => enabled && (um < topUm || um > travelUm - bottomUm);

  // Runs of the trace with the same state; each run starts where the previous ended.
  const runs: { ignored: boolean; points: string[] }[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const time = i / SAMPLES;
    const um = depthAt(time) * travelUm;
    const point = `${x(time).toFixed(1)} ${y(um).toFixed(1)}`;
    const state = ignored(um);
    const run = runs.at(-1);
    if (run?.ignored === state) run.points.push(point);
    else runs.push({ ignored: state, points: run ? [run.points.at(-1)!, point] : [point] });
  }

  const actuationY = y(actuationUm);
  const clear = (edgeY: number) => Math.abs(edgeY - actuationY) >= 12;
  const topEdge = y(topUm);
  const bottomEdge = y(travelUm - bottomUm);
  const label = { textAnchor: "middle" as const, strokeWidth: 4, strokeLinejoin: "round" as const, paintOrder: "stroke" };
  // Text baselines: inside each zone's edge, moved off the actuation line when it would cross the text.
  const crosses = (baseline: number) => actuationY > baseline - 11 && actuationY < baseline + 3;
  const topLabelY = crosses(topEdge + 12) ? actuationY + 13 : topEdge + 12;
  const bottomLabelY = crosses(bottomEdge - 6) ? actuationY - 4 : bottomEdge - 6;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-42 w-auto max-w-full" role="img" aria-label={t("dz.chart")}>
      <defs>
        <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" className="stroke-muted" strokeWidth="2" strokeOpacity="0.35" />
        </pattern>
      </defs>

      {/* Dead zones */}
      {enabled && (
        <>
          <rect x={LEFT} y={TOP} width={RIGHT - LEFT} height={topEdge - TOP} fill={`url(#${hatch})`} />
          <rect x={LEFT} y={bottomEdge} width={RIGHT - LEFT} height={BOTTOM - bottomEdge} fill={`url(#${hatch})`} />
          <line x1={LEFT} y1={topEdge} x2={RIGHT} y2={topEdge} className="stroke-muted" strokeOpacity="0.6" />
          <line x1={LEFT} y1={bottomEdge} x2={RIGHT} y2={bottomEdge} className="stroke-muted" strokeOpacity="0.6" />
        </>
      )}

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
        {mm(actuationUm)}
      </text>
      <text x={RIGHT} y={BOTTOM + 16} textAnchor="end" className="fill-subtle text-[10px]">
        {t("chart.time")} →
      </text>

      {/* Key movement: muted where it's ignored, accent where the key responds */}
      {runs.map((run, i) =>
        run.ignored ? (
          <path key={i} d={`M${run.points.join(" L")}`} fill="none" className="stroke-subtle" strokeWidth="2" strokeDasharray="2 3" strokeLinecap="round" />
        ) : (
          <path
            key={i}
            d={`M${run.points.join(" L")}`}
            fill="none"
            className="stroke-accent"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: "drop-shadow(0 0 4px var(--color-glow))" }}
          />
        ),
      )}

      {/* Zone sizes, in the middle where the trace sits at the bottom; outlined to stay legible */}
      {enabled && (
        <g className="fill-fg-2 stroke-panel text-[10px] font-semibold">
          <text x={x(0.5)} y={topLabelY} {...label}>
            {t("dz.topShort")} {mm(topUm)} mm
          </text>
          <text x={x(0.5)} y={bottomLabelY} {...label}>
            {t("dz.bottomShort")} {mm(bottomUm)} mm
          </text>
        </g>
      )}
    </svg>
  );
}
