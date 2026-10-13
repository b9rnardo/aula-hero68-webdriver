import { KeyboardStage, Page, SelectionActions } from "../components/KeyboardStage";
import { TravelGauge } from "../components/TravelGauge";
import { Card, Eyebrow, Row, StateSwitch } from "../components/ui";
import { keyLegend } from "../data/keycodes";
import type { KeyboardSnapshot } from "../hid/snapshot";
import { useI18n } from "../i18n";
import { spread, useTarget, type Spread } from "../lib/target";
import { BigValue, switchTravel } from "./shared";

export function DeadZonePage({ snapshot }: { snapshot: KeyboardSnapshot }) {
  const { t, mm } = useI18n();
  const target = useTarget();
  const dz = (pos: number) => snapshot.keys[pos]?.deadZone;

  const read = target.positions.filter((pos) => dz(pos));
  const enabled = read.filter((pos) => dz(pos)!.enabled);
  const source = enabled.length ? enabled : read;
  const top = spread(source.map((pos) => dz(pos)!.topUm));
  const bottom = spread(source.map((pos) => dz(pos)!.bottomUm));
  const state = read.length === 0 ? null : enabled.length === read.length ? true : enabled.length === 0 ? false : null;
  const travel = switchTravel(snapshot, target.positions);
  const format = (range: Spread | null) =>
    range ? (range.mixed ? `${mm(range.min)}–${mm(range.max)} mm` : `${mm(range.min)} mm`) : t("value.unknown");

  return (
    <Page
      title={t("dz.title")}
      help={t("dz.help")}
      actions={<SelectionActions />}
      stage={
        <KeyboardStage
          label={t("dz.title")}
          render={(key) => {
            const value = dz(key.pos);
            return {
              legend: keyLegend(snapshot.layers[0]?.[key.pos] ?? key.defaults[0]),
              value: value?.enabled ? mm(value.topUm) : undefined,
              tone: value?.enabled ? "marked" : "default",
            };
          }}
        />
      }
    >
      <div className="max-w-3xl">
        <Card highlight>
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0 flex-1 basis-56">
              <div className="mb-3 flex items-center justify-between gap-3">
                <Eyebrow className="text-accent">
                  {t("dz.enabledOn")} {target.label}
                </Eyebrow>
                <StateSwitch on={state} label={t("dz.title")} />
              </div>
              <BigValue unit={`/ ${read.length}`}>{enabled.length}</BigValue>
              <p className="mt-5 text-sm leading-relaxed text-muted">{t("dz.desc")}</p>
              <dl className={enabled.length ? "mt-4" : "mt-4 opacity-50"}>
                <Row label={t("dz.top")}>{format(top)}</Row>
                <Row label={t("dz.bottom")}>{format(bottom)}</Row>
              </dl>
            </div>
            <TravelGauge
              travelUm={travel.travelUm}
              zones={enabled.length && top && bottom ? { top: top.max, bottom: bottom.max } : null}
              label={t("dz.title")}
            />
          </div>
        </Card>
      </div>
    </Page>
  );
}
