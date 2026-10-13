import { useI18n } from "../i18n";
import type { LiveKey } from "../store/live";

const X0 = 14;
const WIDTH = 492;
const Y = (um: number, travelUm: number) => 16 + (Math.min(um, travelUm) / travelUm) * 168;

/** Live trace of one key: the travel over the last `spanMs`, thicker while the keyboard counts it as pressed. */
export function TravelChart({
  points,
  spanMs,
  travelUm,
  actuationUm,
  label,
}: {
  points: LiveKey[];
  spanMs: number;
  travelUm: number;
  actuationUm: number | undefined;
  label: string;
}) {
  const { t, mm } = useI18n();
  const end = points.length ? points[points.length - 1].at : 0;
  const X = (at: number) => X0 + (1 - (end - at) / spanMs) * WIDTH;
  const xy = (p: LiveKey) => `${X(p.at).toFixed(1)} ${Y(p.depthUm, travelUm).toFixed(1)}`;
  let active = "";
  let previous = false;
  for (const p of points) {
    if (p.pressed) active += `${previous ? " L" : " M"}${xy(p)}`;
    previous = p.pressed;
  }
  const actY = actuationUm === undefined ? null : Y(actuationUm, travelUm);
  return (
    <svg viewBox="0 0 520 200" role="img" aria-label={label} className="block h-auto w-full">
      <rect x="0.5" y="0.5" width="519" height="199" rx="10" className="sv-bg" />
      <line x1="12" x2="508" y1="16" y2="16" className="sv-grid" />
      <line x1="12" x2="508" y1="184" y2="184" className="sv-grid" />
      {actY !== null && (
        <>
          <line x1="12" x2="508" y1={actY} y2={actY} className="sv-act" />
          {/* On the left: the newest readings come in on the right. */}
          <text x="18" y={actY > 40 ? actY - 6 : actY + 16} className="sv-t" style={{ textAnchor: "start" }}>
            {t("rt.sim.actuation", { value: mm(actuationUm!) })}
          </text>
        </>
      )}
      {points.length > 1 && <path d={`M${points.map(xy).join(" L")}`} className="sv-trace" />}
      {active && <path d={active.trim()} className="sv-on" />}
    </svg>
  );
}
