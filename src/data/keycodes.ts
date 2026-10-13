// 32-bit key function values used by the keymap commands: 0xTT MM KK KK
//   TT = type (0x00 keyboard, 0x01 mouse, 0x02 consumer, 0x03 macro, 0x07 system, 0x08 lighting, 0x0d Fn layer)
//   MM = HID modifier bitmask (keyboard type only)
// Table derived from the official driver (docs/dados/hero68-keycodes.json).

export type Localized = { pt: string; en: string };

export type KeyCategory =
  | "letters"
  | "numbers"
  | "symbols"
  | "function"
  | "navigation"
  | "modifiers"
  | "numpad"
  | "media"
  | "apps"
  | "shortcuts"
  | "mouse"
  | "lighting"
  | "special";

export interface KeyFunction {
  value: number;
  /** Short legend for the keycap. */
  label: string;
  /** Longer, translated description when the legend isn't self-explanatory. */
  name?: Localized;
  category: KeyCategory;
}

export const KEY_NONE = 0;
export const KEY_UNKNOWN = 0xffffffff;

export const MODIFIER_BITS: [number, string][] = [
  [0x01, "Ctrl"],
  [0x02, "Shift"],
  [0x04, "Alt"],
  [0x08, "Win"],
  [0x10, "RCtrl"],
  [0x20, "RShift"],
  [0x40, "RAlt"],
  [0x80, "RWin"],
];

const hid = (usage: number) => usage >>> 0;
const consumer = (usage: number) => (0x02000000 | usage) >>> 0;
const withMods = (mods: number, usage: number) => ((mods << 16) | (usage << 8)) >>> 0;
const L = (pt: string, en: string): Localized => ({ pt, en });

const letters: KeyFunction[] = Array.from({ length: 26 }, (_, i) => ({
  value: hid(0x04 + i),
  label: String.fromCharCode(65 + i),
  category: "letters",
}));

const numbers: KeyFunction[] = [..."1234567890"].map((digit, i) => ({
  value: hid(0x1e + i),
  label: digit,
  category: "numbers",
}));

const symbols: KeyFunction[] = (
  [
    [0x2d, "-"],
    [0x2e, "="],
    [0x2f, "["],
    [0x30, "]"],
    [0x31, "\\"],
    [0x33, ";"],
    [0x34, "'"],
    [0x35, "`"],
    [0x36, ","],
    [0x37, "."],
    [0x38, "/"],
  ] as const
).map(([usage, label]) => ({ value: hid(usage), label, category: "symbols" }));

const functionKeys: KeyFunction[] = [
  ...Array.from({ length: 12 }, (_, i) => ({ value: hid(0x3a + i), label: `F${i + 1}`, category: "function" as const })),
  { value: hid(0x29), label: "Esc", category: "function" },
  { value: hid(0x28), label: "Enter", category: "function" },
  { value: hid(0x2a), label: "Backspace", category: "function" },
  { value: hid(0x2b), label: "Tab", category: "function" },
  { value: hid(0x2c), label: "Space", name: L("Espaço", "Space"), category: "function" },
  { value: hid(0x39), label: "Caps", name: L("Caps Lock", "Caps Lock"), category: "function" },
  { value: hid(0x46), label: "PrtSc", name: L("Print Screen", "Print Screen"), category: "function" },
  { value: hid(0x47), label: "ScrLk", name: L("Scroll Lock", "Scroll Lock"), category: "function" },
  { value: hid(0x48), label: "Pause", category: "function" },
  { value: hid(0x65), label: "Menu", name: L("Menu de contexto", "Context menu"), category: "function" },
];

const navigation: KeyFunction[] = (
  [
    [0x49, "Ins"],
    [0x4a, "Home"],
    [0x4b, "PgUp"],
    [0x4c, "Del"],
    [0x4d, "End"],
    [0x4e, "PgDn"],
    [0x4f, "→"],
    [0x50, "←"],
    [0x51, "↓"],
    [0x52, "↑"],
  ] as const
).map(([usage, label]) => ({ value: hid(usage), label, category: "navigation" }));

const modifiers: KeyFunction[] = MODIFIER_BITS.map(([bit, label]) => ({
  value: withMods(bit, 0) >>> 0,
  label,
  category: "modifiers",
}));

const numpad: KeyFunction[] = [
  { value: hid(0x53), label: "NumLk", name: L("Num Lock", "Num Lock"), category: "numpad" },
  { value: hid(0x54), label: "Num /", category: "numpad" },
  { value: hid(0x55), label: "Num *", category: "numpad" },
  { value: hid(0x56), label: "Num -", category: "numpad" },
  { value: hid(0x57), label: "Num +", category: "numpad" },
  { value: hid(0x58), label: "Num Enter", category: "numpad" },
  ...Array.from({ length: 9 }, (_, i) => ({ value: hid(0x59 + i), label: `Num ${i + 1}`, category: "numpad" as const })),
  { value: hid(0x62), label: "Num 0", category: "numpad" },
  { value: hid(0x63), label: "Num .", category: "numpad" },
];

