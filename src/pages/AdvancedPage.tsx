import { useShallow } from "zustand/react/shallow";
import { Icon } from "../components/icons";
import { KeyboardStage } from "../components/KeyboardStage";
import { Card, cx, Empty, InfoTip, PageBody, Pill, ReadOnlyPill, Seg } from "../components/ui";
import { keyLegend } from "../data/keycodes";
import { ADVANCED_KEY_TYPES, LAYER_COUNT, type AdvancedKey } from "../hid/hero68";
import type { KeyboardSnapshot } from "../hid/snapshot";
import { useI18n, type MessageKey } from "../i18n";
import { useKeyNames, useKeyText } from "../lib/keys";
import { sameSet } from "../lib/selection";
import { useUi } from "../store/ui";

const SOCD_MODES: Record<number, MessageKey> = { 0: "adv.socdMode0", 1: "adv.socdMode1", 3: "adv.socdMode3", 4: "adv.socdMode4" };
const LAYERS = Array.from({ length: LAYER_COUNT }, (_, layer) => layer);
/** Every key an advanced key involves (SOCD pairs two keys). */
const involved = (key: AdvancedKey) => (key.type === "SOCD" ? [...new Set([key.pos, ...key.positions])] : [key.pos]);

/** Read only: writing advanced keys waits for a test on the keyboard. */
export function AdvancedPage({ snapshot }: { snapshot: KeyboardSnapshot }) {
  const { t, mm } = useI18n();
  const keyText = useKeyText();
  const names = useKeyNames();
  const { layer, setLayer, selected, select } = useUi(
    useShallow((s) => ({ layer: s.layer, setLayer: s.setLayer, selected: s.selected, select: s.select })),
  );
  const keys = snapshot.advancedKeys[layer] ?? [];
  const typeAt = new Map<number, AdvancedKey["type"]>();
  for (const key of keys) for (const pos of involved(key)) typeAt.set(pos, key.type);
  const precision = snapshot.device.precision?.distance || 10;
  const supported = new Set(snapshot.features.advancedKeys);

  const describe = (key: AdvancedKey): string[] => {
    switch (key.type) {
      case "TGL":
        return [t("adv.tgl", { key: keyText.name(key.key), ms: key.delayMs })];
      case "MT":
        return [t("adv.mt", { tap: keyText.name(key.tap), hold: keyText.name(key.hold), ms: key.delayMs })];
      case "DKS":
        return [
          key.distances.map((d) => `${mm(d * precision)} mm`).join(" · "),
          ...key.keys.filter((k) => k.key !== 0).map((k) => `${keyText.name(k.key)} — ${k.actions.join(" ")}`),
        ];
      case "SOCD":
        return [t("adv.socd", { keys: key.positions.map(names.name).join(" + ") }), SOCD_MODES[key.mode] ? t(SOCD_MODES[key.mode]) : `#${key.mode}`];
      case "MPT":
        return key.points.map((point) => t("adv.point", { key: keyText.name(point.key), mm: mm(point.distance * precision) }));
      case "END":
        return [t("adv.end", { key: keyText.name(key.key) })];
    }
  };

  return (
    <>
      <KeyboardStage
        title={t("nav.advanced")}
        extra={<Seg label={t("remap.layer")} value={layer} onChange={setLayer} options={LAYERS.map((l) => ({ value: l, label: t(`layers.${l}` as MessageKey) }))} />}
        values
        sameValue={(pos) => typeAt.get(pos)}
        chips={[{ label: t("adv.chip"), positions: [...typeAt.keys()] }]}
        legend={
          <span className="legend">
            <span className="font-semibold text-accent-light">Aa</span>
            {t("adv.legend")}
          </span>
        }
        render={(key) => {
          const base = snapshot.layers[layer]?.[key.pos];
          const type = typeAt.get(key.pos);
          return {
            legend: base === undefined ? key.label : keyLegend(base),
            value: type ?? "",
            alt: !!type,
            dim: !type,
            desc: type ? t(`adv.${type}` as MessageKey) : t("adv.none"),
          };
        }}
      />
      <PageBody>
        <div className="grid2">
          <Card title={t("adv.activeTitle")} info={t("adv.info")} aside={<ReadOnlyPill />}>
            {keys.length === 0 ? (
              <Empty icon="advanced" title={t("adv.empty")} />
            ) : (
              <div className="flex flex-col gap-0.5">
                {keys.map((key) => {
                  const positions = involved(key);
                  return (
                    <button
                      key={`${key.type}-${key.pos}`}
                      type="button"
                      className={cx("row items-start py-2.5", sameSet(selected, positions) && "on")}
                      onClick={() => select(positions)}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-semibold">{names.list(positions, 4)}</span>
                          <Pill tone="hot">{t(`adv.${key.type}` as MessageKey)}</Pill>
                        </span>
                        {describe(key).map((line, index) => (
                          <span key={index} className="cap block">
                            {line}
                          </span>
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          <Card title={t("adv.typesTitle")} info={t("adv.typesInfo")}>
            <div className="flex flex-col">
              {ADVANCED_KEY_TYPES.map((type, index) => {
                const ok = supported.size === 0 || supported.has(type);
                return (
                  <div key={type} className={cx("check", index === 0 && "first", !ok && "opacity-60")}>
                    <Icon name={ok ? "check" : "x"} size="s" className={ok ? "text-ok" : "text-muted"} />
                    <span className="font-medium">{t(`adv.${type}` as MessageKey)}</span>
                    <InfoTip label={t("info.about", { topic: t(`adv.${type}` as MessageKey) })}>{t(`adv.desc.${type}` as MessageKey)}</InfoTip>
                    {!ok && <span className="cap ml-auto">{t("adv.unsupported")}</span>}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
