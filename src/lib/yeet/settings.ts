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

const PLAY_MODES: PlayMode[] = ["chaos", "soft", "zen", "freeplay"];
const THEME_IDS: ThemeId[] = ["void", "rain", "office", "meme", "space"];
const SESSION_MINUTES: AppSettings["sessionMinutes"][] = [0, 2, 5];

function sanitizeSettings(raw: Partial<AppSettings> | null | undefined): AppSettings {
  const base = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== "object") return base;
  const mode = PLAY_MODES.includes(raw.mode as PlayMode) ? (raw.mode as PlayMode) : base.mode;
  const theme = THEME_IDS.includes(raw.theme as ThemeId) ? (raw.theme as ThemeId) : base.theme;
  const vol = Number(raw.volume);
  const volume = Number.isFinite(vol) ? Math.min(1, Math.max(0, vol)) : base.volume;
  const sm = Number(raw.sessionMinutes);
  // Invalid / non-allowlisted sessionMinutes made Date.now()+minutes*60e3 → NaN and broke the timer.
  const sessionMinutes = SESSION_MINUTES.includes(sm as AppSettings["sessionMinutes"])
    ? (sm as AppSettings["sessionMinutes"])
    : base.sessionMinutes;
  const stamp =
    typeof raw.stampText === "string" && raw.stampText.trim()
      ? raw.stampText.trim().slice(0, 8)
      : base.stampText;
  return {
    ...base,
    ...raw,
    mode,
    theme,
    volume,
    sessionMinutes,
    stampText: stamp,
    asmr: Boolean(raw.asmr ?? base.asmr),
    ambient: Boolean(raw.ambient ?? base.ambient),
    muted: Boolean(raw.muted ?? base.muted),
    compactHud: Boolean(raw.compactHud ?? base.compactHud),
    highContrast: Boolean(raw.highContrast ?? base.highContrast),
    reducedMotion: Boolean(raw.reducedMotion ?? base.reducedMotion),
    showChallenges: Boolean(raw.showChallenges ?? base.showChallenges),
    haptics: Boolean(raw.haptics ?? base.haptics),
    keyboardHints: Boolean(raw.keyboardHints ?? base.keyboardHints),
  };
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return sanitizeSettings(JSON.parse(raw) as Partial<AppSettings>);
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
