import { useI18n } from "../i18n";
import { cx } from "./ui";

// Side view of a magnetic switch: the stem goes down to the actuation point, where the magnet is close
// enough to the Hall sensor. 30 px per mm; the slider's bottom rests on y = 104 and the floor is y = 240.
const PX_PER_MM = 30;
const TOP = 104;
const FLOOR = 240;
const SPAN = FLOOR - TOP;
const SPRING = (() => {
  let d = "M140 0";
  for (let i = 1; i <= 12; i++) d += ` L${i % 2 ? 236 : 140} ${((SPAN * i) / 12).toFixed(1)}`;
  return d;
})();

export function SwitchDiagram({
  minUm,
  maxUm,
  travelUm,
  savedUm,
  depthUm,
  hot,
}: {
  /** Actuation range of the selected keys; null when nothing is selected (switch at rest). */
  minUm: number | null;
  maxUm: number | null;
  travelUm: number;
  /** Keyboard value, drawn as a tick when the selection has an unsaved change. */
  savedUm?: number | null;
  /** Live travel: the stem follows this depth instead of resting on the actuation point. */
  depthUm?: number | null;
  /** Live travel: the keyboard counts the key as pressed. */
  hot?: boolean;
}) {
  const { t, mm, number } = useI18n();
  const on = minUm !== null && maxUm !== null;
  const lo = on ? minUm / 1000 : 0;
  const hi = on ? maxUm / 1000 : 0;
  const travel = travelUm / 1000;
  const mixed = on && lo !== hi;
  const live = depthUm != null;
  const y = (value: number) => TOP + value * PX_PER_MM;
  const dy = (live ? Math.min(depthUm, travelUm) / 1000 : lo) * PX_PER_MM;
  const pillY = !on ? -100 : mixed ? (y(lo) + y(hi)) / 2 : y(lo);
  const endY = y(travel);

  const marks: number[] = [];
  for (let i = 0; i / 2 <= travel + 1e-6; i++) marks.push(i / 2);
  if (marks[marks.length - 1] < travel - 1e-6) marks.push(travel);
  const ticks = marks.map((value) => {
    const ty = y(value);
    const end = Math.abs(value - travel) < 1e-6;
    const major = end || value % 1 === 0;
    return { value, y: ty, major, show: major && Math.abs(ty - pillY) >= 14 && (end || Math.abs(ty - endY) >= 14) };
  });

  const aria = live
    ? t(hot ? "diagram.liveOn" : "diagram.live", { depth: mm(depthUm), value: on ? mm(minUm) : "–" })
    : !on
    ? t("diagram.rest")
    : mixed
      ? t("diagram.mixed", { min: mm(minUm), max: mm(maxUm), travel: mm(travelUm) })
      : t("diagram.single", { value: mm(minUm), travel: mm(travelUm) });

  return (
    <svg viewBox="0 0 340 284" role="img" aria-label={aria} className={cx("mx-auto block h-auto w-full max-w-[400px]", live && "fast")}>
      <rect x="112" y="64" width="152" height="188" rx="6" className="sw-house" />
      <path d={SPRING} className="sw-spring" style={{ transform: `translateY(${TOP + dy}px) scaleY(${((SPAN - dy) / SPAN).toFixed(4)})` }} />
      <g className="sw-move" style={{ transform: `translateY(${dy}px)` }}>
        <rect x="176" y="20" width="24" height="60" rx="3" className="sw-stem" />
        <rect x="128" y="80" width="120" height="24" rx="4" className="sw-slider" />
        <rect x="176" y="104" width="24" height="6" className="sw-n" />
        <rect x="176" y="110" width="24" height="6" className="sw-s" />
        <line x1="80" x2="128" y1="92" y2="92" className="sw-lead" />
        <text x="8" y="96" className="sw-lbl">
          {t("diagram.stem")}
        </text>
      </g>
      <rect x="112" y="64" width="62" height="12" rx="4" className="sw-plate" />
      <rect x="202" y="64" width="62" height="12" rx="4" className="sw-plate" />
      <rect x="112" y="240" width="152" height="12" rx="4" className="sw-plate" />
      <rect x="112" y="64" width="152" height="188" rx="6" className="sw-outline" />
      <rect x="92" y="262" width="192" height="10" rx="3" className="sw-pcb" />
      <rect x="176" y="254" width="24" height="8" rx="2" style={{ fill: (live ? hot : on) ? "#a48bff" : "#9e96b3" }} />
      <line x1="44" x2="140" y1="228" y2="228" className="sw-lead" />
      <text x="8" y="232" className="sw-lbl">
        {t("diagram.spring")}
      </text>
      <line x1="80" x2="176" y1="258" y2="258" className="sw-lead" />
      <text x="8" y="262" className="sw-lbl">
        {t("diagram.sensor")}
      </text>
      <text x="298" y="94" className="sw-tl">
        mm
      </text>
      <line x1="284" x2="284" y1="104" y2={endY} className="sw-axis" />
      {ticks.map((tick) => (
        <g key={tick.value}>
          <line x1="284" x2={tick.major ? 292 : 288} y1={tick.y} y2={tick.y} className="sw-tick" />
          {tick.show && (
            <text x="298" y={tick.y + 4} className="sw-tl">
              {number(tick.value)}
            </text>
          )}
        </g>
      ))}
      {on && savedUm != null && <line x1="276" x2="292" y1={y(savedUm / 1000)} y2={y(savedUm / 1000)} className="sw-saved" />}
      {on && !mixed && (
        <g className="sw-move" style={{ transform: `translateY(${y(lo)}px)` }}>
          <line x1="104" x2="292" y1="0" y2="0" className="sw-act" />
          <rect x="294" y="-10" width="44" height="20" rx="6" className="sw-pill" />
          <text x="316" y="4" className="sw-pt">
            {mm(minUm)}
          </text>
        </g>
      )}
      {mixed && (
        <>
          <line x1="104" x2="292" y1={y(lo)} y2={y(lo)} className="sw-act" />
          <line x1="104" x2="292" y1={y(hi)} y2={y(hi)} className="sw-act" />
          <rect x="280" y={y(lo)} width="8" height={Math.max(3, (hi - lo) * PX_PER_MM)} rx="2" className="sw-band" />
          <rect x="294" y={pillY - 10} width="44" height="20" rx="6" className="sw-pill" />
          <text x="316" y={pillY + 4} className="sw-pt">
            {t("common.mixed")}
          </text>
        </>
      )}
    </svg>
  );
}
