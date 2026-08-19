export type ObjectKind =
  | "meme"
  | "ratio"
  | "check"
  | "like"
  | "bomb"
  | "orb"
  | "brick"
  | "slime"
  | "bubble"
  | "pillow"
  | "glass"
  | "worry"
  | "stamp";

export type ShapeKind = "circle" | "rect" | "hex" | "soft";

export type ObjectDef = {
  id: ObjectKind;
  label: string;
  glyph: string;
  color: string;
  rim: string;
  radius: number;
  density: number;
  restitution: number;
  friction: number;
  shape: ShapeKind;
  /** Calm objects help zen / soft streak */
  calm?: boolean;
  fragile?: boolean;
  sticky?: boolean;
  explosive?: boolean;
};

export type ScoreState = {
  farthest: number;
  airTime: number;
  collisions: number;
  chaos: number;
  lastYeet: number;
  bestYeet: number;
  zen: number;
  calmStreak: number;
  bestCalmStreak: number;
  yeetsToday: number;
  flushes: number;
};

export type HighScore = {
  bestYeet: number;
  farthest: number;
  chaos: number;
  zen: number;
  bestCalmStreak: number;
  updatedAt: number;
};

export type PlayMode = "chaos" | "soft" | "zen" | "freeplay";

export type ThemeId = "void" | "rain" | "office" | "meme" | "space";

export type Theme = {
  id: ThemeId;
  label: string;
  bg0: string;
  bg1: string;
  accent: string;
  grid: string;
  platform: string;
  platformEdge: string;
};

export const THEMES: Theme[] = [
  {
    id: "void",
    label: "Void",
    bg0: "#0a0c10",
    bg1: "#07080a",
    accent: "#5eead4",
    grid: "rgba(94,234,212,0.04)",
    platform: "#1c212b",
    platformEdge: "rgba(94,234,212,0.25)",
  },
  {
    id: "rain",
    label: "Rain",
    bg0: "#0c1218",
    bg1: "#080c10",
    accent: "#7dd3fc",
    grid: "rgba(125,211,252,0.05)",
    platform: "#15202b",
    platformEdge: "rgba(125,211,252,0.3)",
  },
  {
    id: "office",
    label: "Office",
    bg0: "#12141a",
    bg1: "#0c0d11",
    accent: "#a8b0bc",
    grid: "rgba(168,176,188,0.05)",
    platform: "#1e222b",
    platformEdge: "rgba(200,204,212,0.25)",
  },
  {
    id: "meme",
    label: "Meme",
    bg0: "#101018",
    bg1: "#0a0a0f",
    accent: "#fbbf24",
    grid: "rgba(251,191,36,0.05)",
    platform: "#1a1a24",
    platformEdge: "rgba(251,191,36,0.28)",
  },
  {
    id: "space",
    label: "Space",
    bg0: "#08081a",
    bg1: "#04040c",
    accent: "#c4b5fd",
    grid: "rgba(196,181,253,0.05)",
    platform: "#14122a",
    platformEdge: "rgba(196,181,253,0.3)",
  },
];

export const WORRY_LABELS = [
  "email",
  "meeting",
  "scroll",
  "inbox",
  "deadline",
  "slack",
  "news",
  "rent",
  "tabs",
  "fomo",
  "alarm",
  "reply",
];

export const OBJECT_DEFS: ObjectDef[] = [
  {
    id: "meme",
    label: "Meme",
    glyph: "M",
    color: "#f59e0b",
    rim: "#fde68a",
    radius: 28,
    density: 0.0012,
    restitution: 0.72,
    friction: 0.08,
    shape: "circle",
  },
  {
    id: "ratio",
    label: "Ratio",
    glyph: "R",
    color: "#f43f5e",
    rim: "#fda4af",
    radius: 26,
    density: 0.0014,
    restitution: 0.65,
    friction: 0.1,
    shape: "hex",
  },
  {
    id: "check",
    label: "Check",
    glyph: "✓",
    color: "#38bdf8",
    rim: "#bae6fd",
    radius: 24,
    density: 0.001,
    restitution: 0.8,
    friction: 0.06,
    shape: "circle",
  },
  {
    id: "like",
    label: "Like",
    glyph: "♥",
    color: "#fb7185",
    rim: "#fecdd3",
    radius: 22,
    density: 0.0009,
    restitution: 0.85,
    friction: 0.05,
    shape: "circle",
    calm: true,
  },
  {
    id: "bomb",
    label: "Bomb",
    glyph: "!",
    color: "#a3e635",
    rim: "#d9f99d",
    radius: 30,
    density: 0.0018,
    restitution: 0.45,
    friction: 0.15,
    shape: "circle",
    explosive: true,
  },
  {
    id: "orb",
    label: "Orb",
    glyph: "O",
    color: "#5eead4",
    rim: "#99f6e4",
    radius: 20,
    density: 0.0008,
    restitution: 0.9,
    friction: 0.04,
    shape: "circle",
    calm: true,
  },
  {
    id: "brick",
    label: "Brick",
    glyph: "B",
    color: "#94a3b8",
    rim: "#cbd5e1",
    radius: 32,
    density: 0.0022,
    restitution: 0.35,
    friction: 0.25,
    shape: "rect",
  },
  {
    id: "slime",
    label: "Slime",
    glyph: "S",
    color: "#4ade80",
    rim: "#bbf7d0",
    radius: 30,
    density: 0.0016,
    restitution: 0.15,
    friction: 0.9,
    shape: "soft",
    sticky: true,
    calm: true,
  },
  {
    id: "bubble",
    label: "Bubble",
    glyph: "o",
    color: "#67e8f9",
    rim: "#a5f3fc",
    radius: 26,
    density: 0.0004,
    restitution: 0.95,
    friction: 0.02,
    shape: "circle",
    fragile: true,
    calm: true,
  },
  {
    id: "pillow",
    label: "Pillow",
    glyph: "P",
    color: "#e2e8f0",
    rim: "#f8fafc",
    radius: 34,
    density: 0.0007,
    restitution: 0.25,
    friction: 0.4,
    shape: "soft",
    calm: true,
  },
  {
    id: "glass",
    label: "Glass",
    glyph: "G",
    color: "#94a3b8",
    rim: "#e2e8f0",
    radius: 24,
    density: 0.0015,
    restitution: 0.55,
    friction: 0.05,
    shape: "hex",
    fragile: true,
  },
  {
    id: "worry",
    label: "Worry",
    glyph: "W",
    color: "#64748b",
    rim: "#94a3b8",
    radius: 28,
    density: 0.0011,
    restitution: 0.5,
    friction: 0.12,
    shape: "rect",
  },
  {
    id: "stamp",
    label: "Stamp",
    glyph: "T",
    color: "#c4b5fd",
    rim: "#ddd6fe",
    radius: 26,
    density: 0.001,
    restitution: 0.7,
    friction: 0.1,
    shape: "circle",
  },
];

export const HS_KEY = "yeet.grok.me.highscore.v2";
export const SETTINGS_KEY = "yeet.grok.me.settings.v1";
export const JOURNAL_KEY = "yeet.grok.me.journal.v1";
export const SNAPSHOT_KEY = "yeet.grok.me.snapshot.v1";
export const DAILY_KEY = "yeet.grok.me.daily.v1";
