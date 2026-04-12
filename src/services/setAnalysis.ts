import type { ExerciseSet } from "../domain/models";

export type SetType = "warmup" | "working";

export interface SetAnalysis {
  estimatedOneRepMax: number | null;
  priorBestEstimatedOneRepMax: number | null;
  intensity: number | null;
  setType: SetType;
}

const WORKING_SET_INTENSITY_THRESHOLD = 0.6;

/**
 * Epley formula.
 *
 * estimated 1RM = weight * (1 + reps / 30)
 */
export function calculateEstimatedOneRepMax(
  weight: number | null | undefined,
  reps: number | null | undefined
): number | null {
  if (weight == null || reps == null) {
    return null;
  }

  if (weight <= 0 || reps <= 0) {
    return null;
  }

  return weight * (1 + reps / 30);
}

/**
 * Intensity is the ratio between the current set's estimated 1RM
 * and the best prior estimated 1RM for the same exercise.
 */
export function calculateIntensity(
  estimatedOneRepMax: number | null,
  priorBestEstimatedOneRepMax: number | null
): number | null {
  if (
    estimatedOneRepMax == null ||
    priorBestEstimatedOneRepMax == null ||
    priorBestEstimatedOneRepMax <= 0
  ) {
    return null;
  }

  return estimatedOneRepMax / priorBestEstimatedOneRepMax;
}

/**
 * Determines whether a set should count as a working set.
 *
 * If there is no usable historical comparison yet, default to "working"
 * so early-session / early-history sets are not unfairly excluded.
 */
export function classifySetType(intensity: number | null): SetType {
  if (intensity == null) {
    return "working";
  }

  return intensity >= WORKING_SET_INTENSITY_THRESHOLD ? "working" : "warmup";
}

/**
 * Finds the best prior estimated 1RM from a list of earlier sets for the same exercise.
 */
export function getPriorBestEstimatedOneRepMax(
  priorSets: ExerciseSet[]
): number | null {
  let best: number | null = null;

  for (const set of priorSets) {
    const estimatedOneRepMax = calculateEstimatedOneRepMax(
      set.performedWeight,
      set.performedReps
    );

    if (estimatedOneRepMax == null) {
      continue;
    }

    if (best == null || estimatedOneRepMax > best) {
      best = estimatedOneRepMax;
    }
  }

  return best;
}

const BODYWEIGHT_WARMUP_RIR_THRESHOLD = 4;

/**
 * Full set analysis for one set, given earlier comparable sets.
 *
 * For bodyweight exercises (no weight recorded), pass effectiveBaselineReps
 * (recentMaxReps ?? historicalBestReps). A set is warmup if the rep gap to
 * that baseline exceeds 4 — the same RIR cutoff used for weighted exercises
 * (60% e1RM ≈ 6 RPE ≈ 4 RIR).
 *
 * Pass prescribedRepTarget to use the session's rep target as the primary
 * warmup/working boundary. This prevents a set from being miscounted as warmup
 * when the prescribed target falls inside what the heuristic would call warmup
 * territory, and ensures any below-target set is always treated as ramp-up.
 */
export function analyzeSet(
  currentSet: ExerciseSet,
  priorSets: ExerciseSet[],
  effectiveBaselineE1RM: number | null = null,
  effectiveBaselineReps: number | null = null,
  prescribedRepTarget: number | null = null
): SetAnalysis {
  const estimatedOneRepMax = calculateEstimatedOneRepMax(
    currentSet.performedWeight,
    currentSet.performedReps
  );

  // Bodyweight path: no weight means e1RM is meaningless — classify by rep gap instead.
  if (currentSet.performedWeight == null) {
    const reps = currentSet.performedReps ?? 0;
    let setType: SetType;
    if (prescribedRepTarget != null && reps > 0) {
      // Prescribed target is the authoritative boundary: hit it or better = working.
      setType = reps >= prescribedRepTarget ? "working" : "warmup";
    } else if (effectiveBaselineReps != null) {
      setType = effectiveBaselineReps - reps > BODYWEIGHT_WARMUP_RIR_THRESHOLD ? "warmup" : "working";
    } else {
      setType = "working";
    }
    return {
      estimatedOneRepMax: null,
      priorBestEstimatedOneRepMax: null,
      intensity: null,
      setType,
    };
  }

  const rawPriorBest = getPriorBestEstimatedOneRepMax(priorSets);

  // Use the higher of: within-session prior best vs the effective baseline (recent-max
  // fallback when the all-time PR hasn't been matched recently). This ensures warmup
  // classification is held to the user's current capacity, not a stale all-time high.
  const priorBestEstimatedOneRepMax =
    Math.max(rawPriorBest ?? 0, effectiveBaselineE1RM ?? 0) || null;

  const intensity = calculateIntensity(
    estimatedOneRepMax,
    priorBestEstimatedOneRepMax
  );

  let setType = classifySetType(intensity);

  // Prescribed target override for weighted sets: if a target is known, use it as
  // the boundary so sets that hit the target are never miscounted as warmup.
  if (prescribedRepTarget != null && currentSet.performedReps != null && currentSet.performedReps > 0) {
    setType = currentSet.performedReps >= prescribedRepTarget ? "working" : "warmup";
  }

  return {
    estimatedOneRepMax,
    priorBestEstimatedOneRepMax,
    intensity,
    setType,
  };
}