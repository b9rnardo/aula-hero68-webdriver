import { useId, useRef, useState, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import { useI18n } from "../i18n";
import { LETTERS, WASD } from "../lib/selection";
import { useUi } from "../store/ui";
import { Icon, type IconName } from "./icons";

// Building blocks of the "Grafite Violeta" design. Rules for using them: docs/design-system.md.

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** pri: the one main action of a view. sec: other actions. gh: low-emphasis actions and toolbars. */
  variant?: "pri" | "sec" | "gh";
  sm?: boolean;
  /** Square icon-only button; needs an aria-label. */
  ico?: boolean;
};

export function Button({ variant = "sec", sm, ico, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cx("btn", variant, sm && "sm", ico && "ico", className)} {...props} />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="k">{children}</kbd>;
}

/** Renders **bold** spans in a translated string. */
export function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/g).map((part, index) => (index % 2 ? <strong key={index}>{part}</strong> : part))}
    </>
  );
}

/**
 * The "i" button. Explanations live in its tooltip, which opens on hover and on keyboard focus.
 * `end` anchors the tooltip to the right edge, for buttons near the right side of a card.
 */
export function InfoTip({ label, children, end }: { label: string; children: ReactNode; end?: boolean }) {
  const id = useId();
  return (
    <span className="info">
      <button type="button" className="ib" aria-label={label} aria-describedby={id}>
        <Icon name="info" size="xs" />
      </button>
      <span className={cx("tt", end && "end")} role="tooltip" id={id}>
        {typeof children === "string" ? <Rich text={children} /> : children}
      </span>
    </span>
  );
}

/** Title with its "i" button. */
export function Title({ as: Tag = "h2", id, children, info, infoLabel }: { as?: "h2" | "h3" | "span"; id?: string; children: ReactNode; info?: ReactNode; infoLabel?: string }) {
  const { t } = useI18n();
  return (
    <div className="ttl">
      <Tag id={id} className={Tag === "span" ? "lab" : "ct"}>
        {children}
      </Tag>
      {info && <InfoTip label={infoLabel ?? t("info.about", { topic: typeof children === "string" ? children : "" })}>{info}</InfoTip>}
    </div>
  );
}

