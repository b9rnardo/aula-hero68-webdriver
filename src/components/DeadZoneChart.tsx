import { useI18n } from "../i18n";

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
const X = (t: number) => 14 + t * 492;

function depthAt(time: number) {
  for (let i = 1; i < MOVEMENT.length; i++) {
    const [t0, d0] = MOVEMENT[i - 1];
    const [t1, d1] = MOVEMENT[i];
    if (time <= t1) return t1 === t0 ? d1 : d0 + ((d1 - d0) * (time - t0)) / (t1 - t0);
  }
  return MOVEMENT[MOVEMENT.length - 1][1];
}

/** A full key press with the dead zones as bands: the movement inside them is ignored, the rest responds. */
export function DeadZoneChart({
  travelUm,
  actuationUm,
  enabled,
  topUm,
  bottomUm,
  label,
}: {
  travelUm: number;
  actuationUm: number;
  enabled: boolean;
  topUm: number;
  bottomUm: number;
  label: string;
}) {
  const { t, mm } = useI18n();
  const Y = (um: number) => 16 + (Math.max(0, Math.min(travelUm, um)) / travelUm) * 168;
  const ignored = (um: number) => enabled && (um < topUm || um > travelUm - bottomUm);

  // Runs of the trace with the same state; each run starts where the previous ended.
  const runs: { ignored: boolean; points: string[] }[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const time = i / SAMPLES;
    const um = depthAt(time) * travelUm;
    const p = `${X(time).toFixed(1)} ${Y(um).toFixed(1)}`;
    const state = ignored(um);
    const run = runs.at(-1);
    if (run?.ignored === state) run.points.push(p);
    else runs.push({ ignored: state, points: run ? [run.points.at(-1)!, p] : [p] });
  }
  const actY = Y(actuationUm);
  const topY = Y(topUm);
  const bottomY = Y(travelUm - bottomUm);

  return (
    <svg viewBox="0 0 520 200" role="img" aria-label={label} className="block h-auto w-full">
      <rect x="0.5" y="0.5" width="519" height="199" rx="10" className="sv-bg" />
      {enabled && (
        <>
          <rect x="12" y="16" width="496" height={Math.max(0, topY - 16)} className="sv-zone" />
          <rect x="12" y={bottomY} width="496" height={Math.max(0, 184 - bottomY)} className="sv-zone" />
        </>
      )}
      <line x1="12" x2="508" y1="16" y2="16" className="sv-grid" />
      <line x1="12" x2="508" y1="184" y2="184" className="sv-grid" />
      <line x1="12" x2="508" y1={actY} y2={actY} className="sv-act" />
      <text x="504" y={actY > 40 ? actY - 6 : actY + 16} className="sv-t">
        {t("rt.sim.actuation", { value: mm(actuationUm) })}
      </text>
      {runs.map((run, index) => (
        <path key={index} d={`M${run.points.join(" L")}`} className={run.ignored ? "sv-trace" : "sv-on"} />
      ))}
    </svg>
  );
}
