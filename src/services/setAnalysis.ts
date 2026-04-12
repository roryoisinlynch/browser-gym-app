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
 * Pass prescribedWeight + prescribedRepTarget to adjust the warmup threshold
 * when the prescription falls in otherwise-warmup territory. For weighted
 * exercises, the threshold is pulled down to the target's e1RM so any set
 * whose e1RM meets or exceeds it counts as working (a heavier/lower-rep set
 * that clears the same bar is still working). For bodyweight, the rep threshold
 * is pulled down to the target so ramp-up sets below the target stay warmup
 * while the target itself — and any set above it — counts as working.
 */
export function analyzeSet(
  currentSet: ExerciseSet,
  priorSets: ExerciseSet[],
  effectiveBaselineE1RM: number | null = null,
  effectiveBaselineReps: number | null = null,
  prescribedRepTarget: number | null = null,
  prescribedWeight: number | null = null
): SetAnalysis {
  const estimatedOneRepMax = calculateEstimatedOneRepMax(
    currentSet.performedWeight,
    currentSet.performedReps
  );

  // Bodyweight path: no weight means e1RM is meaningless — classify by rep gap instead.
  if (currentSet.performedWeight == null) {
    const reps = currentSet.performedReps ?? 0;
    let setType: SetType;
    if (effectiveBaselineReps != null) {
      const normalThreshold = effectiveBaselineReps - BODYWEIGHT_WARMUP_RIR_THRESHOLD;
      // If the prescribed target is itself in warmup territory, pull the threshold
      // down to the target so the target counts as working and below it as warmup.
      // If the target is already in working territory, the normal threshold applies
      // and below-target sets can still be working (e.g. slightly under target but
      // above the normal boundary).
      const effectiveThreshold =
        prescribedRepTarget != null && prescribedRepTarget < normalThreshold
          ? prescribedRepTarget
          : normalThreshold;
      setType = reps >= effectiveThreshold ? "working" : "warmup";
    } else if (prescribedRepTarget != null && reps > 0) {
      // No baseline yet — use prescribed target as the sole reference.
      setType = reps >= prescribedRepTarget ? "working" : "warmup";
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

  // If the prescribed target's e1RM falls below the normal 60% threshold, pull the
  // threshold down to the target's e1RM. Any set whose e1RM meets or exceeds the
  // target's e1RM counts as working — including heavier sets done at fewer reps.
  if (
    prescribedWeight != null &&
    prescribedRepTarget != null &&
    priorBestEstimatedOneRepMax != null &&
    estimatedOneRepMax != null
  ) {
    const targetE1RM = calculateEstimatedOneRepMax(prescribedWeight, prescribedRepTarget);
    if (targetE1RM != null) {
      const targetIntensity = targetE1RM / priorBestEstimatedOneRepMax;
      if (targetIntensity < WORKING_SET_INTENSITY_THRESHOLD) {
        setType = estimatedOneRepMax >= targetE1RM ? "working" : "warmup";
      }
    }
  }

  return {
    estimatedOneRepMax,
    priorBestEstimatedOneRepMax,
    intensity,
    setType,
  };
}
