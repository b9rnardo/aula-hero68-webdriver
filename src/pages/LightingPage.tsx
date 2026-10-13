import { useCallback } from "react";
import { hexRgb, KeyboardStage, mixColor } from "../components/KeyboardStage";
import { Button, Card, ChangedTag, Check, ColorField, Empty, LevelSlider, PageBody, Pill, Select, SelectionEmpty, Swatch } from "../components/ui";
import type { Localized } from "../data/keycodes";
import { POSITIONS } from "../data/layout";
import {
  LIGHT_MAX_BRIGHTNESS,
  LIGHT_MAX_SPEED,
  LIGHT_MODE_CUSTOM,
  LIGHT_MODE_STATIC,
  LIGHT_MODES,
  LIGHT_PRESETS,
  SIDE_LIGHT_MAX_BRIGHTNESS,
  SIDE_LIGHT_MODES,
} from "../data/lighting";
import type { LightState, LightZone } from "../hid/hero68";
import type { KeyboardSnapshot } from "../hid/snapshot";
import { useI18n } from "../i18n";
import { hex, ledHex } from "../lib/target";
import { current } from "../store/draft";
import { useCount, useEditor, useLegend, ValueRows } from "./common";

const RAINBOW = "conic-gradient(#ff5f6d, #ffc371, #5fe0a6, #52c0f6, #a48bff, #ff5f6d)";
/** LED colors on the stage, toned down so the legend stays readable. */
const keyTint = (color: string) => mixColor(hexRgb(color), 0.5);
const rgbOf = (code: string) => {
  const [r, g, b] = hexRgb(code);
  return { r, g, b };
};

const MAIN_OFF = 0;
const MAIN_NEON = 3;
const SIDE_OFF = 0;
const SIDE_STATIC = 3;

/** What each zone uses, like the official driver: off ignores everything, Custom and Neon bring their own colors. */
const ZONES: Record<LightZone, { modes: Record<number, Localized>; maxBrightness: number; usesColor: (mode: number) => boolean; usesSpeed: (mode: number) => boolean }> = {
  main: {
    modes: LIGHT_MODES,
    maxBrightness: LIGHT_MAX_BRIGHTNESS,
    usesColor: (mode) => mode !== MAIN_OFF && mode !== LIGHT_MODE_CUSTOM && mode !== MAIN_NEON,
    usesSpeed: (mode) => mode !== MAIN_OFF && mode !== LIGHT_MODE_CUSTOM && mode !== LIGHT_MODE_STATIC,
  },
  side: {
    modes: SIDE_LIGHT_MODES,
    maxBrightness: SIDE_LIGHT_MAX_BRIGHTNESS,
    usesColor: (mode) => mode !== SIDE_OFF,
    usesSpeed: (mode) => mode !== SIDE_OFF && mode !== SIDE_STATIC,
  },
};

function usePresets() {
  const { l } = useI18n();
  return LIGHT_PRESETS.map((preset) => ({ hex: preset.hex, name: l(preset.name) }));
}

function LightCard({ zone, snapshot }: { zone: LightZone; snapshot: KeyboardSnapshot }) {
  const { t, l } = useI18n();
  const { draft, edit, writable } = useEditor();
  const presets = usePresets();
  const light = current.light(draft, snapshot, zone);
  const saved = snapshot.lighting[zone];
  const { modes, maxBrightness, usesColor, usesSpeed } = ZONES[zone];
  const title = t(`light.${zone}`);

  const change = (patch: Partial<LightState>) =>
    edit(`light.${zone}`, (d, snap) => {
      const base = current.light(d, snap, zone);
      if (base) d.light[zone] = { ...base, ...patch };
    });

  return (
    <Card title={title} info={t(`light.${zone}Info`)} aside={zone in draft.light && <ChangedTag />}>
      {!light ? (
        <p className="cap m-0">{t("common.notRead")}</p>
      ) : (
        <div className="flex flex-col gap-5">
          <div>
            <div className="lab mb-2">{t("light.effect")}</div>
            <div className="flex items-center gap-3">
              <span className="swbig" style={{ background: light.mode === 0 ? "var(--color-key)" : light.rainbow ? RAINBOW : ledHex(light.color) }} aria-hidden="true" />
              <Select<number>
                className="min-w-0 flex-1"
                label={t("light.effectOf", { zone: title })}
                value={light.mode}
                disabled={!writable}
                onChange={(mode) => change({ mode })}
                options={Object.entries(modes).map(([mode, name]) => ({ value: Number(mode), label: l(name) }))}
              />
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="lab">{t("light.color")}</span>
              <Check small checked={light.rainbow} disabled={!writable || !usesColor(light.mode)} onChange={(rainbow) => change({ rainbow })}>
                {t("light.rainbow")}
              </Check>
            </div>
            <ColorField
              label={t("light.colorOf", { zone: title })}
              value={hex(light.color)}
              presets={presets}
              disabled={!writable || !usesColor(light.mode)}
              // Like the official driver, picking a color leaves rainbow.
              onChange={(code) => change({ color: rgbOf(code), rainbow: false })}
            />
          </div>
          <LevelSlider
            label={t("light.brightness")}
            value={light.brightness}
            max={maxBrightness}
            saved={saved?.brightness}
            disabled={!writable || light.mode === 0}
            onChange={(brightness) => change({ brightness })}
          />
          <LevelSlider
            label={t("light.speed")}
            value={light.speed}
            max={LIGHT_MAX_SPEED}
            saved={saved?.speed}
            disabled={!writable || !usesSpeed(light.mode)}
            onChange={(speed) => change({ speed })}
          />
        </div>
      )}
    </Card>
  );
}

