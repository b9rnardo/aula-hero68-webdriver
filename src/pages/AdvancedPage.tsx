import { useShallow } from "zustand/react/shallow";
import { KeyboardStage, Page, SelectionActions } from "../components/KeyboardStage";
import { CheckIcon } from "../components/icons";
import { Badge, Card, cx, Empty } from "../components/ui";
import { keyLegend } from "../data/keycodes";
import { keyByPos } from "../data/layout";
import { ADVANCED_KEY_TYPES, type AdvancedKey } from "../hid/hero68";
import type { KeyboardSnapshot } from "../hid/snapshot";
import { useI18n, type MessageKey } from "../i18n";
import { useKeyText } from "../lib/keys";
import { useUi } from "../store/ui";

const SOCD_MODES: Record<number, MessageKey> = { 0: "adv.socdMode0", 1: "adv.socdMode1", 3: "adv.socdMode3", 4: "adv.socdMode4" };
const keyName = (pos: number) => keyByPos.get(pos)?.label || "Space";
/** Every key an advanced key involves (SOCD pairs two keys). */
const involved = (key: AdvancedKey) => (key.type === "SOCD" ? [...new Set([key.pos, ...key.positions])] : [key.pos]);

export function AdvancedPage({ snapshot }: { snapshot: KeyboardSnapshot }) {
  const { t, mm } = useI18n();
  const keyText = useKeyText();
  const { layer, select } = useUi(useShallow((s) => ({ layer: s.layer, select: s.select })));
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
        return [
          t("adv.socd", { keys: key.positions.map(keyName).join(" + ") }),
          SOCD_MODES[key.mode] ? t(SOCD_MODES[key.mode]) : `#${key.mode}`,
        ];
      case "MPT":
        return key.points.map((point) => t("adv.point", { key: keyText.name(point.key), mm: mm(point.distance * precision) }));
      case "END":
        return [t("adv.end", { key: keyText.name(key.key) })];
    }
  };

  return (
    <Page
      title={t("adv.title")}
      help={t("adv.help")}
      actions={<SelectionActions />}
      stage={
        <KeyboardStage
          layers
          label={t("adv.title")}
          render={(key) => {
            const base = snapshot.layers[layer]?.[key.pos];
            const type = typeAt.get(key.pos);
            return { legend: base === undefined ? key.label : keyLegend(base), value: type, tone: type ? "marked" : "dim" };
          }}
        />
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card title={t("adv.activeTitle")} actions={<Badge tone={keys.length ? "accent" : "default"}>{keys.length}</Badge>} highlight>
          {keys.length === 0 ? (
            <Empty>{t("adv.empty")}</Empty>
          ) : (
            <ul className="space-y-2">
              {keys.map((key) => (
                <li key={`${key.type}-${key.pos}`}>
                  <button
                    type="button"
                    onClick={() => select(involved(key))}
                    className="w-full rounded-md bg-hover p-3 text-left transition-colors hover:bg-active"
                  >
                    <span className="mb-1 flex items-center justify-between gap-2">
                      <span className="font-bold">{keyName(key.pos)}</span>
                      <Badge tone="accent">{t(`adv.${key.type}` as MessageKey)}</Badge>
                    </span>
                    {describe(key).map((line, index) => (
                      <span key={index} className="block text-sm text-muted">
                        {line}
                      </span>
                    ))}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t("adv.typesTitle")} description={t("adv.typesDesc")}>
          <ul className="space-y-1">
            {ADVANCED_KEY_TYPES.map((type) => {
              const ok = supported.size === 0 || supported.has(type);
              return (
                <li key={type} className={cx("flex gap-3 rounded-md px-3 py-2", !ok && "opacity-45")}>
                  <span className={cx("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", ok ? "bg-accent text-accent-ink" : "bg-key-line")}>
                    {ok && <CheckIcon size={13} strokeWidth={2.6} />}
                  </span>
                  <span>
                    <span className="block text-sm font-bold">
                      {t(`adv.${type}` as MessageKey)}
                      {!ok && <span className="ml-2 text-xs font-semibold text-subtle">{t("adv.unsupported")}</span>}
                    </span>
                    <span className="block text-sm text-muted">{t(`adv.desc.${type}` as MessageKey)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </Page>
  );
}
