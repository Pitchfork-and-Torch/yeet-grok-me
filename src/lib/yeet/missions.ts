import { DAILY_KEY } from "./types";

export type MissionId = string;

export type MissionDef = {
  id: MissionId;
  title: string;
  blurb: string;
  metric: "chaos" | "farthest" | "collisions" | "lastYeet" | "airTime" | "bestYeet" | "zen" | "calmStreak" | "flushes";
  target: number;
  unit?: string;
  daily?: boolean;
};

export const MISSIONS: MissionDef[] = [
  {
    id: "chaos50",
    title: "Spark the feed",
    blurb: "Build 50 chaos from impacts and yeets.",
    metric: "chaos",
    target: 50,
  },
  {
    id: "distance40",
    title: "Cross the timeline",
    blurb: "Send anything 40m past the launch pad.",
    metric: "farthest",
    target: 40,
    unit: "m",
  },
  {
    id: "hits15",
    title: "Ratio chain",
    blurb: "Land 15 solid collisions.",
    metric: "collisions",
    target: 15,
  },
  {
    id: "yeet800",
    title: "Maximum YEET",
    blurb: "Pull a slingshot worth 800+ power.",
    metric: "bestYeet",
    target: 800,
  },
  {
    id: "air3",
    title: "Hang time",
    blurb: "Keep a yeeted object airborne 3.0s.",
    metric: "airTime",
    target: 3,
    unit: "s",
  },
  {
    id: "zen80",
    title: "Soft landings",
    blurb: "Reach 80 zen from gentle arcs.",
    metric: "zen",
    target: 80,
  },
  {
    id: "calm5",
    title: "Keep the peace",
    blurb: "Hit a calm streak of 5 soft yeets.",
    metric: "calmStreak",
    target: 5,
  },
  {
    id: "flush1",
    title: "Clear the desk",
    blurb: "Use Flush once to wipe the board.",
    metric: "flushes",
    target: 1,
  },
  {
    id: "chaos150",
    title: "Timeline meltdown",
    blurb: "Stack chaos to 150. Bombs help.",
    metric: "chaos",
    target: 150,
  },
  {
    id: "distance80",
    title: "Orbital yeet",
    blurb: "Reach 80m farthest distance.",
    metric: "farthest",
    target: 80,
    unit: "m",
  },
];

export const DAILY_POOL: MissionDef[] = [
  {
    id: "daily-worry3",
    title: "Daily release",
    blurb: "Yeet 3 worries off your plate today.",
    metric: "flushes",
    target: 1,
    daily: true,
  },
  {
    id: "daily-zen",
    title: "Daily breath",
    blurb: "Earn 40 zen with soft arcs.",
    metric: "zen",
    target: 40,
    daily: true,
  },
  {
    id: "daily-far",
    title: "Daily distance",
    blurb: "Send something 50m today.",
    metric: "farthest",
    target: 50,
    unit: "m",
    daily: true,
  },
  {
    id: "daily-calm",
    title: "Daily calm",
    blurb: "Reach a calm streak of 4.",
    metric: "calmStreak",
    target: 4,
    daily: true,
  },
];

export const MISSION_KEY = "yeet.grok.me.mission.v2";

export type MissionProgress = {
  missionIndex: number;
  completed: number;
  dailyDoneDate?: string;
};

export type ScoreSnapshot = {
  chaos: number;
  farthest: number;
  collisions: number;
  lastYeet: number;
  airTime: number;
  bestYeet: number;
  zen: number;
  calmStreak: number;
  flushes: number;
};

export function loadMissionProgress(): MissionProgress {
  try {
    const raw = localStorage.getItem(MISSION_KEY);
    if (!raw) return { missionIndex: 0, completed: 0 };
    return JSON.parse(raw) as MissionProgress;
  } catch {
    return { missionIndex: 0, completed: 0 };
  }
}

export function saveMissionProgress(p: MissionProgress) {
  try {
    localStorage.setItem(MISSION_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getDailyMission(): MissionDef {
  const key = todayKey();
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { date: string; id: string };
      if (parsed.date === key) {
        const found = DAILY_POOL.find((m) => m.id === parsed.id);
        if (found) return found;
      }
    }
  } catch {
    /* ignore */
  }
  // stable pick from date
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  const mission = DAILY_POOL[hash % DAILY_POOL.length];
  try {
    localStorage.setItem(DAILY_KEY, JSON.stringify({ date: key, id: mission.id }));
  } catch {
    /* ignore */
  }
  return mission;
}

export function isDailyDone(): boolean {
  try {
    const raw = localStorage.getItem(MISSION_KEY);
    if (!raw) return false;
    const p = JSON.parse(raw) as MissionProgress;
    return p.dailyDoneDate === todayKey();
  } catch {
    return false;
  }
}

export function markDailyDone(p: MissionProgress): MissionProgress {
  const next = { ...p, dailyDoneDate: todayKey() };
  saveMissionProgress(next);
  return next;
}

export function metricOf(metric: MissionDef["metric"], score: ScoreSnapshot): number {
  return score[metric] ?? 0;
}

export function missionProgressValue(mission: MissionDef, score: ScoreSnapshot): number {
  return metricOf(mission.metric, score);
}

export function formatProgress(mission: MissionDef, value: number) {
  const v =
    mission.metric === "airTime"
      ? value.toFixed(1)
      : mission.metric === "farthest"
        ? Math.round(value).toString()
        : Math.floor(value).toString();
  const t =
    mission.metric === "airTime" ? mission.target.toFixed(1) : mission.target.toString();
  const unit = mission.unit ? mission.unit : "";
  return `${v}${unit} / ${t}${unit}`;
}
