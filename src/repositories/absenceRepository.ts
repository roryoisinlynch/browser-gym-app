import type { AbsenceReason, AbsenceRecord } from "../domain/models";
import { STORE_NAMES, getAll, getById, putItem } from "../db/db";

// ─── Records (one per annotated gap, keyed by the gap's first idle day) ──────

export async function getAllAbsenceRecords(): Promise<AbsenceRecord[]> {
  return getAll<AbsenceRecord>(STORE_NAMES.absences);
}

export async function getAbsenceRecord(
  startDate: string
): Promise<AbsenceRecord | undefined> {
  return getById<AbsenceRecord>(STORE_NAMES.absences, startDate);
}

export async function putAbsenceRecord(record: AbsenceRecord): Promise<void> {
  await putItem(STORE_NAMES.absences, record);
}

// ─── User-added reasons ─────────────────────────────────────────────────────

export async function getAllAbsenceReasons(): Promise<AbsenceReason[]> {
  return getAll<AbsenceReason>(STORE_NAMES.absenceReasons);
}

export async function putAbsenceReason(reason: AbsenceReason): Promise<void> {
  await putItem(STORE_NAMES.absenceReasons, reason);
}

// ─── Meta (feature flag) ────────────────────────────────────────────────────

type MetaRecord = { key: string; value: string };

const ENABLED_KEY = "absences_enabled";

/** On unless the user turned it off: a missing flag means on. */
export async function isAbsenceTrackingEnabled(): Promise<boolean> {
  const rec = await getById<MetaRecord>(STORE_NAMES.meta, ENABLED_KEY);
  return rec?.value !== "false";
}

export async function setAbsenceTrackingEnabled(enabled: boolean): Promise<void> {
  await putItem(STORE_NAMES.meta, {
    key: ENABLED_KEY,
    value: enabled ? "true" : "false",
  });
}
