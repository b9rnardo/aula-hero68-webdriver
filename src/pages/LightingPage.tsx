import { useCallback } from "react";
import { hexRgb, KeyboardStage, mixColor } from "../components/KeyboardStage";
import { Card, Empty, PageBody, Pill, ReadOnlyPill } from "../components/ui";
import type { Localized } from "../data/keycodes";
import { POSITIONS } from "../data/layout";
import {
  LIGHT_MAX_BRIGHTNESS,
  LIGHT_MAX_SPEED,
  LIGHT_MODE_CUSTOM,
  LIGHT_MODE_STATIC,
  LIGHT_MODES,
  SIDE_LIGHT_MAX_BRIGHTNESS,
  SIDE_LIGHT_MODES,
} from "../data/lighting";
import type { LightState } from "../hid/hero68";
import type { KeyboardSnapshot } from "../hid/snapshot";
import { useI18n } from "../i18n";
import { hex, ledHex } from "../lib/target";
import { useLegend, ValueRows } from "./common";

const RAINBOW = "conic-gradient(#ff5f6d, #ffc371, #5fe0a6, #52c0f6, #a48bff, #ff5f6d)";
/** LED colors on the stage, toned down so the legend stays readable. */
const keyTint = (color: string) => mixColor(hexRgb(color), 0.5);

function Level({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div>
      <div className="mb-2 flex justify-between">
        <span className="lab">{label}</span>
        <span className="font-mono text-accent-light tabular-nums">
          {value}/{max}
        </span>
      </div>
      <div className="prog" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
        <div style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  );
}

function LightCard({ title, light, modes, maxBrightness }: { title: string; light: LightState | null; modes: Record<number, Localized>; maxBrightness: number }) {
  const { t, l } = useI18n();
  return (
    <Card title={title} aside={<ReadOnlyPill />}>
      {!light ? (
        <p className="cap m-0">{t("common.notRead")}</p>
      ) : (
        <>
          <div className="mb-5 flex items-center gap-3.5">
            <span className="swbig" style={{ background: light.rainbow ? RAINBOW : ledHex(light.color) }} aria-hidden="true" />
            <div className="min-w-0">
              <div className="swname">{modes[light.mode] ? l(modes[light.mode]) : `#${light.mode}`}</div>
              <div className="cap font-mono">{light.rainbow ? t("light.rainbow") : hex(light.color).toUpperCase()}</div>
            </div>
          </div>
          <div className={light.mode === 0 ? "dim flex flex-col gap-4" : "flex flex-col gap-4"}>
            <Level label={t("light.brightness")} value={light.brightness} max={maxBrightness} />
            <Level label={t("light.speed")} value={light.speed} max={LIGHT_MAX_SPEED} />
          </div>
        </>
      )}
    </Card>
  );
}

/** Read only: writing the lighting waits for a test on the keyboard. */
export function LightingPage({ snapshot }: { snapshot: KeyboardSnapshot }) {
  const { t } = useI18n();
  const legend = useLegend(snapshot);
  const colorOf = useCallback((pos: number) => {
    const color = snapshot.keys[pos]?.color;
    return color ? hex(color) : undefined;
  }, [snapshot]);
  const paintOf = (pos: number) => {
    const color = snapshot.keys[pos]?.color;
    return color ? ledHex(color) : undefined;
  };
  const main = snapshot.lighting.main;
  const custom = main?.mode === LIGHT_MODE_CUSTOM;
  // The stage mirrors what the keyboard shows: per-key colors only in the Custom effect,
  // one color for Static, and no fill for animated effects or when the light is off.
  const uniform = main?.mode === LIGHT_MODE_STATIC && !main.rainbow ? ledHex(main.color) : undefined;
  const read = POSITIONS.some((pos) => colorOf(pos) !== undefined);

  return (
    <>
      <KeyboardStage
        title={t("nav.lighting")}
        values
        sameValue={colorOf}
        render={(key) => {
          const paint = custom ? paintOf(key.pos) : uniform;
          return {
            legend: legend(key),
            value: custom ? (colorOf(key.pos)?.slice(1).toUpperCase() ?? "") : "",
            bg: paint ? keyTint(paint) : undefined,
            desc: paint ? t("light.keyDesc", { color: (colorOf(key.pos) ?? paint).toUpperCase() }) : t("light.keyNoColor"),
          };
        }}
      />
      <PageBody>
        <div className="grid3">
          <LightCard title={t("light.main")} light={main} modes={LIGHT_MODES} maxBrightness={LIGHT_MAX_BRIGHTNESS} />
          <LightCard title={t("light.side")} light={snapshot.lighting.side} modes={SIDE_LIGHT_MODES} maxBrightness={SIDE_LIGHT_MAX_BRIGHTNESS} />
          <Card title={t("light.keyColors")} info={t("light.keyColorsInfo")} aside={<Pill tone={custom ? "ok" : undefined}>{t(custom ? "light.inUse" : "light.inactive")}</Pill>}>
            {!read ? (
              <Empty icon="lighting" title={t("common.notReadTitle")} />
            ) : (
              <div className="max-h-[320px] overflow-auto">
                <ValueRows
                  positions={POSITIONS}
                  valueOf={colorOf}
                  render={(color) => color.toUpperCase()}
                  swatch={(color) => {
                    const pos = POSITIONS.find((p) => colorOf(p) === color);
                    return pos === undefined ? color : paintOf(pos);
                  }}
                  label={(color, n) => t("light.rowLabel", { n, color: color.toUpperCase() })}
                />
              </div>
            )}
          </Card>
        </div>
      </PageBody>
    </>
  );
}

