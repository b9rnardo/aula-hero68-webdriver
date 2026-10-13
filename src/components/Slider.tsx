import { useRef, type KeyboardEvent } from "react";
import { cx } from "./ui";

/**
 * New value for a slider key press, or null when the key isn't a slider key. Arrows move one step
 * (up/left = smaller, matching a travel drawn top to bottom), PgUp/PgDn ten, Home/End to the limits.
 */
export function sliderKey(key: string, from: number, step: number, min: number, max: number): number | null {
  const moves: Record<string, number> = {
    ArrowUp: from - step,
    ArrowLeft: from - step,
    ArrowDown: from + step,
    ArrowRight: from + step,
    PageUp: from - step * 10,
    PageDown: from + step * 10,
    Home: min,
    End: max,
  };
  return key in moves ? Math.min(max, Math.max(min, moves[key])) : null;
}

interface Props {
  value: number | null;
  min: number;
  max: number;
  step: number;
  /** Band shown under the handle, e.g. the stored range of a mixed selection. */
  band?: { min: number; max: number } | null;
  disabled?: boolean;
  label: string;
  valueText: string;
  onChange(value: number): void;
  onCommit?(): void;
}

/**
 * Horizontal slider in the travel bar's style. The scale is quadratic: half of the track covers
 * the first quarter of the range, where the useful small values are.
 */
export function Slider({ value, min, max, step, band, disabled, label, valueText, onChange, onCommit }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const position = (v: number) => `${Math.sqrt(Math.max(0, Math.min(1, (v - min) / (max - min)))) * 100}%`;
  const snap = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));

  const fromPointer = (clientX: number) => {
    const rect = track.current!.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onChange(snap(min + p * p * (max - min)));
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") onCommit?.();
    else {
      const next = sliderKey(event.key, value ?? band?.min ?? min, step, min, max);
      if (next === null) return;
      onChange(snap(next));
    }
    event.preventDefault();
  };

  return (
    <div
      ref={track}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-disabled={disabled}
      aria-valuemin={min / 1000}
      aria-valuemax={max / 1000}
      aria-valuenow={value === null ? undefined : value / 1000}
      aria-valuetext={valueText}
      onKeyDown={disabled ? undefined : onKeyDown}
      onPointerDown={
        disabled
          ? undefined
          : (event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              event.currentTarget.focus();
              fromPointer(event.clientX);
            }
      }
      onPointerMove={disabled ? undefined : (event) => event.currentTarget.hasPointerCapture(event.pointerId) && fromPointer(event.clientX)}
      className={cx(
        "group relative h-7 touch-none rounded-full outline-none select-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-field",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-ew-resize",
      )}
    >
      <div className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 overflow-hidden rounded-full bg-key ring-1 ring-key-line">
        {value !== null && <div className="absolute inset-y-0 left-0 bg-accent/30" style={{ width: position(value) }} />}
        {value === null && band && (
          <div
            className="absolute inset-y-0 bg-accent/35"
            style={{ left: position(band.min), width: `calc(${position(band.max)} - ${position(band.min)})` }}
          />
        )}
      </div>
      {value !== null && (
        <div
          className="pointer-events-none absolute top-1/2 grid h-6 w-4 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-accent shadow-[0_0_14px_var(--color-glow)] transition-transform group-active:scale-y-110"
          style={{ left: position(value) }}
        >
          <span className="h-2.5 w-0.5 rounded-full bg-accent-ink/50" />
        </div>
      )}
    </div>
  );
}
