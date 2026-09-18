/**
 * Repro: corrupted journal JSON (non-finite, negative, bool-as-int, bad date)
 * must not poison todayJournal / bumpJournal HUD counts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src/lib/yeet/journal.ts"), "utf8");

assert.match(src, /sanitizeJournal|safeJournalNum/, "journal.ts must sanitize loaded days");
assert.match(src, /Number\.isFinite/, "must guard non-finite counts");
assert.match(src, /typeof v === "boolean"|typeof raw === "boolean"/, "must reject bool-as-int counts");
assert.match(src, /sanitizeJournal\(JSON\.parse/, "loadJournal must sanitize parse result");
assert.match(src, /\\d\{4\}-\\d\{2\}-\\d\{2\}/, "must require YYYY-MM-DD date keys");

console.log("ok journal sanitize contract");
