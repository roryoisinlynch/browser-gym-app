import type { ExerciseSet } from "../domain/models";
import { loadImportedSetsForExercise } from "./importedSetStore";

/**
 * Merges real ExerciseSet records with any imported CSV sets for the
 * same exercise name. Used as the allHistoricalSets input to both
 * historicalBestEstimatedOneRepMax and buildAnalyzedSetList inside
 * getExerciseInstanceView and getSessionInstanceView.
 *
 * Imported sets carry exerciseInstanceId "__imported__" — they are
 * never written to the real exerciseSets store and have no effect on
 * volume, consistency, or session structure.
 */
export async function mergeWithImportedSets(
  exerciseName: string,
  realSets: ExerciseSet[]
): Promise<ExerciseSet[]> {
  const importedSets = await loadImportedSetsForExercise(exerciseName);
  return [...realSets, ...importedSets];
}