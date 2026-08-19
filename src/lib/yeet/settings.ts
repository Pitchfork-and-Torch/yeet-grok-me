import {
  SETTINGS_KEY,
  type PlayMode,
  type ThemeId,
} from "./types";

export type AppSettings = {
  mode: PlayMode;
  theme: ThemeId;
  asmr: boolean;
  ambient: boolean;
  volume: number;
  muted: boolean;
  compactHud: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  showChallenges: boolean;
  haptics: boolean;
  sessionMinutes: 0 | 2 | 5;
  stampText: string;
  keyboardHints: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  mode: "soft",
  theme: "void",
  asmr: true,
  ambient: true,
  volume: 0.65,
  muted: false,
  compactHud: false,
  highContrast: false,
  reducedMotion: false,
  showChallenges: true,
  haptics: true,
  sessionMinutes: 0,
  stampText: "YEET",
  keyboardHints: true,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: AppSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function modePreset(mode: PlayMode) {
  switch (mode) {
    case "soft":
      return { gravity: 0.55, bounce: 0.95, power: 0.85, timeScale: 0.85 };
    case "zen":
      return { gravity: 0.45, bounce: 1.05, power: 0.7, timeScale: 0.75 };
    case "freeplay":
      return { gravity: 1, bounce: 0.7, power: 1, timeScale: 1 };
    case "chaos":
    default:
      return { gravity: 1.05, bounce: 0.65, power: 1.15, timeScale: 1 };
  }
}
