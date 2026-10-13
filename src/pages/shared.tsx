import type { ReactNode } from "react";
import { switchById } from "../data/switches";
import type { KeyboardSnapshot } from "../hid/snapshot";
import { useI18n } from "../i18n";
import { groupBy } from "../lib/target";
import { navigate, type PageId } from "../navigation";

/** Fallback when the switch type was not read: the longest travel in the catalog. */
const DEFAULT_TRAVEL_UM = 4000;

export function BigValue({ children, unit }: { children: ReactNode; unit?: string }) {
  return (
    <p className="flex items-baseline gap-1.5">
      <span className="text-4xl leading-none font-bold tracking-tight">{children}</span>
      {unit && <span className="text-lg font-semibold text-muted">{unit}</span>}
    </p>
  );
}

export function MoreLink({ to }: { to: PageId }) {
  const { t } = useI18n();
  return (
    <button type="button" onClick={() => navigate(to)} className="mt-auto self-start text-sm font-semibold text-accent hover:text-accent-hover">
      {t("quick.more")} →
    </button>
  );
}

/** Total travel of the most common switch among the keys, or an estimate. */
export function switchTravel(snapshot: KeyboardSnapshot, positions: number[]) {
  const groups = groupBy(positions, (pos) => snapshot.keys[pos]?.switchType).sort((a, b) => b[1].length - a[1].length);
  const sw = groups.length ? switchById.get(groups[0][0]) : undefined;
  return sw ? { travelUm: sw.travelUm, name: sw.name, estimated: false } : { travelUm: DEFAULT_TRAVEL_UM, name: null, estimated: true };
}

/** Actuation point of most of the keys, or undefined when it wasn't read. */
export function commonActuation(snapshot: KeyboardSnapshot, positions: number[]) {
  return groupBy(positions, (pos) => snapshot.keys[pos]?.actuationUm).sort((a, b) => b[1].length - a[1].length)[0]?.[0];
}

/** One value → keys row; clicking selects those keys. */
export function DistributionRow({
  label,
  count,
  total,
  onSelect,
  swatch,
}: {
  label: ReactNode;
  count: number;
  total: number;
  onSelect: () => void;
  swatch?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-hover"
      >
        {swatch}
        <span className="w-24 shrink-0 text-sm font-bold">{label}</span>
        <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-key-line">
          <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${(count / total) * 100}%` }} />
        </span>
        <span className="w-20 shrink-0 text-right text-xs text-muted group-hover:text-fg">
          {count === 1 ? t("target.key") : t("target.keys", { n: count })}
        </span>
      </button>
    </li>
  );
}
