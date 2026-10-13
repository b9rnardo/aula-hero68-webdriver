import { useState } from "react";
import { Page } from "../components/KeyboardStage";
import { Badge, Button, Card, cx, Empty } from "../components/ui";
import { toHex } from "../hid/protocol";
import { useI18n, type Lang } from "../i18n";
import { useDriver } from "../store/driver";

const LANGUAGES: { id: Lang; name: string }[] = [
  { id: "pt", name: "Português (Brasil)" },
  { id: "en", name: "English" },
];

export function InterfacePage() {
  const { t, lang } = useI18n();
  const setLang = useDriver((s) => s.setLang);
  return (
    <div className="mx-auto max-w-3xl">
      <Page title={t("interface.title")}>
        <Card title={t("interface.language")} description={t("interface.languageDesc")}>
          <div role="radiogroup" aria-label={t("interface.language")} className="grid gap-1.5 sm:grid-cols-2">
            {LANGUAGES.map(({ id, name }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={lang === id}
                onClick={() => setLang(id)}
                className={cx(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors",
                  lang === id ? "bg-active font-semibold text-fg" : "bg-hover text-muted hover:text-fg",
                )}
              >
                <span className={cx("grid size-4 shrink-0 place-items-center rounded-full", lang === id ? "bg-accent" : "border border-key-line")}>
                  {lang === id && <span className="size-1.5 rounded-full bg-accent-ink" />}
                </span>
                {name}
              </button>
            ))}
          </div>
        </Card>
      </Page>
    </div>
  );
}

const time = (at: number) =>
  new Date(at).toLocaleTimeString(undefined, { hour12: false }) + "." + String(at % 1000).padStart(3, "0");

export function DiagnosticsPage() {
  const { t } = useI18n();
  const packets = useDriver((s) => s.packets);
  const clear = useDriver((s) => s.clearPackets);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const text = packets.map((p) => `${time(p.at)} ${p.direction.toUpperCase()} ${toHex(p.bytes)}`).join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Page
      title={t("debug.title")}
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={copy} disabled={!packets.length}>
            {copied ? t("action.copied") : t("action.copy")}
          </Button>
          <Button variant="ghost" size="sm" onClick={clear} disabled={!packets.length}>
            {t("action.clear")}
          </Button>
        </>
      }
    >
      <Card description={t("debug.lead")}>
        {packets.length === 0 ? (
          <Empty>{t("debug.empty")}</Empty>
        ) : (
          <div className="max-h-[65vh] overflow-auto rounded-md bg-app">
            <table className="w-full text-left font-mono text-xs">
              <thead className="sticky top-0 bg-field text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">{t("debug.time")}</th>
                  <th className="px-3 py-2 font-semibold">{t("debug.dir")}</th>
                  <th className="px-3 py-2 font-semibold">{t("debug.bytes")}</th>
                </tr>
              </thead>
              <tbody>
                {packets.map((packet) => (
                  <tr key={packet.id} className="border-t border-line align-top">
                    <td className="px-3 py-1.5 whitespace-nowrap text-subtle">{time(packet.at)}</td>
                    <td className="px-3 py-1.5">
                      <Badge tone={packet.direction === "tx" ? "accent" : "ok"}>{packet.direction.toUpperCase()}</Badge>
                    </td>
                    <td className="px-3 py-1.5 break-all text-fg-2">{toHex(packet.bytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Page>
  );
}

export function HelpPage() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-3xl">
      <Page title={t("help.title")}>
        <div className="space-y-4">
          <Card title={t("help.connectTitle")}>
            <ol className="space-y-3">
              {(["help.connect1", "help.connect2", "help.connect3", "help.connect4"] as const).map((key, index) => (
                <li key={key} className="flex gap-3 text-sm leading-relaxed text-fg-2">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-active text-xs font-bold text-accent">{index + 1}</span>
                  {t(key)}
                </li>
              ))}
            </ol>
          </Card>
          <Card title={t("help.aboutTitle")}>
            <p className="text-sm leading-relaxed text-fg-2">{t("help.about")}</p>
            <p className="mt-3 text-xs text-subtle">{t("app.unofficial")}</p>
          </Card>
        </div>
      </Page>
    </div>
  );
}
