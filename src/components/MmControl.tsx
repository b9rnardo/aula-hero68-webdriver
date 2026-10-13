import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { useI18n } from "../i18n";
import { useDriver } from "../store/driver";
import { Icon } from "./icons";
import { cx } from "./ui";

// Millimeter value editor shared by actuation, Rapid Trigger and dead zones: a typed field with − / +,
// and a slider. Values are kept in µm and snapped to the keyboard's precision.

export interface MmModel {
  /** Lowest and highest current value of the selected keys. */
  min: number;
  max: number;
  mixed: boolean;
  /** Current values differ from what the keyboard has. */
  changed: boolean;
  /** The keyboard value, when every selected key has the same one. */
  saved: number | null;
  limits: { min: number; max: number; barMax: number; step: number };
  disabled: boolean;
  apply(um: number): void;
}

export function useMm({
  values,
  saved,
  min,
  max,
  barMax = max,
  step,
  disabled = false,
  apply,
}: {
  values: number[];
  saved: (number | undefined)[];
  min: number;
  max: number;
  barMax?: number;
  step: number;
  disabled?: boolean;
  apply: (um: number) => void;
}): MmModel {
  const low = values.length ? Math.min(...values) : min;
  const high = values.length ? Math.max(...values) : min;
  const first = saved[0];
  const savedSame = first !== undefined && saved.every((value) => value === first);
  const snap = (um: number) => Math.min(max, Math.max(min, Math.round(um / step) * step));
  return {
    min: low,
    max: high,
    mixed: low !== high,
    changed: values.some((value, index) => value !== saved[index]),
    saved: savedSame ? first : null,
    limits: { min, max, barMax, step },
    disabled,
    apply: (um) => {
      if (Number.isFinite(um) && !disabled) apply(snap(um));
    },
  };
}

/** Caption under a value: the range when mixed, the keyboard value when changed. */
export function useMmCaption(model: MmModel) {
  const { t, mm } = useI18n();
  const source = useDriver((s) => s.source);
  if (model.mixed) return t("mm.range", { min: mm(model.min), max: mm(model.max) });
  if (model.changed) return model.saved === null ? t("mm.savedVaries") : t("mm.saved", { value: mm(model.saved) });
  return source === "device" ? t("mm.onKeyboard") : source === "file" ? t("mm.fromBackup") : t("mm.fromDemo");
}

export function MmCaption({ model, className }: { model: MmModel; className?: string }) {
  const caption = useMmCaption(model);
  return (
    <div className={cx("cap", className)}>
      {model.changed && model.saved !== null && <span className="tkm" aria-hidden="true" />}
      {caption}
    </div>
  );
}

/** Typed value with − and + buttons. Enter or leaving the field applies; Esc cancels; ↑ ↓ step. */
export function MmField({ model, label, sm }: { model: MmModel; label: string; sm?: boolean }) {
  const { t, mm } = useI18n();
  const [text, setText] = useState<string | null>(null);
  const { step } = model.limits;
  const nudge = (direction: 1 | -1, coarse: boolean) => {
    const base = direction > 0 ? model.max : model.min;
    model.apply(base + direction * (coarse ? step * 10 : step));
  };
  const commit = () => {
    if (text === null) return;
    const value = parseFloat(text.replace(",", "."));
    setText(null);
    if (Number.isFinite(value)) model.apply(value * 1000);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      setText(null);
      event.currentTarget.blur();
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      setText(null);
      nudge(event.key === "ArrowUp" ? 1 : -1, event.shiftKey);
    }
  };
  const stepLabel = mm(step);
  const button = (direction: 1 | -1) => (
    <button
      type="button"
      className={cx("btn sec ico", sm && "sm")}
      aria-label={t(direction > 0 ? "mm.increase" : "mm.decrease", { what: label, step: stepLabel })}
      title={t(direction > 0 ? "mm.increaseHint" : "mm.decreaseHint", { step: stepLabel, coarse: mm(step * 10) })}
      disabled={model.disabled}
      onClick={(event: MouseEvent) => nudge(direction, event.shiftKey)}
    >
      <Icon name={direction > 0 ? "plus" : "minus"} size="s" />
    </button>
  );
  return (
    <div className="flex items-center gap-1.5">
      {button(-1)}
      <label className="field">
        <span className="sr-only">{t("mm.fieldLabel", { what: label })}</span>
        <input
          inputMode="decimal"
          value={text ?? (model.mixed ? "" : mm(model.min))}
          placeholder={t("common.mixed")}
          disabled={model.disabled}
          onChange={(event) => setText(event.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
        />
        <span>mm</span>
      </label>
      {button(1)}
    </div>
  );
}

/** Slider with the selection's range (mixed), the fill (single value) and the keyboard value tick. */
export function MmSlider({ model, label }: { model: MmModel; label: string }) {
  const { t, mm } = useI18n();
  const { min, barMax, step } = model.limits;
  const pct = (um: number) => Math.min(1, Math.max(0, (um - min) / (barMax - min))) * 100;
  return (
    <div className="slider">
      <div className="tr" />
      {model.mixed ? (
        <div className="bd" style={{ left: `${pct(model.min)}%`, width: `${Math.max(1, pct(model.max) - pct(model.min))}%` }} />
      ) : (
        <div className="fi" style={{ width: `${pct(model.min)}%` }} />
      )}
      {model.changed && model.saved !== null && <div className="tk" style={{ left: `${pct(model.saved)}%` }} title={t("mm.tick")} />}
      <input
        className="range"
        type="range"
        min={min}
        max={barMax}
        step={step}
        value={Math.min(barMax, Math.max(min, model.min))}
        disabled={model.disabled}
        aria-label={label}
        aria-valuetext={model.mixed ? t("mm.ariaMixed", { min: mm(model.min), max: mm(model.max) }) : t("mm.aria", { value: mm(model.min) })}
        onChange={(event) => model.apply(Number(event.target.value))}
      />
    </div>
  );
}
