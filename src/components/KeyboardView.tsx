import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { LAYOUT, LAYOUT_HEIGHT, LAYOUT_WIDTH, type LayoutKey } from "../data/layout";
import { cx } from "./ui";

export interface KeyCap {
  legend: string;
  /** Setting value drawn in the top-left corner (e.g. "1,00"). */
  value?: string;
  /** Face color, e.g. a per-key RGB value. */
  fill?: string;
  /** "marked" tints the key (setting active or changed); "dim" fades it. */
  tone?: "default" | "marked" | "dim";
}

interface Props {
  render: (key: LayoutKey) => KeyCap;
  label: string;
  selected?: ReadonlySet<number>;
  /** Enables click and drag selection. */
  onSelect?: (positions: number[], mode: "add" | "remove") => void;
}

const U = 52;
const GAP = 5;
const PAD = 2;
const WIDTH = LAYOUT_WIDTH * U + PAD * 2;
const HEIGHT = LAYOUT_HEIGHT * U + PAD * 2;

/** Relative luminance check to keep legends readable on colored keys. */
function isLight(color: string) {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(color);
  if (!match) return false;
  const [r, g, b] = match.slice(1).map((hex) => parseInt(hex, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55;
}

function fontSize(text: string, width: number, max: number) {
  return Math.max(8, Math.min(max, (width - 12) / (Math.max(text.length, 1) * 0.6)));
}

/** Flat Wootility-style keyboard drawn from the layout geometry, with click/drag multi-select. */
export function KeyboardView({ render, label, selected, onSelect }: Props) {
  const drag = useRef<{ mode: "add" | "remove"; seen: Set<number> } | null>(null);
  const lastPointer = useRef<string>("mouse");

  useEffect(() => {
    const end = () => (drag.current = null);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, []);

  const toggle = (pos: number) => onSelect?.([pos], selected?.has(pos) ? "remove" : "add");

  const handlePointerDown = (event: PointerEvent, pos: number) => {
    lastPointer.current = event.pointerType;
    // Touch keeps scrolling the page; a tap toggles through onClick instead.
    if (!onSelect || event.pointerType === "touch" || event.button !== 0) return;
    event.preventDefault();
    const mode = selected?.has(pos) ? "remove" : "add";
    drag.current = { mode, seen: new Set([pos]) };
    onSelect([pos], mode);
  };

  const handlePointerEnter = (pos: number) => {
    const current = drag.current;
    if (!current || current.seen.has(pos)) return;
    current.seen.add(pos);
    onSelect?.([pos], current.mode);
  };

  const handleKey = (event: KeyboardEvent, pos: number) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle(pos);
    }
  };

  const interactive = Boolean(onSelect);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mx-auto block w-full max-w-[860px] min-w-[600px] select-none"
        role="group"
        aria-label={label}
      >
        {LAYOUT.map((key) => {
          const cap = render(key);
          const x = PAD + key.x * U + GAP / 2;
          const y = PAD + key.y * U + GAP / 2;
          const w = key.w * U - GAP;
          const h = key.h * U - GAP;
          const isSelected = selected?.has(key.pos) ?? false;
          const lightFace = cap.fill !== undefined && isLight(cap.fill);
          const ink = lightFace ? "#1a1029" : cap.tone === "marked" || isSelected ? "var(--color-fg)" : "var(--color-fg-2)";
          return (
            <g
              key={key.pos}
              data-pos={key.pos}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-pressed={interactive ? isSelected : undefined}
              aria-label={`${key.label || "Space"}: ${cap.legend}${cap.value ? ` (${cap.value})` : ""}`}
              onPointerDown={interactive ? (event) => handlePointerDown(event, key.pos) : undefined}
              onPointerEnter={interactive ? () => handlePointerEnter(key.pos) : undefined}
              onClick={interactive ? () => lastPointer.current === "touch" && toggle(key.pos) : undefined}
              onKeyDown={interactive ? (event) => handleKey(event, key.pos) : undefined}
              className={cx("group outline-none", interactive && "cursor-pointer")}
              opacity={cap.tone === "dim" && !isSelected ? 0.4 : 1}
            >
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                rx={5}
                className={cx(
                  "transition-[stroke,fill] duration-100",
                  cap.fill === undefined && (cap.tone === "marked" ? "fill-[#3b2c63]" : isSelected ? "fill-[#33294b]" : "fill-key"),
                  isSelected
                    ? "stroke-accent"
                    : cap.tone === "marked"
                      ? "stroke-accent/45"
                      : "stroke-key-line group-hover:stroke-muted group-focus-visible:stroke-accent",
                )}
                fill={cap.fill}
                strokeWidth={isSelected ? 2.5 : 1}
              />
              {cap.value && (
                <text
                  x={x + 6}
                  y={y + 12}
                  fill={lightFace ? "#1a1029" : "var(--color-accent)"}
                  fontSize={fontSize(cap.value, w * 0.9, 10.5)}
                  fontWeight={700}
                  className="pointer-events-none"
                >
                  {cap.value}
                </text>
              )}
              <text
                x={x + w / 2}
                y={y + h / 2 + (cap.value ? 5 : 1)}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={ink}
                fontSize={fontSize(cap.legend, w, 13.5)}
                fontWeight={600}
                className="pointer-events-none"
              >
                {cap.legend}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
