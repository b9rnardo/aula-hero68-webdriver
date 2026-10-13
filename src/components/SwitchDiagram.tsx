import { useId } from "react";

interface Props {
  travelUm: number;
  /** Depth to press the key to; null leaves it at rest. */
  valueUm: number | null;
  label: string;
}

/** Drawing scale: the full switch travel moves the keycap this many units (exaggerated so small values show). */
const PRESS_UNITS = 40;
const SPRING_TOP = 112;
const SPRING_BOTTOM = 190;
const MOTION = "transform 140ms ease-out";

const KEYCAP = "M30 52 L39 14 Q40 10 44 10 Q88 17 132 10 Q136 10 137 14 L146 52 Q146 54 144 54 L32 54 Q30 54 30 52 Z";

/** Spring at rest length, compressed with a vertical scale anchored on the housing floor. */
const SPRING = (() => {
  const turns = 14;
  const step = (SPRING_BOTTOM - SPRING_TOP) / turns;
  let d = `M66 ${SPRING_TOP}`;
  for (let i = 1; i <= turns; i++) d += ` L${i % 2 ? 110 : 66} ${SPRING_TOP + i * step}`;
  return d;
})();

/**
 * Side view of a magnetic (Hall effect) switch pressed to the given depth: keycap, stem with magnet,
 * spring, translucent housing and the sensor on the PCB, which glows as the magnet gets closer.
 */
export function SwitchDiagram({ travelUm, valueUm, label }: Props) {
  const id = useId();
  const fraction = valueUm === null ? 0 : Math.max(0, Math.min(1, valueUm / travelUm));
  const press = fraction * PRESS_UNITS;
  const moving = { transform: `translateY(${press}px)`, transition: MOTION };
  const springScale = (SPRING_BOTTOM - SPRING_TOP - press) / (SPRING_BOTTOM - SPRING_TOP);

  return (
    <svg viewBox="0 0 176 220" className="h-42 w-auto min-w-0 shrink" role="img" aria-label={label}>
      <defs>
        <linearGradient id={`${id}cap`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "#41365c" }} />
          <stop offset="1" style={{ stopColor: "var(--color-key)" }} />
        </linearGradient>
        <linearGradient id={`${id}magnet`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--color-accent)" }} />
          <stop offset="1" style={{ stopColor: "var(--color-glow)" }} />
        </linearGradient>
        <radialGradient id={`${id}glow`}>
          <stop offset="0" style={{ stopColor: "var(--color-glow)", stopOpacity: 0.9 }} />
          <stop offset="1" style={{ stopColor: "var(--color-glow)", stopOpacity: 0 }} />
        </radialGradient>
      </defs>

      {/* PCB and Hall sensor */}
      <circle cx="88" cy="197" r="30" fill={`url(#${id}glow)`} style={{ opacity: 0.12 + 0.88 * fraction, transition: "opacity 140ms ease-out" }} />
      <rect x="8" y="201" width="160" height="9" rx="2" className="fill-panel stroke-key-line" />
      <rect x="54" y="190" width="3" height="11" className="fill-subtle" />
      <rect x="119" y="190" width="3" height="11" className="fill-subtle" />
      <rect x="78" y="193" width="20" height="8" rx="1.5" className="fill-key-line stroke-accent" strokeWidth="1" />

      {/* Stem, magnet and spring, seen through the housing */}
      <g style={moving}>
        <rect x="80" y="54" width="16" height="84" rx="2" className="fill-accent/85" />
        <rect x="68" y="106" width="40" height="6" rx="1.5" className="fill-accent/85" />
        <rect x="77" y="136" width="22" height="12" rx="2" fill={`url(#${id}magnet)`} />
      </g>
      <path
        d={SPRING}
        fill="none"
        className="stroke-muted"
        strokeWidth="1.6"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={{ transform: `scaleY(${springScale})`, transformOrigin: `88px ${SPRING_BOTTOM}px`, transition: MOTION, opacity: 0.75 }}
      />

      {/* Housing (translucent) */}
      <path d="M52 100 L124 100 L136 131 L40 131 Z" className="fill-accent/[0.07] stroke-key-line" strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="40" y="134" width="96" height="57" rx="5" className="fill-accent/[0.07] stroke-key-line" strokeWidth="1.5" />
      <rect x="34" y="130" width="108" height="5" rx="1.5" className="fill-key stroke-key-line" strokeWidth="1.5" />

      {/* Keycap at rest (ghost) and pressed */}
      {press > 0.5 && <path d={KEYCAP} fill="none" className="stroke-subtle" strokeWidth="1" strokeDasharray="3 3" />}
      <g style={moving}>
        <path d={KEYCAP} fill={`url(#${id}cap)`} className="stroke-key-line" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M46 13.5 Q88 20 130 13.5" fill="none" stroke="white" strokeOpacity="0.12" strokeWidth="1.5" strokeLinecap="round" />
      </g>

      {/* Depth from rest to the actuation point */}
      {press > 0.5 && (
        <g className="stroke-accent" strokeWidth="1.2" strokeLinecap="round" fill="none">
          <line x1="10" y1="10" x2="36" y2="10" strokeDasharray="2 3" />
          <line
            x1="16"
            y1="10"
            x2="16"
            y2={10 + PRESS_UNITS}
            vectorEffect="non-scaling-stroke"
            style={{ transform: `scaleY(${fraction})`, transformOrigin: "16px 10px", transition: MOTION }}
          />
          <g style={moving}>
            <line x1="10" y1="10" x2="36" y2="10" />
            {press >= 8 && <path d="M13 7 L16 10 L19 7" />}
          </g>
        </g>
      )}
    </svg>
  );
}
