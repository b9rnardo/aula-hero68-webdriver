import type { ButtonHTMLAttributes, ReactNode } from "react";
import { HelpIcon, InfoIcon } from "./icons";

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

type ButtonVariant = "primary" | "secondary" | "ghost";

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg" }) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" && "h-8 px-3 text-sm",
        size === "md" && "h-9 px-3.5 text-sm",
        size === "lg" && "h-11 px-5 text-base",
        variant === "primary" && "bg-accent text-accent-ink hover:bg-accent-hover",
        variant === "secondary" && "bg-active text-fg hover:bg-[rgb(196_181_253/0.24)]",
        variant === "ghost" && "text-muted hover:bg-hover hover:text-fg",
        className,
      )}
      {...props}
    />
  );
}

/** Wootility-style settings card: flat panel, bold 20px title, muted description. */
export function Card({
  title,
  description,
  actions,
  children,
  className,
  highlight,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Lighter surface for the card that deserves attention. */
  highlight?: boolean;
}) {
  return (
    <section className={cx("flex flex-col rounded-lg p-5", highlight ? "bg-field" : "bg-panel", className)}>
      {(title || actions) && (
        <header className="mb-2 flex items-start justify-between gap-3">
          {title && <h3 className="text-xl leading-tight font-bold text-fg">{title}</h3>}
          {actions}
        </header>
      )}
      {description && <p className="mb-4 text-sm leading-relaxed text-muted">{description}</p>}
      {children}
    </section>
  );
}

/** Page section heading with optional help text and actions on the right. */
export function SectionHeader({ title, help, actions }: { title: ReactNode; help?: string; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-2xl font-bold">
        {title}
        {help && (
          <span title={help} className="text-subtle hover:text-muted">
            <HelpIcon size={18} />
            <span className="sr-only">{help}</span>
          </span>
        )}
      </h2>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("eyebrow text-muted", className)}>{children}</p>;
}

/** Read-only on/off indicator styled like Wootility's toggle; null = mixed or unknown (thumb centered). */
export function StateSwitch({ on, label }: { on: boolean | null; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cx(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
        on ? "bg-accent" : on === null ? "bg-accent/35" : "bg-key-line",
      )}
    >
      <span
        className={cx(
          "absolute size-3.5 rounded-full transition-all",
          on ? "left-[18px] bg-accent-ink" : on === null ? "left-[11px] bg-fg-2" : "left-[3px] bg-fg-2",
        )}
      />
    </span>
  );
}

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "accent" | "ok" | "warn" | "danger" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-bold whitespace-nowrap",
        tone === "default" && "bg-active text-fg-2",
        tone === "accent" && "bg-accent text-accent-ink",
        tone === "ok" && "bg-ok/15 text-ok",
        tone === "warn" && "bg-warn/15 text-warn",
        tone === "danger" && "bg-danger/15 text-danger",
      )}
    >
      {children}
    </span>
  );
}

/** Horizontal level bar (brightness, speed, sensitivity). */
export function LevelBar({ value, max, label, left, right }: { value: number; max: number; label: string; left?: string; right?: string }) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div
        role="meter"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        className="relative h-1.5 rounded-full bg-key-line"
      >
        <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${percent}%` }} />
        <div
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-accent-ink"
          style={{ left: `${percent}%` }}
        />
      </div>
      {(left || right) && (
        <div className="mt-2 flex justify-between">
          <span className="eyebrow text-subtle">{left}</span>
          <span className="eyebrow text-subtle">{right}</span>
        </div>
      )}
    </div>
  );
}

/** Row in a settings list; `selected` marks the current value. */
/** One choice of a list; with `onSelect` it's a radio button (put the list in a `role="radiogroup"`). */
export function OptionRow({
  selected,
  children,
  onSelect,
  disabled,
}: {
  selected: boolean;
  children: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
}) {
  const className = cx(
    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm",
    selected ? "bg-active font-semibold text-fg" : "bg-hover text-muted",
    onSelect && !selected && "transition-colors enabled:hover:bg-active/60 enabled:hover:text-fg",
    onSelect && "outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed",
  );
  const content = (
    <>
      <span className={cx("grid size-4 shrink-0 place-items-center rounded-full", selected ? "bg-accent" : "border border-key-line")}>
        {selected && <span className="size-1.5 rounded-full bg-accent-ink" />}
      </span>
      {children}
    </>
  );
  if (!onSelect)
    return (
      <li aria-current={selected || undefined} className={className}>
        {content}
      </li>
    );
  return (
    <li>
      <button type="button" role="radio" aria-checked={selected} disabled={disabled} onClick={onSelect} className={className}>
        {content}
      </button>
    </li>
  );
}

export function Notice({ children, icon, tone = "info" }: { children: ReactNode; icon?: ReactNode; tone?: "info" | "warn" | "danger" }) {
  return (
    <div
      className={cx(
        "flex gap-3 rounded-md p-3 text-sm leading-relaxed",
        tone === "info" && "bg-active text-fg-2",
        tone === "warn" && "bg-warn/10 text-warn",
        tone === "danger" && "bg-danger/10 text-danger",
      )}
    >
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export const InfoNotice = ({ children }: { children: ReactNode }) => <Notice icon={<InfoIcon size={16} />}>{children}</Notice>;

/** Settings list row: title and description on the left, the value or control on the right. */
export function SettingRow({ title, description, children }: { title: ReactNode; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line py-4 first:pt-0 last:border-0 last:pb-0">
      <div className="min-w-0 flex-1 basis-64">
        <p className="text-sm font-bold">{title}</p>
        {description && <p className="mt-0.5 text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-sm text-subtle">{children}</p>;
}

export function Swatch({ color, rainbow, size = 28 }: { color: string; rainbow?: boolean; size?: number }) {
  return (
    <span
      className="inline-block shrink-0 rounded-md ring-1 ring-white/15"
      style={{
        width: size,
        height: size,
        background: rainbow ? "conic-gradient(#f43f5e, #f59e0b, #84cc16, #06b6d4, #6366f1, #d946ef, #f43f5e)" : color,
      }}
    />
  );
}

/** Label / value row for definition lists. */
export function Row({ label, children, mono }: { label: ReactNode; children: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={cx("text-right text-sm font-semibold", mono && "font-mono text-[13px]")}>{children}</dd>
    </div>
  );
}