const media: KeyFunction[] = [
  { value: consumer(0xcd), label: "⏯", name: L("Tocar / pausar", "Play / pause"), category: "media" },
  { value: consumer(0xb7), label: "⏹", name: L("Parar", "Stop"), category: "media" },
  { value: consumer(0xb6), label: "⏮", name: L("Faixa anterior", "Previous track"), category: "media" },
  { value: consumer(0xb5), label: "⏭", name: L("Próxima faixa", "Next track"), category: "media" },
  { value: consumer(0xe9), label: "Vol+", name: L("Aumentar volume", "Volume up"), category: "media" },
  { value: consumer(0xea), label: "Vol−", name: L("Diminuir volume", "Volume down"), category: "media" },
  { value: consumer(0xe2), label: "Mute", name: L("Sem som", "Mute"), category: "media" },
  { value: consumer(0x183), label: "Media", name: L("Player de mídia", "Media player"), category: "media" },
  { value: consumer(0x6f), label: "☀+", name: L("Brilho da tela +", "Screen brightness +"), category: "media" },
  { value: consumer(0x70), label: "☀−", name: L("Brilho da tela −", "Screen brightness −"), category: "media" },
];

const apps: KeyFunction[] = [
  { value: consumer(0x223), label: "Web", name: L("Navegador", "Browser"), category: "apps" },
  { value: consumer(0x18a), label: "Mail", name: L("E-mail", "Email"), category: "apps" },
  { value: consumer(0x192), label: "Calc", name: L("Calculadora", "Calculator"), category: "apps" },
  { value: consumer(0x194), label: "PC", name: L("Meu computador", "My computer"), category: "apps" },
  { value: consumer(0x22a), label: "Fav", name: L("Favoritos", "Favorites"), category: "apps" },
];

const shortcut = (mods: number, usage: number, label: string, pt?: string, en?: string): KeyFunction => ({
  value: withMods(mods, usage),
  label,
  name: pt && en ? L(pt, en) : undefined,
  category: "shortcuts",
});

const shortcuts: KeyFunction[] = [
  shortcut(0x01, 0x06, "Ctrl+C", "Copiar", "Copy"),
  shortcut(0x01, 0x19, "Ctrl+V", "Colar", "Paste"),
  shortcut(0x01, 0x1b, "Ctrl+X", "Recortar", "Cut"),
  shortcut(0x01, 0x1d, "Ctrl+Z", "Desfazer", "Undo"),
  shortcut(0x01, 0x1c, "Ctrl+Y", "Refazer", "Redo"),
  shortcut(0x01, 0x04, "Ctrl+A", "Selecionar tudo", "Select all"),
  shortcut(0x01, 0x16, "Ctrl+S", "Salvar", "Save"),
  shortcut(0x01, 0x09, "Ctrl+F", "Buscar", "Find"),
  shortcut(0x01, 0x11, "Ctrl+N", "Novo", "New"),
  shortcut(0x01, 0x12, "Ctrl+O", "Abrir", "Open"),
  shortcut(0x01, 0x17, "Ctrl+T", "Nova aba", "New tab"),
  shortcut(0x01, 0x1a, "Ctrl+W", "Fechar aba", "Close tab"),
  shortcut(0x01, 0x2e, "Ctrl+=", "Mais zoom", "Zoom in"),
  shortcut(0x01, 0x2d, "Ctrl+-", "Menos zoom", "Zoom out"),
  shortcut(0x01, 0x27, "Ctrl+0", "Zoom padrão", "Reset zoom"),
  shortcut(0x04, 0x50, "Alt+←", "Voltar", "Back"),
  shortcut(0x04, 0x4f, "Alt+→", "Avançar", "Forward"),
  shortcut(0x04, 0x2b, "Alt+Tab", "Alternar janelas", "Switch windows"),
  shortcut(0x04, 0x3d, "Alt+F4", "Fechar janela", "Close window"),
  shortcut(0x03, 0x29, "Ctrl+Shift+Esc", "Gerenciador de tarefas", "Task manager"),
  shortcut(0x08, 0x07, "Win+D", "Mostrar área de trabalho", "Show desktop"),
  shortcut(0x08, 0x0f, "Win+L", "Bloquear computador", "Lock computer"),
  shortcut(0x08, 0x08, "Win+E", "Explorador de arquivos", "File explorer"),
  shortcut(0x08, 0x2b, "Win+Tab", "Visão de tarefas", "Task view"),
  shortcut(0x08, 0x0c, "Win+I", "Configurações", "Settings"),
  shortcut(0x08, 0x15, "Win+R", "Executar", "Run"),
  shortcut(0x08, 0x16, "Win+S", "Pesquisar", "Search"),
  shortcut(0x08, 0x0a, "Win+G", "Barra de jogo", "Game bar"),
  shortcut(0x08, 0x37, "Win+.", "Emojis", "Emoji"),
];

const mouse: KeyFunction[] = [
  { value: 0x01010100, label: "M1", name: L("Clique esquerdo", "Left click"), category: "mouse" },
  { value: 0x01020100, label: "M2", name: L("Clique direito", "Right click"), category: "mouse" },
  { value: 0x01030100, label: "M3", name: L("Clique do meio", "Middle click"), category: "mouse" },
  { value: 0x01040100, label: "M4", name: L("Voltar (mouse)", "Back (mouse)"), category: "mouse" },
  { value: 0x01050100, label: "M5", name: L("Avançar (mouse)", "Forward (mouse)"), category: "mouse" },
];

