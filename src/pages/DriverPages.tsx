import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Icon } from "../components/icons";
import { Button, Card, Empty, Kbd, PageBody, PageHeader, Pill, Seg, Switch } from "../components/ui";
import { toHex } from "../hid/protocol";
import { useI18n, type Lang } from "../i18n";
import { MOD } from "../lib/media";
import { useDraft } from "../store/draft";
import { useDriver } from "../store/driver";
import { useUi } from "../store/ui";

export const REPO_URL = "https://github.com/b9rnardo/aula-hero68-webdriver";

const LANGUAGES: { value: Lang; label: string }[] = [
  { value: "pt", label: "Português (Brasil)" },
  { value: "en", label: "English" },
];

export function InterfacePage() {
  const { t, lang } = useI18n();
  const setLang = useDriver((s) => s.setLang);
  const { showValues, setShowValues } = useUi(useShallow((s) => ({ showValues: s.showValues, setShowValues: s.setShowValues })));
  return (
    <PageBody className="narrow">
      <PageHeader title={t("nav.interface")} />
      <div className="stack">
        <Card title={t("ui.language")}>
          <Seg lg label={t("ui.language")} value={lang} onChange={setLang} options={LANGUAGES} />
        </Card>
        <Card title={t("ui.stage")}>
          <div className="check first">
            <span className="flex-1">{t("ui.showValues")}</span>
            <Switch on={showValues} onChange={setShowValues} label={t("ui.showValues")} />
          </div>
        </Card>
      </div>
    </PageBody>
  );
}

const time = (at: number) => new Date(at).toLocaleTimeString(undefined, { hour12: false }) + "." + String(at % 1000).padStart(3, "0");

export function DiagnosticsPage() {
  const { t, number } = useI18n();
  const { packets, clear } = useDriver(useShallow((s) => ({ packets: s.packets, clear: s.clearPackets })));
  const showToast = useDraft((s) => s.showToast);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const text = packets.map((p) => `${time(p.at)} ${p.direction.toUpperCase()} ${toHex(p.bytes)}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast({ tone: "bad", text: t("debug.copyFailed") });
    }
  };

  return (
    <PageBody>
      <PageHeader title={t("nav.diagnostics")}>
        <Button sm onClick={copy} disabled={!packets.length}>
          <Icon name={copied ? "check" : "copy"} size="s" />
          {copied ? t("action.copied") : t("action.copy")}
        </Button>
        <Button variant="gh" sm onClick={clear} disabled={!packets.length}>
          <Icon name="trash" size="s" />
          {t("action.clear")}
        </Button>
      </PageHeader>
      <Card title={t("debug.title")} info={t("debug.info")} aside={<Pill className="tabular-nums">{number(packets.length)}</Pill>}>
        {packets.length === 0 ? (
          <Empty icon="diagnostics" title={t("debug.empty")} />
        ) : (
          <div className="log">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t("debug.time")}</th>
                  <th scope="col">{t("debug.dir")}</th>
                  <th scope="col">{t("debug.bytes")}</th>
                </tr>
              </thead>
              <tbody>
                {packets.map((packet) => (
                  <tr key={packet.id}>
                    <td className="whitespace-nowrap text-muted">{time(packet.at)}</td>
                    <td>
                      <Pill tone={packet.direction === "tx" ? "hot" : "ok"}>{packet.direction.toUpperCase()}</Pill>
                    </td>
                    <td className="break-all text-fg-2">{toHex(packet.bytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageBody>
  );
}

const CONNECT = ["help.connect1", "help.connect2", "help.connect3", "help.connect4"] as const;

export function HelpPage() {
  const { t } = useI18n();
  const shortcuts: [string[], string][] = [
    [[MOD, "K"], t("help.keyPalette")],
    [[MOD, "S"], t("help.keySave")],
    [[MOD, "Z"], t("help.keyUndo")],
    [[MOD, "A"], t("help.keySelectAll")],
    [[t("help.click")], t("help.keyToggle")],
    [["Shift", t("help.click")], t("help.keyRange")],
    [[t("help.drag")], t("help.keyDrag")],
    [[t("help.doubleClick")], t("help.keySame")],
    [["Esc"], t("help.keyEsc")],
  ];
  return (
    <PageBody className="narrow">
      <PageHeader title={t("nav.help")} />
      <div className="stack">
        <Card title={t("help.connectTitle")}>
          <ol className="steps mb-0">
            {CONNECT.map((key, index) => (
              <li key={key}>
                <span className="stn" aria-hidden="true">
                  {index + 1}
                </span>
                <span>{t(key)}</span>
              </li>
            ))}
          </ol>
        </Card>
        <Card title={t("help.shortcuts")}>
          <dl className="dl">
            {shortcuts.map(([keys, label]) => (
              <div key={label} className="contents">
                <dt>{label}</dt>
                <dd className="flex flex-wrap gap-1">
                  {keys.map((key) => (
                    <Kbd key={key}>{key}</Kbd>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card title={t("help.aboutTitle")}>
          <p className="mt-0 mb-3 text-fg-2">{t("help.about")}</p>
          <p className="cap mt-0 mb-4">{t("app.unofficial")}</p>
          <a className="btn sec" href={REPO_URL} target="_blank" rel="noopener noreferrer">
            <Icon name="github" size="s" />
            {t("help.github")}
          </a>
        </Card>
      </div>
    </PageBody>
  );
}
