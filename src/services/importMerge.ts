import type { ExerciseSet } from "../domain/models";
import { loadImportedSets } from "./importedSetStore";

/**
 * Merges real ExerciseSet records with imported CSV sets for a given
 * exercise name, sorted oldest-first so priorSets ordering is correct.
 *
 * Imported sets have no real exerciseInstanceId — we use a synthetic
 * placeholder so the shape matches. They are ONLY used as prior context
 * for e1RM calculations, never for volume or consistency.
 */
export function getMergedPriorSets(
  exerciseName: string,
  realPriorSets: ExerciseSet[]
): ExerciseSet[] {
  const imported = loadImportedSets();

  const normalised = exerciseName.trim().toLowerCase();

  const importedAsExerciseSets: ExerciseSet[] = imported
    .filter((s) => s.exerciseName.trim().toLowerCase() === normalised)
    .map((s) => ({
      id: s.id,
      exerciseInstanceId: "__imported__",  // sentinel — never queried
      setIndex: 0,
      performedWeight: s.weight,
      performedReps: s.reps,
      performedRir: null,
    }));

  const merged = [...realPriorSets, ...importedAsExerciseSets];

  // Sort oldest-first by date where available; imported sets carry a date,
  // real sets don't — real sets stay in their natural DB order at the front.
  return merged;
}