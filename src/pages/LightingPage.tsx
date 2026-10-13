import { KeyboardStage, Page, SelectionActions } from "../components/KeyboardStage";
import { Badge, Card, Empty, Eyebrow, LevelBar, Swatch } from "../components/ui";
import { keyLegend, type Localized } from "../data/keycodes";
import { keyByPos, POSITIONS } from "../data/layout";
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
import { groupBy, hex, ledHex } from "../lib/target";
import { useUi } from "../store/ui";
import { DistributionRow } from "./shared";

function LightCard({
  title,
  light,
  modes,
  maxBrightness,
}: {
  title: string;
  light: LightState | null;
  modes: Record<number, Localized>;
  maxBrightness: number;
}) {
  const { t, l } = useI18n();
  if (!light) {
    return (
      <Card title={title}>
        <Empty>{t("value.unknown")}</Empty>
      </Card>
    );
  }
  const off = light.mode === 0;
  return (
    <Card title={title}>
      <Eyebrow className="mb-2">{t("light.effect")}</Eyebrow>
      <div className="mb-6 flex items-center gap-3">
        <Swatch color={ledHex(light.color)} rainbow={light.rainbow} size={36} />
        <div className="min-w-0">
          <p className="text-2xl leading-tight font-bold">{modes[light.mode] ? l(modes[light.mode]) : `#${light.mode}`}</p>
          <p className="font-mono text-xs text-muted">{light.rainbow ? t("light.rainbow") : hex(light.color).toUpperCase()}</p>
        </div>
      </div>
      <div className={off ? "space-y-5 opacity-40" : "space-y-5"}>
        <div>
          <div className="mb-2 flex justify-between text-sm">
            <span className="font-semibold">{t("light.brightness")}</span>
            <span className="font-bold text-accent">
              {light.brightness}/{maxBrightness}
            </span>
          </div>
          <LevelBar value={light.brightness} max={maxBrightness} label={t("light.brightness")} />
        </div>
        <div>
          <div className="mb-2 flex justify-between text-sm">
            <span className="font-semibold">{t("light.speed")}</span>
            <span className="font-bold text-accent">
              {light.speed}/{LIGHT_MAX_SPEED}
            </span>
          </div>
          <LevelBar value={light.speed} max={LIGHT_MAX_SPEED} label={t("light.speed")} />
        </div>
      </div>
    </Card>
  );
}

export function LightingPage({ snapshot }: { snapshot: KeyboardSnapshot }) {
  const { t } = useI18n();
  const select = useUi((s) => s.select);
  const selected = useUi((s) => s.selected);
  const rgbOf = (pos: number) => snapshot.keys[pos]?.color;
  const colorOf = (pos: number) => {
    const color = rgbOf(pos);
    return color ? hex(color) : undefined;
  };
  const paintOf = (pos: number) => {
    const color = rgbOf(pos);
    return color ? ledHex(color) : undefined;
  };
  const palette = groupBy(POSITIONS, colorOf).sort((a, b) => b[1].length - a[1].length);
  const main = snapshot.lighting.main;
  const custom = main?.mode === LIGHT_MODE_CUSTOM;
  // The stage mirrors what the keyboard shows: per-key colors only in the Custom effect,
  // one color for Static, and no fill for animated effects or when the light is off.
  const uniform = main?.mode === LIGHT_MODE_STATIC && !main.rainbow ? ledHex(main.color) : undefined;

  return (
    <Page
      title={t("light.title")}
      help={t("light.help")}
      actions={<SelectionActions />}
      stage={
        <KeyboardStage
          label={custom ? t("light.keyColors") : t("light.main")}
          render={(key) => ({
            legend: keyLegend(snapshot.layers[0]?.[key.pos] ?? key.defaults[0]),
            fill: custom ? paintOf(key.pos) : uniform,
          })}
        />
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <LightCard title={t("light.main")} light={snapshot.lighting.main} modes={LIGHT_MODES} maxBrightness={LIGHT_MAX_BRIGHTNESS} />
        <LightCard title={t("light.side")} light={snapshot.lighting.side} modes={SIDE_LIGHT_MODES} maxBrightness={SIDE_LIGHT_MAX_BRIGHTNESS} />
        <Card
          title={t("light.keyColors")}
          description={t("light.keyColorsDesc")}
          actions={custom ? <Badge tone="accent">{t("value.on")}</Badge> : <Badge>{t("light.keyColorsInactive")}</Badge>}
          className="md:col-span-2 xl:col-span-1"
        >
          {palette.length === 0 ? (
            <Empty>{t("light.noColors")}</Empty>
          ) : selected.length > 0 ? (
            <ul className="grid grid-cols-2 gap-2">
              {selected.slice(0, 12).map((pos) => (
                <li key={pos} className="flex items-center gap-2 rounded-md bg-hover px-2.5 py-2">
                  <Swatch color={paintOf(pos) ?? "transparent"} size={20} />
                  <span className="truncate text-sm font-semibold">{keyByPos.get(pos)?.label || "Space"}</span>
                  <span className="ml-auto font-mono text-[11px] text-muted">{colorOf(pos)?.toUpperCase() ?? "—"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="-mx-3 max-h-72 space-y-0.5 overflow-y-auto">
              {palette.slice(0, 16).map(([color, positions]) => (
                <DistributionRow
                  key={color}
                  label={<span className="font-mono text-xs">{color.toUpperCase()}</span>}
                  swatch={<Swatch color={paintOf(positions[0]) ?? color} size={18} />}
                  count={positions.length}
                  total={POSITIONS.length}
                  onSelect={() => select(positions)}
                />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Page>
  );
}
