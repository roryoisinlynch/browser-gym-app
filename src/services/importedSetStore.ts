import type { ExerciseSet } from "../domain/models";
import {
  openDatabase,
  transactionDone,
} from "../db/db";

// We store imported sets in a dedicated object store.
// Add this to db.ts — see instructions below.
export const IMPORTED_SETS_STORE = "importedSets" as const;

export interface ImportedSet {
  id: string;
  exerciseName: string;
  weight: number;
  reps: number;
  date: string;
}

export async function saveImportedSets(sets: ImportedSet[]): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(IMPORTED_SETS_STORE, "readwrite");
  const store = tx.objectStore(IMPORTED_SETS_STORE);
  store.clear();
  for (const set of sets) {
    store.put(set);
  }
  await transactionDone(tx);
}

export async function loadImportedSetsForExercise(
  exerciseName: string
): Promise<ExerciseSet[]> {
  const db = await openDatabase();
  const tx = db.transaction(IMPORTED_SETS_STORE, "readonly");
  const all = await new Promise<ImportedSet[]>((resolve, reject) => {
    const req = tx.objectStore(IMPORTED_SETS_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const normalised = exerciseName.trim().toLowerCase();

  return all
    .filter((s) => s.exerciseName.trim().toLowerCase() === normalised)
    .map((s) => ({
      id: s.id,
      exerciseInstanceId: "__imported__",
      setIndex: 0,
      performedWeight: s.weight,
      performedReps: s.reps,
      performedRir: null,
    }));
}

export async function clearImportedSets(): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(IMPORTED_SETS_STORE, "readwrite");
  tx.objectStore(IMPORTED_SETS_STORE).clear();
  await transactionDone(tx);
}

export async function loadAllImportedSets(): Promise<ImportedSet[]> {
  const db = await openDatabase();
  const tx = db.transaction(IMPORTED_SETS_STORE, "readonly");
  return new Promise<ImportedSet[]>((resolve, reject) => {
    const req = tx.objectStore(IMPORTED_SETS_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function updateImportedSet(
  id: string,
  changes: Pick<ImportedSet, "weight" | "reps">
): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(IMPORTED_SETS_STORE, "readwrite");
  const store = tx.objectStore(IMPORTED_SETS_STORE);
  const existing = await new Promise<ImportedSet | undefined>((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (existing) {
    store.put({ ...existing, ...changes });
  }
  await transactionDone(tx);
}

export async function deleteImportedSet(id: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(IMPORTED_SETS_STORE, "readwrite");
  tx.objectStore(IMPORTED_SETS_STORE).delete(id);
  await transactionDone(tx);
}