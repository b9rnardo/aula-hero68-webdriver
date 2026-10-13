import { useI18n } from "../i18n";
import { simulateRapidTrigger, type Movement, type TracePoint } from "../lib/rapidTrigger";

/** A key going down, partly up and down again a few times (ms, mm), like fast repeated taps in a game. */
const PATH: [number, number][] = [
  [0, 0],
  [8, 2.4],
  [13, 1.75],
  [19, 3.1],
  [27, 0.7],
  [32, 1.6],
  [37, 1.05],
  [43, 2.2],
  [52, 0],
];
const DURATION = 52;
const SCALE_UM = 4000;
const MOVEMENT: Movement = PATH.map(([ms, depth]) => [ms / DURATION, depth * 1000]);
const X = (t: number) => 14 + t * 492;
const Y = (um: number) => 16 + (um / SCALE_UM) * 168;
const point = (p: { t: number; depthUm: number }) => `${X(p.t).toFixed(1)} ${Y(p.depthUm).toFixed(1)}`;
const dots = (list: { t: number; depthUm: number }[]) =>
  list
    .map((p) => {
      const x = X(p.t) - 4.5;
      const y = Y(p.depthUm);
      return `M${x.toFixed(1)} ${y.toFixed(1)} a4.5 4.5 0 1 0 9 0 a4.5 4.5 0 1 0 -9 0`;
    })
    .join(" ");

function activePath(points: TracePoint[]) {
  let d = "";
  let previous = false;
  for (const p of points) {
    if (p.on) d += `${previous ? " L" : " M"}${point(p)}`;
    previous = p.on;
  }
  return d.trim();
}

export function simulate(actuationUm: number, enabled: boolean, pressUm: number, releaseUm: number) {
  return simulateRapidTrigger(MOVEMENT, { actuationUm, enabled, pressUm, releaseUm }, 520);
}

/** Simulated taps through the trigger logic: the travel, when the key is on, and each trigger and release. */
export function RapidTriggerChart({ actuationUm, enabled, pressUm, releaseUm, label }: { actuationUm: number; enabled: boolean; pressUm: number; releaseUm: number; label: string }) {
  const { t, mm } = useI18n();
  const { points, events } = simulate(actuationUm, enabled, pressUm, releaseUm);
  const actY = Y(actuationUm);
  return (
    <svg viewBox="0 0 520 200" role="img" aria-label={label} className="block h-auto w-full">
      <rect x="0.5" y="0.5" width="519" height="199" rx="10" className="sv-bg" />
      <line x1="12" x2="508" y1="16" y2="16" className="sv-grid" />
      <line x1="12" x2="508" y1="184" y2="184" className="sv-grid" />
      <line x1="12" x2="508" y1={actY} y2={actY} className="sv-act" />
      <text x="504" y={actY > 40 ? actY - 6 : actY + 16} className="sv-t">
        {t("rt.sim.actuation", { value: mm(actuationUm) })}
      </text>
      <path d={`M${points.map(point).join(" L")}`} className="sv-trace" />
      <path d={activePath(points)} className="sv-on" />
      <path d={dots(events.filter((e) => e.on))} className="sv-trig" />
      <path d={dots(events.filter((e) => !e.on))} className="sv-rel" />
    </svg>
  );
}
