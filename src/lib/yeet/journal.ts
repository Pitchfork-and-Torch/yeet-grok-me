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

function safeJournalNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  // Bool-as-int / non-finite / negative poison HUD and Math.max / +=.
  if (typeof v === "boolean" || !Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function sanitizeDay(raw: unknown): JournalDay | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<JournalDay>;
  const date =
    typeof row.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.date.trim())
      ? row.date.trim()
      : null;
  if (!date) return null;
  return {
    date,
    yeets: safeJournalNum(row.yeets),
    flushes: safeJournalNum(row.flushes),
    challenges: safeJournalNum(row.challenges),
    zen: safeJournalNum(row.zen),
    calmBest: safeJournalNum(row.calmBest),
  };
}

function sanitizeJournal(raw: unknown): JournalDay[] {
  if (!Array.isArray(raw)) return [];
  const out: JournalDay[] = [];
  for (const row of raw) {
    const day = sanitizeDay(row);
    if (day) out.push(day);
  }
  return out.slice(0, 30);
}

export function loadJournal(): JournalDay[] {
  try {
    const raw = localStorage.getItem(JOURNAL_KEY);
    if (!raw) return [];
    return sanitizeJournal(JSON.parse(raw));
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
  const yeets = safeJournalNum(partial.yeets);
  const flushes = safeJournalNum(partial.flushes);
  const challenges = safeJournalNum(partial.challenges);
  const zen = safeJournalNum(partial.zen);
  const calmBest = safeJournalNum(partial.calmBest);
  if (yeets) day.yeets += yeets;
  if (flushes) day.flushes += flushes;
  if (challenges) day.challenges += challenges;
  if (zen) day.zen = Math.max(day.zen, zen);
  if (calmBest) day.calmBest = Math.max(day.calmBest, calmBest);
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
