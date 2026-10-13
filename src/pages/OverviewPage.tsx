import type { ReactNode } from "react";
import { Icon, type IconName } from "../components/icons";
import { Button, Card, Lnk, PageBody, PageHeader } from "../components/ui";
import { keyByPos, LAYOUT, POSITIONS } from "../data/layout";
import { POLLING_HZ } from "../data/lighting";
import { switchById } from "../data/switches";
import { LAYER_COUNT } from "../hid/hero68";
import type { KeyboardSnapshot } from "../hid/snapshot";
import { useI18n } from "../i18n";
import { downloadBackup } from "../lib/backup";
import { useKeyNames } from "../lib/keys";
import { groupBy } from "../lib/target";
import { navigate, type PageId } from "../navigation";
import { current, useDraft } from "../store/draft";
import { useDriver } from "../store/driver";

const TOTAL = LAYOUT.length;
const LAYERS = Array.from({ length: LAYER_COUNT }, (_, layer) => layer);

/** The value most keys share, and how many keys have it. */
function mostCommon<T extends string | number>(valueOf: (pos: number) => T | undefined) {
  const groups = groupBy(POSITIONS, valueOf);
  if (!groups.length) return null;
  const [value, keys] = groups.reduce((best, group) => (group[1].length > best[1].length ? group : best));
  const read = groups.reduce((sum, group) => sum + group[1].length, 0);
  return { value, count: keys.length, others: read - keys.length };
}

function Summary({ title, sub, icon, page, link, children }: { title: string; sub: string; icon: IconName; page: PageId; link: string; children: ReactNode }) {
  return (
    <Card title={title} sub={sub} aside={<Icon name={icon} className="text-accent-light" />}>
      {children}
      <Lnk onClick={() => navigate(page)}>{link}</Lnk>
    </Card>
  );
}

function Stat({ value, unit, detail, mono }: { value: ReactNode; unit?: string; detail: ReactNode; mono?: boolean }) {
  return (
    <>
      <div className="flex items-baseline gap-1.5">
        <span className={mono ? "stat font-mono tabular-nums" : "stat tabular-nums"}>{value}</span>
        {unit && <span className="text-muted">{unit}</span>}
      </div>
      <p className="cap mt-1 mb-3">{detail}</p>
    </>
  );
}

/** Summary cards; each one opens the page that edits it. Values include unsaved changes. */
export function OverviewPage({ snapshot }: { snapshot: KeyboardSnapshot }) {
  const { t, mm, number } = useI18n();
  const names = useKeyNames();
  const draft = useDraft((s) => s.draft);
  const source = useDriver((s) => s.source);
  const onOff = (on: boolean | null) => t(on === null ? "common.notRead" : on ? "common.on" : "common.off");

  const act = mostCommon((pos) => current.act(draft, snapshot, pos));
  const rtRead = POSITIONS.some((pos) => current.rt(draft, snapshot, pos) !== undefined);
  const rtOn = POSITIONS.filter((pos) => current.rt(draft, snapshot, pos)?.enabled);
  const remapRead = snapshot.layers.length > 0;
  const remapped = POSITIONS.filter((pos) =>
    LAYERS.some((layer) => {
      const value = current.fn(draft, snapshot, layer, pos);
      return value !== undefined && value !== keyByPos.get(pos)!.defaults[layer];
    }),
  );
  const sw = mostCommon((pos) => snapshot.keys[pos]?.switchType);
  const swInfo = sw ? switchById.get(sw.value) : undefined;
  const polling = current.setting(draft, snapshot, "pollingLevel");

  return (
    <PageBody>
      <PageHeader title={t("nav.overview")} />
      <div className="bento">
        <Summary title={t("nav.actuation")} sub={t("ov.actSub")} icon="actuation" page="actuation" link={t("ov.actLink")}>
          {act ? (
            <Stat
              mono
              value={mm(act.value)}
              unit="mm"
              detail={[t("ov.ofKeys", { n: act.count, total: TOTAL }), act.others > 0 && t("ov.otherValue", { n: act.others })].filter(Boolean).join(" · ")}
            />
          ) : (
            <Stat value="—" detail={t("common.notRead")} />
          )}
        </Summary>

        <Summary title={t("nav.rapidTrigger")} sub={t("ov.rtSub")} icon="rapidTrigger" page="rapidTrigger" link={t("ov.rtLink")}>
          <Stat value={rtRead ? number(rtOn.length) : "—"} detail={!rtRead ? t("common.notRead") : rtOn.length ? names.list(rtOn, 8) : t("ov.noKeys")} />
        </Summary>

        <Summary title={t("nav.remap")} sub={t("ov.mapSub")} icon="remap" page="remap" link={t("ov.mapLink")}>
          <Stat
            value={remapRead ? number(remapped.length) : "—"}
            detail={!remapRead ? t("common.notRead") : remapped.length ? names.list(remapped, 3) : t("ov.mapNone")}
          />
        </Summary>

        <Summary title={t("nav.switch")} sub={t("ov.swSub")} icon="switch" page="switch" link={t("ov.swLink")}>
          {sw ? (
            <Stat
              value={swInfo?.name ?? t("sw.unknown", { id: sw.value })}
              detail={[t("ov.ofKeys", { n: sw.count, total: TOTAL }), swInfo && t("sw.travel", { value: mm(swInfo.travelUm) })].filter(Boolean).join(" · ")}
            />
          ) : (
            <Stat value="—" detail={t("common.notRead")} />
          )}
        </Summary>

        <Summary title={t("nav.settings")} sub={t("set.polling")} icon="settings" page="settings" link={t("ov.setLink")}>
          <Stat
            value={polling === null ? "—" : number(POLLING_HZ[polling])}
            unit={polling === null ? undefined : "Hz"}
            detail={`${t("set.winLock")}: ${onOff(current.setting(draft, snapshot, "winLock")).toLowerCase()} · ${t("set.autoCalibrate")}: ${onOff(
              current.setting(draft, snapshot, "autoCalibrate"),
            ).toLowerCase()}`}
          />
        </Summary>

        <Card title={t("ov.backup")} info={t("ov.backupInfo")}>
          <Button onClick={() => downloadBackup(snapshot)} disabled={source !== "device"}>
            <Icon name="download" size="s" />
            {t("action.downloadBackup")}
          </Button>
          {source !== "device" && <p className="cap mt-2 mb-0">{t(source === "file" ? "ov.backupFromFile" : "ov.backupDemo")}</p>}
        </Card>
      </div>
    </PageBody>
  );
}
