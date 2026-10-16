// Absences: runs of idle days between training, derived from the activity
// dates every time they are needed. Only the user's annotations (reason,
// prompted flag) are stored, keyed by the gap's first idle day.

import type { AbsenceRecord, SessionInstance } from "../domain/models";
import { STORE_NAMES, getAll } from "../db/db";
import { sessionCompletedDate } from "../repositories/programRepository";
import {
  getAbsenceRecord,
  getAllAbsenceReasons,
  getAllAbsenceRecords,
  putAbsenceReason,
  putAbsenceRecord,
} from "../repositories/absenceRepository";
import { loadAllImportedSets } from "./importedSetStore";
import { isDateKey, isoFromDayNumber, utcDayNumber } from "./dateKeys";

/** Idle days in a row before a gap counts as an absence. */
export const ABSENCE_MIN_DAYS = 7;

export const BUILT_IN_ABSENCE_REASONS = [
  "Sickness",
  "Injury",
  "Work",
  "Trained off-app",
  "Holiday",
] as const;

/** Reason the absences screen can apply to every uncategorized absence at once. */
export const UNKNOWN_ABSENCE_REASON = "Unknown";

/** A run of idle days bounded by training on both sides. Derived, never stored. */
export interface AbsenceSpan {
  /** First idle day, the day after `lastActiveOn`. Doubles as the record key. */
  startDate: string;
  /** Last idle day, the day before `endedOn`. */
  endDate: string;
  dayCount: number;
  lastActiveOn: string;
  endedOn: string;
}

export interface Absence extends AbsenceSpan {
  id: string;
  reason: string | null;
  promptedAt: string | null;
}

// ─── Gap detection ──────────────────────────────────────────────────────────

/**
 * Gaps of ABSENCE_MIN_DAYS or more idle days between consecutive active dates,
 * ascending. Nothing before the first date or after the last ever counts, so
 * pre-history and an open-ended gap running up to today are never absences.
 */
export function computeAbsences(activeDates: Iterable<string>): AbsenceSpan[] {
  const days = [...new Set(activeDates)]
    .filter(isDateKey)
    .map(utcDayNumber)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const spans: AbsenceSpan[] = [];
  for (let i = 1; i < days.length; i++) {
    // Whole days strictly between two active days.
    const idle = days[i] - days[i - 1] - 1;
    if (idle < ABSENCE_MIN_DAYS) continue;
    spans.push({
      startDate: isoFromDayNumber(days[i - 1] + 1),
      endDate: isoFromDayNumber(days[i] - 1),
      dayCount: idle,
      lastActiveOn: isoFromDayNumber(days[i - 1]),
      endedOn: isoFromDayNumber(days[i]),
    });
  }
  return spans;
}

/**
 * Every local date with training: completed sessions plus imported sets with
 * reps. The same rule the Year in Review streaks use; skipped sessions never
 * count.
 */
export async function getAllActiveDates(): Promise<Set<string>> {
  const [sessions, imported] = await Promise.all([
    getAll<SessionInstance>(STORE_NAMES.sessionInstances),
    loadAllImportedSets(),
  ]);
  const dates = new Set<string>();
  for (const s of sessions) {
    if (s.status === "completed") dates.add(sessionCompletedDate(s));
  }
  for (const r of imported) {
    if (r.reps > 0) dates.add(r.date);
  }
  return dates;
}

/** All absences with their annotations, newest first. */
export async function loadAbsences(): Promise<Absence[]> {
  const [dates, records] = await Promise.all([
    getAllActiveDates(),
    getAllAbsenceRecords(),
  ]);
  // A record whose key no longer matches a span (the gaps changed under it)
  // is simply never joined.
  const byStart = new Map(records.map((r) => [r.id, r]));
  return computeAbsences(dates)
    .map((span): Absence => {
      const rec = byStart.get(span.startDate);
      return {
        ...span,
        id: span.startDate,
        reason: rec?.reason ?? null,
        promptedAt: rec?.promptedAt ?? null,
      };
    })
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

/** The absence this session closed, if it closed one. */
export async function findAbsenceEndedBy(
  session: SessionInstance
): Promise<Absence | null> {
  if (session.status !== "completed") return null;
  const endedOn = sessionCompletedDate(session);
  const all = await loadAbsences();
  return all.find((a) => a.endedOn === endedOn) ?? null;
}

// ─── Annotations ────────────────────────────────────────────────────────────

async function upsertRecord(
  span: AbsenceSpan,
  patch: Partial<Pick<AbsenceRecord, "reason" | "promptedAt">>
): Promise<void> {
  const existing = await getAbsenceRecord(span.startDate);
  await putAbsenceRecord({
    id: span.startDate,
    startDate: span.startDate,
    endDate: span.endDate,
    reason: existing?.reason ?? null,
    promptedAt: existing?.promptedAt ?? null,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}

export async function setAbsenceReason(
  span: AbsenceSpan,
  reason: string | null
): Promise<void> {
  await upsertRecord(span, { reason });
}

export async function markAbsencePrompted(span: AbsenceSpan): Promise<void> {
  await upsertRecord(span, { promptedAt: new Date().toISOString() });
}

// ─── Reasons ────────────────────────────────────────────────────────────────

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

/** Built-in reasons first, then the user's own in the order they were added. */
export async function listAbsenceReasons(): Promise<string[]> {
  const custom = (await getAllAbsenceReasons()).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  );
  const out: string[] = [...BUILT_IN_ABSENCE_REASONS];
  const seen = new Set(out.map(normalizeLabel));
  for (const r of custom) {
    const key = normalizeLabel(r.label);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r.label);
  }
  return out;
}

/**
 * Stores a new reason and returns its label. A label matching an existing
 * reason case-insensitively returns that reason instead of a duplicate.
 */
export async function addAbsenceReason(label: string): Promise<string> {
  const trimmed = label.trim();
  const existing = (await listAbsenceReasons()).find(
    (r) => normalizeLabel(r) === normalizeLabel(trimmed)
  );
  if (existing) return existing;
  await putAbsenceReason({
    id: crypto.randomUUID(),
    label: trimmed,
    createdAt: new Date().toISOString(),
  });
  return trimmed;
}

// ─── Display ────────────────────────────────────────────────────────────────

/** Parse a date key by components: new Date("YYYY-MM-DD") would be UTC midnight. */
function dateFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "2 Mar to 22 Mar 2026", with the year on both ends when they differ. */
export function formatAbsenceRange(startDate: string, endDate: string): string {
  const start = dateFromKey(startDate);
  const end = dateFromKey(endDate);
  const dayMonth: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const withYear: Intl.DateTimeFormatOptions = { ...dayMonth, year: "numeric" };
  const sameYear = start.getFullYear() === end.getFullYear();
  return `${start.toLocaleDateString("en-GB", sameYear ? dayMonth : withYear)} to ${end.toLocaleDateString("en-GB", withYear)}`;
}
