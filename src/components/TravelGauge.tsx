import { useI18n } from "../i18n";
import type { Spread } from "../lib/target";

interface Props {
  travelUm: number;
  /** Actuation point(s) to mark on the travel. */
  range?: Spread | null;
  /** Dead zones at the top and bottom of the travel. */
  zones?: { top: number; bottom: number } | null;
  label: string;
}

const percent = (value: number, total: number) => `${Math.max(0, Math.min(100, (value / total) * 100))}%`;

/** Vertical picture of the key travel, top to bottom, with the actuation point and dead zones. */
export function TravelGauge({ travelUm, range, zones, label }: Props) {
  const { t, mm } = useI18n();
  const stripes = "repeating-linear-gradient(135deg, rgb(252 211 77 / 0.28) 0 4px, transparent 4px 8px)";

  return (
    <figure className="flex shrink-0 gap-3" aria-label={label}>
      <div className="relative h-56 w-11 overflow-hidden rounded-md bg-key ring-1 ring-key-line">
        {zones && (
          <>
            <div className="absolute inset-x-0 top-0" style={{ height: percent(zones.top, travelUm), background: stripes }} />
            <div className="absolute inset-x-0 bottom-0" style={{ height: percent(zones.bottom, travelUm), background: stripes }} />
          </>
        )}
        {range && (
          <>
            <div className="absolute inset-x-0 top-0 bg-accent/15" style={{ height: percent(range.max, travelUm) }} />
            <div
              className="absolute inset-x-0 min-h-[3px] bg-accent shadow-[0_0_10px_var(--color-glow)]"
              style={{ top: percent(range.min, travelUm), height: percent(range.max - range.min, travelUm) }}
            />
          </>
        )}
      </div>
      <div className="relative h-56 w-28 text-xs whitespace-nowrap">
        <span className="absolute top-0 left-0 font-semibold text-muted">
          {t("actuation.top")} <span className="font-normal text-subtle">· 0 mm</span>
        </span>
        {range && (
          <span
            className="absolute left-0 -translate-y-1/2 text-sm font-bold text-accent"
            style={{ top: `clamp(26px, ${percent((range.min + range.max) / 2, travelUm)}, calc(100% - 26px))` }}
          >
            {range.mixed ? `${mm(range.min)}–${mm(range.max)}` : mm(range.min)} mm
          </span>
        )}
        <span className="absolute bottom-0 left-0 font-semibold text-muted">
          {t("actuation.bottom")} <span className="font-normal text-subtle">· {mm(travelUm)} mm</span>
        </span>
      </div>
    </figure>
  );
}
