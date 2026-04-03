import type { CsvImportRow } from "./csvParser";

const STORAGE_KEY = "imported_sets_v1";

export interface StoredImportedSet {
  id: string;           // synthetic ID, e.g. "imp-1234"
  exerciseName: string; // matched case-insensitively against ExerciseTemplate.exerciseName
  weight: number;
  reps: number;
  date: string;
}

export function saveImportedSets(rows: CsvImportRow[]): void {
  const sets: StoredImportedSet[] = rows.map((row, i) => ({
    id: `imp-${Date.now()}-${i}`,
    exerciseName: row.exerciseName,
    weight: row.weight,
    reps: row.reps,
    date: row.date,
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sets));
}

export function loadImportedSets(): StoredImportedSet[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as StoredImportedSet[];
  } catch {
    return [];
  }
}

export function clearImportedSets(): void {
  localStorage.removeItem(STORAGE_KEY);
}