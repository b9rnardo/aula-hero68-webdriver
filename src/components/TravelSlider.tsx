import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { useI18n } from "../i18n";
import type { Spread } from "../lib/target";
import { sliderKey } from "./Slider";
import { cx } from "./ui";

interface Props {
  travelUm: number;
  minUm: number;
  maxUm: number;
  stepUm: number;
  /** Value under the handle; null hides the handle (mixed selection not edited yet). */
  value: number | null;
  /** Stored values, shown as a band when the selection is mixed. */
  range: Spread | null;
  disabled?: boolean;
  label: string;
  onChange(um: number): void;
  /** Enter on the focused slider. */
  onCommit?(): void;
}

const percent = (value: number, total: number) => `${Math.max(0, Math.min(100, (value / total) * 100))}%`;

/**
 * Vertical picture of the key travel (top = key at rest) that doubles as the actuation slider:
 * drag or click anywhere on it, or use the arrow keys (one precision step; PgUp/PgDn ten).
 */
export function TravelSlider({ travelUm, minUm, maxUm, stepUm, value, range, disabled, label, onChange, onCommit }: Props) {
  const { t, mm } = useI18n();
  const track = useRef<HTMLDivElement>(null);
  const clamp = (um: number) => Math.min(maxUm, Math.max(minUm, Math.round(um / stepUm) * stepUm));

  const fromPointer = (event: PointerEvent) => {
    const rect = track.current!.getBoundingClientRect();
    onChange(clamp(((event.clientY - rect.top) / rect.height) * travelUm));
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") onCommit?.();
    else {
      const next = sliderKey(event.key, value ?? range?.min ?? minUm, stepUm, minUm, maxUm);
      if (next === null) return;
      onChange(clamp(next));
    }
    event.preventDefault();
  };

  const shown = value !== null ? { min: value, max: value, mixed: false } : range;

  return (
    <div className="flex shrink-0 gap-3">
      <div
        ref={track}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-orientation="vertical"
        aria-disabled={disabled}
        aria-valuemin={minUm / 1000}
        aria-valuemax={maxUm / 1000}
        aria-valuenow={value === null ? undefined : value / 1000}
        aria-valuetext={value === null ? t("actuation.mixed") : `${mm(value)} mm`}
        onKeyDown={disabled ? undefined : onKeyDown}
        onPointerDown={
          disabled
            ? undefined
            : (event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                event.currentTarget.focus();
                fromPointer(event);
              }
        }
        onPointerMove={disabled ? undefined : (event) => event.currentTarget.hasPointerCapture(event.pointerId) && fromPointer(event)}
        className={cx(
          "group relative h-42 w-14 touch-none rounded-md outline-none select-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-field",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-ns-resize",
        )}
      >
        <div className="absolute inset-y-0 inset-x-1.5 overflow-hidden rounded-md bg-key ring-1 ring-key-line">
          {/* Untouchable first steps (below the minimum). */}
          <div
            className="absolute inset-x-0 top-0 bg-[repeating-linear-gradient(135deg,rgb(196_181_253/0.16)_0_3px,transparent_3px_6px)]"
            style={{ height: percent(minUm, travelUm) }}
          />
          {shown && (
            <>
              <div className="absolute inset-x-0 top-0 bg-accent/15" style={{ height: percent(shown.max, travelUm) }} />
              {shown.mixed && (
                <div
                  className="absolute inset-x-0 bg-accent/35"
                  style={{ top: percent(shown.min, travelUm), height: percent(shown.max - shown.min, travelUm) }}
                />
              )}
            </>
          )}
        </div>
        {value !== null && (
          <div
            className="pointer-events-none absolute inset-x-0 grid h-4 -translate-y-1/2 place-items-center rounded-full bg-accent shadow-[0_0_14px_var(--color-glow)] transition-transform group-active:scale-x-110"
            style={{ top: percent(value, travelUm) }}
          >
            <span className="h-0.5 w-5 rounded-full bg-accent-ink/50" />
          </div>
        )}
      </div>

      <div className="relative h-42 w-24 text-xs whitespace-nowrap">
        <span className="absolute top-0 left-0 font-semibold text-muted">
          {t("actuation.top")} <span className="font-normal text-subtle">· 0 mm</span>
        </span>
        {shown && (
          <span
            className="absolute left-0 -translate-y-1/2 text-sm font-bold text-accent tabular-nums"
            style={{ top: `clamp(26px, ${percent((shown.min + shown.max) / 2, travelUm)}, calc(100% - 26px))` }}
          >
            {shown.mixed ? `${mm(shown.min)}–${mm(shown.max)}` : mm(shown.min)} mm
          </span>
        )}
        <span className="absolute bottom-0 left-0 font-semibold text-muted">
          {t("actuation.bottom")} <span className="font-normal text-subtle">· {mm(travelUm)} mm</span>
        </span>
      </div>
    </div>
  );
}
