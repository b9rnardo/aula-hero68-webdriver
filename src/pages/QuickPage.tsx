import { KeyboardStage, Page, SelectionActions } from "../components/KeyboardStage";
import { Card, Eyebrow, LevelBar, Row, StateSwitch, Swatch } from "../components/ui";
import { keyLegend } from "../data/keycodes";
import { LIGHT_MAX_BRIGHTNESS, LIGHT_MODES, POLLING_HZ } from "../data/lighting";
import { formatFirmware, type KeyboardSnapshot } from "../hid/snapshot";
import { useI18n } from "../i18n";
import { ledHex, spread, useTarget } from "../lib/target";
import { BigValue, MoreLink } from "./shared";

export function QuickPage({ snapshot }: { snapshot: KeyboardSnapshot }) {
  const { t, l, mm, number, date } = useI18n();
  const target = useTarget();
  const key = (pos: number) => snapshot.keys[pos];

  const actuation = spread(target.positions.map((pos) => key(pos)?.actuationUm).filter((v) => v !== undefined));
  const rtRead = target.positions.filter((pos) => key(pos)?.rapidTrigger);
  const rtOn = rtRead.filter((pos) => key(pos)!.rapidTrigger!.enabled);
  const press = spread(rtOn.map((pos) => key(pos)!.rapidTrigger!.pressUm));
  const light = snapshot.lighting.main;
  const polling = snapshot.settings.pollingLevel;
  const hz = polling === null ? undefined : POLLING_HZ[polling];
  const active = snapshot.profile.active;

  return (
    <Page
      title={t("quick.title")}
      help={t("quick.help")}
      actions={<SelectionActions />}
      stage={
        <KeyboardStage
          label={t("quick.title")}
          render={(k) => {
            const um = key(k.pos)?.actuationUm;
            return {
              legend: keyLegend(snapshot.layers[0]?.[k.pos] ?? k.defaults[0]),
              value: um === undefined ? undefined : mm(um),
              tone: key(k.pos)?.rapidTrigger?.enabled ? "marked" : "default",
            };
          }}
        />
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card title={t("actuation.title")} highlight>
          <Eyebrow className="mb-3 text-accent">
            {t("actuation.for")} {target.label}
          </Eyebrow>
          {actuation ? (
            actuation.mixed ? (
              <BigValue unit="mm">
                {mm(actuation.min)}–{mm(actuation.max)}
              </BigValue>
            ) : (
              <BigValue unit="mm">{mm(actuation.min)}</BigValue>
            )
          ) : (
            <BigValue>{t("value.unknown")}</BigValue>
          )}
          <p className="mt-4 mb-4 text-sm leading-relaxed text-muted">{t("actuation.help")}</p>
          <MoreLink to="actuation" />
        </Card>

        <Card title={t("rt.title")} actions={<StateSwitch on={rtRead.length ? rtOn.length > 0 : null} label={t("rt.title")} />}>
          <Eyebrow className="mb-3">
            {t("rt.enabledOn")} {target.label}
          </Eyebrow>
          <BigValue unit={`/ ${rtRead.length}`}>{rtOn.length}</BigValue>
          <p className="mt-4 mb-4 text-sm text-muted">
            {press ? `${t("rt.press")}: ${press.mixed ? `${mm(press.min)}–${mm(press.max)}` : mm(press.min)} mm` : t("rt.help")}
          </p>
          <MoreLink to="rapidTrigger" />
        </Card>

        <Card title={t("light.main")}>
          {light ? (
            <>
              <div className="mb-5 flex items-center gap-3">
                <Swatch color={ledHex(light.color)} rainbow={light.rainbow} size={36} />
                <p className="text-2xl leading-tight font-bold">{LIGHT_MODES[light.mode] ? l(LIGHT_MODES[light.mode]) : `#${light.mode}`}</p>
              </div>
              <div className="mb-2 flex justify-between text-sm">
                <span className="font-semibold">{t("light.brightness")}</span>
                <span className="font-bold text-accent">
                  {light.brightness}/{LIGHT_MAX_BRIGHTNESS}
                </span>
              </div>
              <div className="mb-5">
                <LevelBar value={light.brightness} max={LIGHT_MAX_BRIGHTNESS} label={t("light.brightness")} />
              </div>
            </>
          ) : (
            <BigValue>{t("value.unknown")}</BigValue>
          )}
          <MoreLink to="lighting" />
        </Card>

        <Card title={t("settings.polling")}>
          <BigValue unit={hz === undefined ? undefined : "Hz"}>{hz === undefined ? t("value.unknown") : number(hz)}</BigValue>
          <p className="mt-4 mb-4 text-sm leading-relaxed text-muted">{t("settings.pollingDesc")}</p>
          <MoreLink to="general" />
        </Card>

        <Card title={t("quick.deviceTitle")} className="md:col-span-2 xl:col-span-2">
          <dl>
            <Row label={t("settings.model")}>{snapshot.device.model ?? snapshot.device.productName}</Row>
            <Row label={t("sidebar.profiles")}>{active === null ? t("value.unknown") : t("profile.n", { n: active + 1 })}</Row>
            <Row label={t("settings.firmware")} mono>
              {snapshot.device.firmware === null ? t("value.unknown") : formatFirmware(snapshot.device.firmware)}
            </Row>
            <Row label={t("settings.readAtLabel")}>{date(snapshot.readAt)}</Row>
          </dl>
        </Card>
      </div>
    </Page>
  );
}
