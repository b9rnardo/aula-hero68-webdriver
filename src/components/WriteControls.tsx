import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { CheckIcon } from "./icons";
import { Button, cx } from "./ui";

/** "1,25" or "1.25" (mm) → µm; null when it isn't a number. */
export function parseMm(text: string) {
  const value = Number(text.trim().replace(",", "."));
  return text.trim() && Number.isFinite(value) ? Math.round(value * 1000) : null;
}

/** Reads a typed mm value: rounded to the step, and whether it's inside the limits. */
export function mmDraft(text: string, stepUm: number, minUm: number, maxUm: number) {
  const typed = parseMm(text);
  const um = typed === null ? null : Math.round(typed / stepUm) * stepUm;
  const valid = um !== null && um >= minUm && um <= maxUm;
  return { um: valid ? um : null, invalid: text.trim() !== "" && !valid };
}

/** "Saved" flag that clears itself after a moment. */
export function useSavedFlag() {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(timer);
  }, [saved]);
  return [saved, setSaved] as const;
}

/** Text field for a distance in mm, with the unit inside. */
export function MmField({
  id,
  value,
  invalid,
  disabled,
  placeholder,
  describedBy,
  size = "lg",
  onChange,
  onBlur,
}: {
  id: string;
  value: string;
  invalid: boolean;
  disabled?: boolean;
  placeholder?: string;
  describedBy?: string;
  size?: "md" | "lg";
  onChange(text: string): void;
  onBlur?(): void;
}) {
  return (
    <div className="relative shrink-0">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={cx(
          "rounded-md bg-key pl-3 text-right font-bold tabular-nums ring-1 outline-none disabled:opacity-40",
          size === "lg" ? "h-11 w-28 pr-10 text-lg" : "h-9 w-24 pr-9 text-base",
          invalid ? "ring-danger" : "ring-key-line focus:ring-accent",
        )}
      />
      <span
        className={cx(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 font-semibold text-muted",
          size === "lg" ? "right-3 text-sm" : "right-2.5 text-xs",
        )}
      >
        mm
      </span>
    </div>
  );
}

/** Submit button for a write, with the transient confirmation next to it. */
export function ApplyRow({
  target,
  writing,
  disabled,
  saved,
  demo,
  size = "lg",
}: {
  target: string;
  writing: boolean;
  disabled: boolean;
  saved: boolean;
  demo: boolean;
  size?: "md" | "lg";
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Button type="submit" variant="primary" size={size} disabled={disabled || writing}>
        {writing ? t("write.writing") : t("write.apply", { target })}
      </Button>
      {saved && (
        <p role="status" className="flex items-center gap-1.5 text-sm font-semibold text-ok">
          <CheckIcon size={16} />
          {t(demo ? "write.savedDemo" : "write.saved")}
        </p>
      )}
    </div>
  );
}

/** On/off switch; null shows the thumb centered (some keys on, some off). */
export function Toggle({ on, label, disabled, onChange }: { on: boolean | null; label: string; disabled?: boolean; onChange(on: boolean): void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on === true}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cx(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-field disabled:cursor-not-allowed disabled:opacity-40",
        on ? "bg-accent" : on === null ? "bg-accent/35" : "bg-key-line",
      )}
    >
      <span
        className={cx(
          "absolute size-5 rounded-full transition-all",
          on ? "left-6 bg-accent-ink" : on === null ? "left-3.5 bg-fg-2" : "left-1 bg-fg-2",
        )}
      />
    </button>
  );
}
