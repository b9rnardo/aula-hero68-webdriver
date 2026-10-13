import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { Icon } from "../components/icons";
import { SwitchDiagram } from "../components/SwitchDiagram";
import { TravelChart } from "../components/TravelChart";
import { Button, Card, Empty, Kpi, Note, Pill } from "../components/ui";
import type { KeyboardSnapshot } from "../hid/snapshot";
import { useI18n } from "../i18n";
import { useKeyNames } from "../lib/keys";
import { current, useDraft } from "../store/draft";
import { useDriver } from "../store/driver";
import { TRACE_MS, useLive } from "../store/live";
import { travelOf } from "./common";

/** Switch page, live travel mode: the trace of the followed key, its switch and a few numbers. */
export function LiveTravel({ snapshot }: { snapshot: KeyboardSnapshot }) {
  const { t, mm } = useI18n();
  const names = useKeyNames();
  const draft = useDraft((s) => s.draft);
  const source = useDriver((s) => s.source);
  const { status, error, focus, trace, hits, start, stop, resetCounters } = useLive(
    useShallow((s) => ({
      status: s.status,
      error: s.error,
      focus: s.focus,
      trace: s.trace,
      hits: s.hits,
      start: s.start,
      stop: s.stop,
      resetCounters: s.resetCounters,
    })),
  );
  const key = useLive((s) => (s.focus === null ? undefined : s.keys[s.focus]));

  // Measure mode never outlives this panel.
  useEffect(() => () => void useLive.getState().stop(), []);

  if (source === "file")
    return (
      <Card title={t("sw.live")} info={t("sw.liveInfo")} className="narrow">
        <Empty icon="plug" title={t("live.needsKeyboard")} />
      </Card>
    );

  const on = status === "on";
  const name = focus === null ? "" : names.name(focus);
  const travelUm = focus === null ? 4000 : travelOf(snapshot, focus, draft);
  const actuationUm = focus === null ? undefined : current.act(draft, snapshot, focus);
  const peak = trace.reduce((max, point) => Math.max(max, point.depthUm), 0);
  const count = focus === null ? 0 : (hits[focus] ?? 0);
  const caption = !on
    ? t("live.off")
    : focus === null
      ? t("live.waiting")
      : t("live.window", { name }) + (source === "demo" ? ` · ${t("live.simulated")}` : "");

  const toggle = () => {
    // A key pressed during the test shouldn't press the focused button again.
    (document.activeElement as HTMLElement | null)?.blur();
    void (on ? stop() : start());
  };

  return (
    <div className="grid2">
      <Card
        title={t("sw.live")}
        info={t("sw.liveInfo")}
        aside={
          <Button variant={on ? "sec" : "pri"} sm onClick={toggle} disabled={status === "starting"}>
            <Icon name={on ? "stop" : "play"} size="s" />
            {t(on ? "live.stop" : "live.start")}
          </Button>
        }
      >
        {error && (
          <Note tone="bad" className="mb-3">
            {error}
          </Note>
        )}
        <p className="lab mt-0 mb-2.5" aria-live="polite">
          {caption}
        </p>
        <TravelChart
          points={trace}
          spanMs={TRACE_MS}
          travelUm={travelUm}
          actuationUm={actuationUm}
          label={
            focus === null
              ? t("live.chartEmpty")
              : t("live.chartLabel", { name, peak: mm(peak), hits: count })
          }
        />
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          <span className="legend">
            <span className="lg-line bg-[#4a4260]" />
            {t("live.travel")}
          </span>
          <span className="legend">
            <span className="lg-line" />
            {t("rt.sim.on")}
          </span>
          <span className="legend">
            <span className="lg-dash" />
            {t("live.actuation")}
          </span>
        </div>
      </Card>

      <Card
        title={focus === null ? t("live.noKey") : t("live.key", { name })}
        aside={on && key && <Pill tone={key.pressed ? "hot" : undefined}>{t(key.pressed ? "live.pressed" : "live.released")}</Pill>}
      >
        <SwitchDiagram
          minUm={actuationUm ?? null}
          maxUm={actuationUm ?? null}
          travelUm={travelUm}
          depthUm={on && key ? key.depthUm : 0}
          hot={on && !!key?.pressed}
        />
        <div className="grid3 mt-3.5">
          <Kpi label={t("live.now")} value={key ? mm(key.depthUm) : "–"} unit="mm" mono />
          <Kpi label={t("live.peak")} value={trace.length ? mm(peak) : "–"} unit="mm" mono />
          <Kpi label={t("live.hits")} value={count} unit={t("live.hitsUnit")} />
        </div>
        <Button variant="gh" sm className="mt-2.5" onClick={resetCounters} disabled={!trace.length && !count}>
          {t("live.reset")}
        </Button>
      </Card>
    </div>
  );
}
