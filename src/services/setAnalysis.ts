import type { ExerciseSet } from "../domain/models";

export type SetType = "warmup" | "working";

export interface SetAnalysis {
  estimatedOneRepMax: number | null;
  priorBestEstimatedOneRepMax: number | null;
  intensity: number | null;
  setType: SetType;
}

const WORKING_SET_INTENSITY_THRESHOLD = 0.6;
const WORKING_SET_RIR_THRESHOLD = 6; // must have fewer than 6 RIR to count as working
const BODYWEIGHT_WARMUP_GAP_THRESHOLD = 5; // warmup if gap > 5 (= RIR ≥ 6)

export function calculateEstimatedOneRepMax(
  weight: number | null | undefined,
  reps: number | null | undefined
): number | null {
  if (weight == null || reps == null) return null;
  if (weight <= 0 || reps <= 0) return null;
  return weight * (1 + reps / 30);
}

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

export function classifySetType(intensity: number | null): SetType {
  if (intensity == null) return "working";
  return intensity >= WORKING_SET_INTENSITY_THRESHOLD ? "working" : "warmup";
}

export function getPriorBestEstimatedOneRepMax(
  priorSets: ExerciseSet[]
): number | null {
  let best: number | null = null;
  for (const set of priorSets) {
    const e1rm = calculateEstimatedOneRepMax(set.performedWeight, set.performedReps);
    if (e1rm != null && (best == null || e1rm > best)) best = e1rm;
  }
  return best;
}

/**
 * Full set analysis for one set, given earlier comparable sets.
 *
 * Working-set definition:
 *   Weighted  — intensity ≥ 60% of effective e1RM  AND  performedRir < 6
 *   Bodyweight — rep gap to effective baseline ≤ 5 (≡ RIR < 6)
 *
 * When prescribedWeight + prescribedRepTarget are provided and the prescribed
 * target itself would fail the working criteria (low intensity OR implied RIR
 * ≥ 6), the working threshold is pulled down to the target's e1RM so the
 * target counts as working and any set clearing that same e1RM level does too.
 *
 * For bodyweight the effective baseline comes from effectiveBaselineReps
 * (recentMaxReps ?? historicalBestReps); similarly the threshold is pulled
 * down to prescribedRepTarget when the target sits below the normal threshold.
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

  // ── Bodyweight path ───────────────────────────────────────────────────────
  if (currentSet.performedWeight == null) {
    const reps = currentSet.performedReps ?? 0;
    let setType: SetType;

    if (effectiveBaselineReps != null) {
      const normalThreshold = effectiveBaselineReps - BODYWEIGHT_WARMUP_GAP_THRESHOLD;
      // Pull threshold down to prescribed target when target is in warmup territory.
      const effectiveThreshold =
        prescribedRepTarget != null && prescribedRepTarget < normalThreshold
          ? prescribedRepTarget
          : normalThreshold;
      setType = reps >= effectiveThreshold ? "working" : "warmup";
    } else if (prescribedRepTarget != null && reps > 0) {
      setType = reps >= prescribedRepTarget ? "working" : "warmup";
    } else {
      setType = "working";
    }

    return { estimatedOneRepMax: null, priorBestEstimatedOneRepMax: null, intensity: null, setType };
  }

  // ── Weighted path ─────────────────────────────────────────────────────────
  const rawPriorBest = getPriorBestEstimatedOneRepMax(priorSets);
  const priorBestEstimatedOneRepMax =
    Math.max(rawPriorBest ?? 0, effectiveBaselineE1RM ?? 0) || null;

  const intensity = calculateIntensity(estimatedOneRepMax, priorBestEstimatedOneRepMax);

  // Working requires BOTH: intensity ≥ 60% AND RIR < 6.
  const intensityOk = intensity != null && intensity >= WORKING_SET_INTENSITY_THRESHOLD;
  const ririOk =
    currentSet.performedRir == null || currentSet.performedRir < WORKING_SET_RIR_THRESHOLD;
  let setType: SetType = intensityOk && ririOk ? "working" : "warmup";

  // Prescribed target adjustment: if the target itself would be warmup (either
  // its e1RM is below the 60% bar, OR its implied RIR ≥ 6), lower the working
  // threshold to the target's e1RM.
  if (
    prescribedWeight != null &&
    prescribedWeight > 0 &&
    prescribedRepTarget != null &&
    priorBestEstimatedOneRepMax != null &&
    estimatedOneRepMax != null
  ) {
    const targetE1RM = calculateEstimatedOneRepMax(prescribedWeight, prescribedRepTarget);
    if (targetE1RM != null) {
      const targetIntensity = targetE1RM / priorBestEstimatedOneRepMax;
      const maxRepsAtPrescribed = 30 * (priorBestEstimatedOneRepMax / prescribedWeight - 1);
      const impliedTargetRir = maxRepsAtPrescribed - prescribedRepTarget;
      const targetIsWarmup =
        targetIntensity < WORKING_SET_INTENSITY_THRESHOLD ||
        impliedTargetRir >= WORKING_SET_RIR_THRESHOLD;
      if (targetIsWarmup) {
        setType = estimatedOneRepMax >= targetE1RM ? "working" : "warmup";
      }
    }
  }

  return { estimatedOneRepMax, priorBestEstimatedOneRepMax, intensity, setType };
}
