import { JOURNAL_KEY } from "./types";

export type JournalDay = {
  date: string;
  yeets: number;
  flushes: number;
  challenges: number;
  zen: number;
  calmBest: number;
};

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function loadJournal(): JournalDay[] {
  try {
    const raw = localStorage.getItem(JOURNAL_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as JournalDay[];
  } catch {
    return [];
  }
}

export function bumpJournal(partial: Partial<Omit<JournalDay, "date">>) {
  const days = loadJournal();
  const key = todayKey();
  let day = days.find((d) => d.date === key);
  if (!day) {
    day = { date: key, yeets: 0, flushes: 0, challenges: 0, zen: 0, calmBest: 0 };
    days.unshift(day);
  }
  if (partial.yeets) day.yeets += partial.yeets;
  if (partial.flushes) day.flushes += partial.flushes;
  if (partial.challenges) day.challenges += partial.challenges;
  if (partial.zen) day.zen = Math.max(day.zen, partial.zen);
  if (partial.calmBest) day.calmBest = Math.max(day.calmBest, partial.calmBest);
  // keep 30 days
  const trimmed = days.slice(0, 30);
  try {
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
  return day;
}

export function todayJournal(): JournalDay {
  const key = todayKey();
  return (
    loadJournal().find((d) => d.date === key) ?? {
      date: key,
      yeets: 0,
      flushes: 0,
      challenges: 0,
      zen: 0,
      calmBest: 0,
    }
  );
}
