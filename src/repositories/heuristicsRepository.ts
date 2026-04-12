import type { HeuristicQuestion, HeuristicEntry } from "../domain/models";
import {
  STORE_NAMES,
  getAll,
  getById,
  getAllByIndex,
  putItem,
  bulkPutItems,
  deleteItem,
} from "../db/db";

// ─── Questions ───────────────────────────────────────────────────────────────

export async function getQuestions(): Promise<HeuristicQuestion[]> {
  const all = await getAll<HeuristicQuestion>(STORE_NAMES.heuristicQuestions);
  return all.sort((a, b) => a.order - b.order);
}

export async function putQuestion(q: HeuristicQuestion): Promise<void> {
  await putItem(STORE_NAMES.heuristicQuestions, q);
}

export async function deleteQuestion(id: string): Promise<void> {
  await deleteItem(STORE_NAMES.heuristicQuestions, id);
}

// ─── Entries ─────────────────────────────────────────────────────────────────

export async function getEntriesForDate(
  date: string
): Promise<HeuristicEntry[]> {
  return getAllByIndex<HeuristicEntry>(
    STORE_NAMES.heuristicEntries,
    "byDate",
    date
  );
}

export async function getEntriesForDateRange(
  startDate: string,
  endDate: string
): Promise<HeuristicEntry[]> {
  return getAllByIndex<HeuristicEntry>(
    STORE_NAMES.heuristicEntries,
    "byDate",
    IDBKeyRange.bound(startDate, endDate)
  );
}

export async function putEntry(entry: HeuristicEntry): Promise<void> {
  await putItem(STORE_NAMES.heuristicEntries, entry);
}

export async function bulkPutEntries(
  entries: HeuristicEntry[]
): Promise<void> {
  await bulkPutItems(STORE_NAMES.heuristicEntries, entries);
}

// ─── Pending dates ───────────────────────────────────────────────────────────

function localDateIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return localDateIso(d);
}

/**
 * Returns dates within the last `lookbackDays` (including today) that have
 * fewer entries than the number of active questions.
 */
export async function getPendingHeuristicDates(
  lookbackDays = 3
): Promise<string[]> {
  const questions = await getQuestions();
  if (questions.length === 0) return [];

  const today = localDateIso();
  const startDate = addDays(today, -(lookbackDays - 1));

  const entries = await getEntriesForDateRange(startDate, today);

  // Count entries per date (only for current question IDs)
  const questionIds = new Set(questions.map((q) => q.id));
  const countByDate = new Map<string, number>();
  for (const e of entries) {
    if (questionIds.has(e.questionId)) {
      countByDate.set(e.date, (countByDate.get(e.date) ?? 0) + 1);
    }
  }

  // Collect dates where count < total questions
  const pending: string[] = [];
  for (let i = 0; i < lookbackDays; i++) {
    const date = addDays(startDate, i);
    if ((countByDate.get(date) ?? 0) < questions.length) {
      pending.push(date);
    }
  }
  return pending;
}

// ─── Meta (feature flag + prompt state) ──────────────────────────────────────

type MetaRecord = { key: string; value: string };

export async function isHeuristicsEnabled(): Promise<boolean> {
  const rec = await getById<MetaRecord>(STORE_NAMES.meta, "heuristics_enabled");
  return rec?.value === "true";
}

export async function setHeuristicsEnabled(enabled: boolean): Promise<void> {
  await putItem(STORE_NAMES.meta, {
    key: "heuristics_enabled",
    value: enabled ? "true" : "false",
  });
}

export async function getHeuristicsPromptResponse(): Promise<
  string | undefined
> {
  const rec = await getById<MetaRecord>(
    STORE_NAMES.meta,
    "heuristics_prompt_response"
  );
  return rec?.value;
}

export async function setHeuristicsPromptResponse(
  value: "yes" | "no" | "later"
): Promise<void> {
  await putItem(STORE_NAMES.meta, {
    key: "heuristics_prompt_response",
    value,
  });
}

// ─── Seed defaults ───────────────────────────────────────────────────────────

const DEFAULT_QUESTIONS = [
  "Sleep",
  "Hydration",
  "Creatine",
  "Protein",
];

export async function seedDefaultQuestions(): Promise<void> {
  const existing = await getAll<HeuristicQuestion>(
    STORE_NAMES.heuristicQuestions
  );
  if (existing.length > 0) return;

  const questions: HeuristicQuestion[] = DEFAULT_QUESTIONS.map(
    (label, i) => ({
      id: crypto.randomUUID(),
      label,
      order: i + 1,
    })
  );
  await bulkPutItems(STORE_NAMES.heuristicQuestions, questions);
}