export function Card({
  title,
  info,
  infoLabel,
  sub,
  aside,
  children,
  className,
  label,
}: {
  title?: ReactNode;
  info?: ReactNode;
  infoLabel?: string;
  /** Short visible caption under the title (a status, not an explanation). */
  sub?: ReactNode;
  /** Right side of the header: a pill, a status or a small action. */
  aside?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Accessible name when the card has no visible title. */
  label?: string;
}) {
  const id = useId();
  return (
    <section className={cx("card", className)} aria-labelledby={title ? id : undefined} aria-label={title ? undefined : label}>
      {(title || aside) && (
        <div className="ch">
          <div className="min-w-0">
            {title && (
              <Title id={id} info={info} infoLabel={infoLabel}>
                {title}
              </Title>
            )}
            {sub && <p className="cd">{sub}</p>}
          </div>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function Pill({ children, tone, icon, className }: { children: ReactNode; tone?: "hot" | "ok"; icon?: IconName; className?: string }) {
  return (
    <span className={cx("pill", tone, className)}>
      {icon && <Icon name={icon} size="xs" />}
      {children}
    </span>
  );
}

export function ReadOnlyPill() {
  const { t } = useI18n();
  return <Pill icon="lock">{t("common.readOnly")}</Pill>;
}

/** "Changed" tag next to a setting that has an unsaved change. */
export function ChangedTag({ className }: { className?: string }) {
  const { t } = useI18n();
  return <span className={cx("chg", className)}>{t("common.changed")}</span>;
}

export interface SegOption<T> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

/** Segmented control (radio group): one choice out of a few. Arrow keys move the choice. */
export function Seg<T extends string | number>({
  options,
  value,
  onChange,
  label,
  lg,
  disabled,
  className,
}: {
  options: SegOption<T>[];
  /** null when the selected keys disagree: no option is checked. */
  value: T | null;
  onChange: (value: T) => void;
  label: string;
  lg?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const group = useRef<HTMLDivElement>(null);
  const enabled = options.filter((option) => !option.disabled);
  const focusIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const onKeyDown = (event: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step || disabled || !enabled.length) return;
    event.preventDefault();
    const current = enabled.findIndex((option) => option.value === value);
    const next = enabled[(current + step + enabled.length) % enabled.length];
    onChange(next.value);
    const index = options.indexOf(next);
    group.current?.querySelectorAll<HTMLButtonElement>("button")[index]?.focus();
  };
  return (
    <div ref={group} className={cx("seg", lg && "lg", className)} role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {options.map((option, index) => {
        const on = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={index === focusIndex ? 0 : -1}
            className={cx(on && "on")}
            disabled={disabled || option.disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({ on, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean }) {
  return <button type="button" aria-pressed={on} className={cx("chip", on && "on", className)} {...props} />;
}

/** A warning or note placed right next to what it is about. */
export function Note({ tone = "info", children, className, icon }: { tone?: "warn" | "bad" | "info"; children: ReactNode; className?: string; icon?: IconName }) {
  return (
    <div className={cx("note", tone, className)} role={tone === "bad" ? "alert" : "status"}>
      <Icon name={icon ?? (tone === "info" ? "note" : "warn")} size="s" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function Empty({ icon = "keyboard", title, children }: { icon?: IconName; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} />
      <p className="font-medium text-fg">{title}</p>
      {children}
    </div>
  );
}

/** Empty state for edit cards on pages with the keyboard: nothing selected yet. */
export function SelectionEmpty() {
  const { t } = useI18n();
  const select = useUi((s) => s.select);
  return (
    <Empty title={t("selection.pick")}>
      <div className="mt-1.5 flex flex-wrap justify-center gap-2">
        <Button sm onClick={() => select(WASD)}>
          {t("selection.selectWasd")}
        </Button>
        <Button sm onClick={() => select(LETTERS)}>
          {t("selection.selectLetters")}
        </Button>
        <Button sm onClick={() => useUi.getState().selectAll()}>
          {t("selection.selectAll")}
        </Button>
      </div>
    </Empty>
  );
}

/** On/off switch. Only for preferences of the app itself; keyboard settings use Check or Seg. */
export function Switch({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={cx("sw", on && "on")} onClick={() => onChange(!on)}>
      <span className="th" />
    </button>
  );
}

/** Checkbox for keyboard settings. `checked` null means the value was not read. */
export function Check({
  checked,
  onChange,
  children,
  disabled,
  small,
}: {
  checked: boolean | null;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
  small?: boolean;
}) {
  return (
    <label className={cx("chk-l", small && "s")}>
      <input
        type="checkbox"
        checked={checked ?? false}
        ref={(input) => {
          if (input) input.indeterminate = checked === null;
        }}
        disabled={disabled || checked === null}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}

export function Swatch({ color, className }: { color: string; className?: string }) {
  return <span className={cx("swatch", className)} style={{ background: color }} aria-hidden="true" />;
}

/** The padded, centered area under the stage (or the whole page when there is no stage). */
export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="page-body">
      <div className={cx("page-wrap", className)}>{children}</div>
    </div>
  );
}

/** Page title for pages without the keyboard stage. */
export function PageHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="ph">
      <h1 className="h1">{title}</h1>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Kpi({ label, value, unit, mono }: { label: ReactNode; value: ReactNode; unit?: ReactNode; mono?: boolean }) {
  return (
    <div className="kpi">
      <span className="cap">{label}</span>
      <span className={cx("stat tabular-nums", mono && "font-mono")}>{value}</span>
      {unit && <span className="cap">{unit}</span>}
    </div>
  );
}

/** Label / value list. */
export function Dl({ rows }: { rows: [ReactNode, ReactNode, boolean?][] }) {
  return (
    <dl className="dl">
      {rows.map(([label, value, mono], index) => (
        <div key={index} className="contents">
          <dt>{label}</dt>
          <dd className={cx("tabular-nums", mono && "font-mono text-xs")}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Small "go to page" link at the bottom of an overview card. */
export function Lnk({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="lnk" onClick={onClick}>
      {children}
      <Icon name="arrow" size="xs" />
    </button>
  );
}

/** Single choice among many options (light effects): the native list with the field look. */
export function Select<T extends string | number>({
  value,
  onChange,
  options,
  label,
  disabled,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <span className={cx("select", className)}>
      <select
        value={String(value)}
        aria-label={label}
        disabled={disabled}
        onChange={(event) => {
          const option = options.find((o) => String(o.value) === event.target.value);
          if (option) onChange(option.value);
        }}
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
      <Icon name="chevron" size="s" />
    </span>
  );
}

/** Slider for a whole-number level (brightness, speed): the value next to the label and a tick on the keyboard value. */
export function LevelSlider({
  label,
  value,
  max,
  saved,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  /** Value on the keyboard; marked when the draft differs. */
  saved?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const { t } = useI18n();
  const pct = (n: number) => (Math.min(n, max) / max) * 100;
  return (
    <div>
      <div className="mb-2 flex justify-between">
        <span className="lab">{label}</span>
        <span className="font-mono text-accent-light tabular-nums">
          {value}/{max}
        </span>
      </div>
      <div className="slider">
        <div className="tr" />
        <div className="fi" style={{ width: `${pct(value)}%` }} />
        {saved !== undefined && saved !== value && <div className="tk" style={{ left: `${pct(saved)}%` }} title={t("mm.tick")} />}
        <input
          className="range"
          type="range"
          min={0}
          max={max}
          step={1}
          value={value}
          disabled={disabled}
          aria-label={label}
          aria-valuetext={`${value}/${max}`}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
    </div>
  );
}

const HEX = /^#?([0-9a-f]{6})$/i;

/** Color picker: the system picker behind a swatch, the hex code and quick colors. `value` null = mixed. */
export function ColorField({
  value,
  onChange,
  label,
  presets,
  disabled,
}: {
  value: string | null;
  onChange: (hex: string) => void;
  label: string;
  presets: { hex: string; name: string }[];
  disabled?: boolean;
}) {
  const { t } = useI18n();
  // While typing, the field keeps its own text and only valid codes reach the draft.
  const [text, setText] = useState<string | null>(null);
  const code = value ? value.toUpperCase() : "";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <label className={cx("cswatch", !value && "mixed")} style={value ? { background: value } : undefined}>
          <input type="color" value={value ?? "#000000"} disabled={disabled} aria-label={label} onChange={(event) => onChange(event.target.value)} />
        </label>
        <label className="field">
          <span className="sr-only">{t("color.hex", { label })}</span>
          <input
            className="w-[76px] text-left font-mono"
            value={text ?? code}
            placeholder={t("common.mixed")}
            spellCheck={false}
            maxLength={7}
            disabled={disabled}
            onFocus={() => setText(code)}
            onBlur={() => setText(null)}
            onChange={(event) => {
              setText(event.target.value);
              const match = HEX.exec(event.target.value.trim());
              if (match) onChange(`#${match[1].toLowerCase()}`);
            }}
          />
        </label>
      </div>
      <div className="cpres" role="group" aria-label={t("color.quick")}>
        {presets.map((preset) => (
          <button
            key={preset.hex}
            type="button"
            className={cx("cpre", value === preset.hex && "on")}
            style={{ background: preset.hex }}
            title={preset.name}
            aria-label={preset.name}
            aria-pressed={value === preset.hex}
            disabled={disabled}
            onClick={() => onChange(preset.hex)}
          />
        ))}
      </div>
    </div>
  );
}
