import type { Localized } from "./keycodes";

const L = (pt: string, en: string): Localized => ({ pt, en });

/** Main backlight effects (config 0x01). Brightness 0–20, speed 0–4. */
export const LIGHT_MODES: Record<number, Localized> = {
  0: L("Desligado", "Off"),
  1: L("Fixo", "Static"),
  2: L("Respiração", "Breathing"),
  3: L("Neon", "Neon"),
  4: L("Explosão", "Burst"),
  5: L("Chuva", "Rain"),
  6: L("Roleta arco-íris", "Rainbow roulette"),
  7: L("Ondas ao toque", "Key ripples"),
  8: L("Estrelado", "Starry"),
  9: L("Rastro na neve", "Snow trail"),
  10: L("Fluxo contínuo", "Continuous flow"),
  11: L("Correnteza", "Drift"),
  12: L("Sombra", "Shadow"),
  13: L("Onda senoidal", "Sine wave"),
  14: L("Varredura", "Scan"),
  15: L("Cata-vento", "Windmill"),
  16: L("Cascata colorida", "Color waterfall"),
  17: L("Florescer", "Blossom"),
  18: L("Tempestade", "Storm"),
  19: L("Personalizado", "Custom"),
};
export const LIGHT_MODE_STATIC = 1;
export const LIGHT_MODE_CUSTOM = 19;
export const LIGHT_MAX_BRIGHTNESS = 20;

/** Side light effects (config 0x06). Brightness and speed 0–4. */
export const SIDE_LIGHT_MODES: Record<number, Localized> = {
  0: L("Desligado", "Off"),
  1: L("Fluxo", "Flow"),
  2: L("Neon", "Neon"),
  3: L("Fixo", "Static"),
  4: L("Respiração", "Breathing"),
  5: L("Corrida", "Racing"),
};
export const SIDE_LIGHT_MAX_BRIGHTNESS = 4;
export const LIGHT_MAX_SPEED = 4;

/** Polling level → Hz. */
export const POLLING_HZ = [1000, 500, 250, 125, 8000, 4000, 2000];

/** Sleep level → minutes. 0 = never; level n ≈ n × 30 s. */
export const sleepMinutes = (level: number) => (level === 0 ? null : level / 2);