// Factory Fn-layer functions read from a real HERO 68 HE and matched against the user manual.
// They are not in the official driver's table. Lighting: 0x08 PP SS TT — PP 00 effect, 02 color,
// 03 brightness, 04 speed; SS 00 cycle, 01 up, 02 down; TT 00 main light, 01 side light.
const light = (param: number, step: number, target: number) => (0x08000000 | (param << 16) | (step << 8) | target) >>> 0;

const lighting: KeyFunction[] = [
  { value: light(0, 0, 0), label: "FX", name: L("Luz: trocar efeito", "Light: next effect"), category: "lighting" },
  { value: light(2, 0, 0), label: "Hue", name: L("Luz: trocar cor", "Light: next color"), category: "lighting" },
  { value: light(3, 1, 0), label: "☀+", name: L("Luz: mais brilho", "Light: brighter"), category: "lighting" },
  { value: light(3, 2, 0), label: "☀−", name: L("Luz: menos brilho", "Light: dimmer"), category: "lighting" },
  { value: light(4, 1, 0), label: "Spd+", name: L("Luz: mais rápida", "Light: faster"), category: "lighting" },
  { value: light(4, 2, 0), label: "Spd−", name: L("Luz: mais lenta", "Light: slower"), category: "lighting" },
  { value: light(0, 0, 1), label: "S·FX", name: L("Luz lateral: trocar efeito", "Side light: next effect"), category: "lighting" },
  { value: light(2, 0, 1), label: "S·Hue", name: L("Luz lateral: trocar cor", "Side light: next color"), category: "lighting" },
  { value: light(3, 0, 1), label: "S·☀", name: L("Luz lateral: brilho", "Side light: brightness"), category: "lighting" },
  { value: light(4, 0, 1), label: "S·Spd", name: L("Luz lateral: velocidade", "Side light: speed"), category: "lighting" },
  // The manual's label for this one is garbled; "backlight on/off" is the only unmatched entry.
  { value: 0x0700000b, label: "LED", name: L("Liga/desliga a luz (provável)", "Backlight on/off (likely)"), category: "lighting" },
];

const special: KeyFunction[] = [
  { value: 0x0d000000, label: "Fn", name: L("Camada Fn", "Fn layer"), category: "special" },
  { value: 0x0d010000, label: "Fn2", name: L("Camada Fn2", "Fn2 layer"), category: "special" },
  { value: 0x0700000e, label: "Win", name: L("Modo Windows", "Windows mode"), category: "special" },
  { value: 0x0700000f, label: "Mac", name: L("Modo Mac", "Mac mode"), category: "special" },
  { value: 0x07000001, label: "WinL", name: L("Trava da tecla Win", "Win key lock"), category: "special" },
  { value: 0x07000004, label: "Reset", name: L("Restaurar padrão de fábrica (segurar 5 s)", "Factory reset (hold 5 s)"), category: "special" },
  { value: KEY_NONE, label: "—", name: L("Desativada", "Disabled"), category: "special" },
];

export const KEY_FUNCTIONS: KeyFunction[] = [
  ...letters,
  ...numbers,
  ...symbols,
  ...functionKeys,
  ...navigation,
  ...modifiers,
  ...numpad,
  ...media,
  ...apps,
  ...shortcuts,
  ...mouse,
  ...lighting,
  ...special,
];

const byValue = new Map(KEY_FUNCTIONS.map((fn) => [fn.value, fn]));

export interface MacroBinding {
  mode: number;
  repeat: number;
  index: number;
}

export type DescribedKey =
  | { kind: "known"; fn: KeyFunction }
  | { kind: "combo"; label: string }
  | { kind: "macro"; macro: MacroBinding; label: string }
  | { kind: "unknown"; label: string };

export function describeKey(value: number): DescribedKey {
  const known = byValue.get(value >>> 0);
  if (known) return { kind: "known", fn: known };
  const type = value >>> 24;
  if (type === 0x03) {
    const macro = { mode: (value >>> 16) & 0xff, repeat: (value >>> 8) & 0xff, index: value & 0xff };
    return { kind: "macro", macro, label: `M${macro.index + 1}` };
  }
  if (type === 0x00) {
    const mods = (value >>> 16) & 0xff;
    const usage = (value >>> 8) & 0xff || value & 0xff;
    const parts = MODIFIER_BITS.filter(([bit]) => mods & bit).map(([, label]) => label);
    const key = byValue.get(usage);
    if (key) return { kind: "combo", label: [...parts, key.label].join("+") };
  }
  if (value >>> 0 === KEY_UNKNOWN) return { kind: "unknown", label: "??" };
  return { kind: "unknown", label: `0x${(value >>> 0).toString(16).padStart(8, "0")}` };
}

export function keyLegend(value: number): string {
  const described = describeKey(value);
  return described.kind === "known" ? described.fn.label : described.label;
}