/** Effects of both lights and per-key colors go through the draft. */
export function LightingPage({ snapshot }: { snapshot: KeyboardSnapshot }) {
  const { t, l } = useI18n();
  const { draft, edit, selected, writable } = useEditor();
  const legend = useLegend(snapshot);
  const count = useCount();
  const presets = usePresets();

  const colorOf = useCallback(
    (pos: number) => {
      const color = current.color(draft, snapshot, pos);
      return color ? hex(color) : undefined;
    },
    [draft, snapshot],
  );
  const main = current.light(draft, snapshot, "main");
  const custom = main?.mode === LIGHT_MODE_CUSTOM;
  const read = POSITIONS.some((pos) => colorOf(pos) !== undefined);
  const keys = selected.filter((pos) => colorOf(pos) !== undefined);
  const codes = new Set(keys.map(colorOf));
  const single = codes.size === 1 ? [...codes][0]! : null;

  const paint = (code: string) =>
    edit("color", (d) => {
      for (const pos of keys) d.color[pos] = rgbOf(code);
    });
  const toCustom = () =>
    edit("light.main", (d, snap) => {
      const base = current.light(d, snap, "main");
      if (base) d.light.main = { ...base, mode: LIGHT_MODE_CUSTOM };
    });

  return (
    <>
      <KeyboardStage
        title={t("nav.lighting")}
        values
        sameValue={colorOf}
        legend={
          read &&
          main &&
          !custom && (
            <span className="legend">
              <Swatch color="var(--color-key)" />
              {t("light.stageInactive", { mode: l(LIGHT_MODES[main.mode] ?? LIGHT_MODES[0]) })}
            </span>
          )
        }
        render={(key) => {
          const code = colorOf(key.pos);
          return {
            legend: legend(key),
            value: code?.slice(1).toUpperCase() ?? "",
            bg: code ? keyTint(ledHex(rgbOf(code))) : undefined,
            dirty: key.pos in draft.color,
            desc: code ? t("light.keyDesc", { color: code.toUpperCase() }) : t("light.keyNoColor"),
          };
        }}
      />
      <PageBody>
        <div className="stack">
          <div className="grid2">
            <LightCard zone="main" snapshot={snapshot} />
            <LightCard zone="side" snapshot={snapshot} />
          </div>
          <div className="grid2">
            <Card
              title={t("light.keyColors")}
              info={t("light.keyColorsInfo")}
              aside={
                <>
                  {keys.some((pos) => pos in draft.color) && <ChangedTag />}
                  {main && <Pill tone={custom ? "ok" : undefined}>{t(custom ? "light.inUse" : "light.inactive")}</Pill>}
                </>
              }
            >
              {!read ? (
                <Empty icon="lighting" title={t("common.notReadTitle")} />
              ) : !keys.length ? (
                <SelectionEmpty />
              ) : (
                <div className="flex flex-col gap-5">
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="lab">{t("light.color")}</span>
                      <span className="cap">{count(keys.length)}</span>
                    </div>
                    <ColorField label={t("light.keyColorOf", { keys: count(keys.length) })} value={single} presets={presets} disabled={!writable} onChange={paint} />
                  </div>
                  {main && !custom && (
                    <div>
                      <Button sm disabled={!writable} onClick={toCustom}>
                        {t("light.useCustom")}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
            <Card title={t("light.inUseTitle")} info={t("light.inUseInfo")}>
              {!read ? (
                <p className="cap m-0">{t("common.notRead")}</p>
              ) : (
                <div className="max-h-[320px] overflow-auto">
                  <ValueRows
                    positions={POSITIONS}
                    valueOf={colorOf}
                    render={(code) => code.toUpperCase()}
                    swatch={(code) => ledHex(rgbOf(code))}
                    label={(code, n) => t("light.rowLabel", { n, color: code.toUpperCase() })}
                  />
                </div>
              )}
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  );
}
