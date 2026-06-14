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
// Float-noise guard for the strict RIR-6 boundary. Integer rep counts step e1RM
// by weight/30 — far larger than this — so it only absorbs rounding error at a
// set that lands exactly on the line, never a genuinely heavier set.
const WORKING_SET_E1RM_EPSILON = 1e-6;

export function calculateEstimatedOneRepMax(
  weight: number | null | undefined,
  reps: number | null | undefined
): number | null {
  if (weight == null || reps == null) return null;
  if (weight <= 0 || reps <= 0) return null;
  if (reps === 1) return weight;
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
 *   Weighted  — set e1RM > threshold e1RM (strict; RIR < 6), where the threshold
 *               is what an RIR-6 set at the working weight produces:
 *                 thresholdE1RM = baselineE1RM − workingWeight × (6/30)
 *               A set landing exactly on the RIR-6 line is a warmup. Defining
 *               the cutoff as an e1RM (rather than a rep count at one weight)
 *               keeps the rule consistent across weights — any set's e1RM
 *               converts trivially.
 *   Bodyweight — rep gap to effective baseline ≤ 5 (≡ RIR < 6)
 *
 * The reference weight for the threshold is `prescribedWeight` when supplied,
 * else the performed weight. The baseline e1RM is the larger of the prior
 * sets' best and any caller-provided `effectiveBaselineE1RM`.
 *
 * When prescribedWeight + prescribedRepTarget are provided and the prescribed
 * target sits below the threshold (the target itself implies RIR ≥ 6), the
 * threshold is pulled down to the target's e1RM so the target — and any set
 * matching it — still counts as working.
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

    if (prescribedRepTarget == null) {
      // AMRAP: no target to ramp toward, so every set is "the work."
      setType = "working";
    } else if (effectiveBaselineReps != null) {
      const normalThreshold = effectiveBaselineReps - BODYWEIGHT_WARMUP_GAP_THRESHOLD;
      // Pull threshold down to prescribed target when target is in warmup territory.
      const effectiveThreshold =
        prescribedRepTarget < normalThreshold ? prescribedRepTarget : normalThreshold;
      setType = reps >= effectiveThreshold ? "working" : "warmup";
    } else if (reps > 0) {
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

  // AMRAP: no target to ramp toward, so every logged set is "the work."
  // Avoids the failure mode where a heavy PR late in the session retroactively
  // demotes earlier sets to warmups by raising the e1RM baseline.
  if (prescribedRepTarget == null) {
    return { estimatedOneRepMax, priorBestEstimatedOneRepMax, intensity, setType: "working" };
  }

  // Threshold e1RM: the e1RM that an RIR-6 set at the working weight produces.
  // A working set must sit STRICTLY above this (RIR < 6); a set exactly on the
  // RIR-6 line is a warmup. This matches the bodyweight path (a 6-rep gap is a
  // warmup) and the rep-dash narrative.
  const referenceWeight = prescribedWeight ?? currentSet.performedWeight;
  let workingThresholdE1RM: number | null =
    priorBestEstimatedOneRepMax != null && referenceWeight != null && referenceWeight > 0
      ? priorBestEstimatedOneRepMax - referenceWeight * (WORKING_SET_RIR_THRESHOLD / 30)
      : null;

  // If the prescribed target's own e1RM falls below the threshold (the target
  // itself sits at RIR ≥ 6), pull the threshold down to the target so meeting
  // the prescription still qualifies. Unlike the RIR-6 line, this boundary is
  // INCLUSIVE: a set that exactly matches the target counts as working.
  let thresholdIsTarget = false;
  if (
    prescribedWeight != null &&
    prescribedWeight > 0 &&
    prescribedRepTarget != null &&
    workingThresholdE1RM != null
  ) {
    const targetE1RM = calculateEstimatedOneRepMax(prescribedWeight, prescribedRepTarget);
    if (targetE1RM != null && targetE1RM < workingThresholdE1RM) {
      workingThresholdE1RM = targetE1RM;
      thresholdIsTarget = true;
    }
  }

  const meetsThreshold = (e1rm: number, threshold: number): boolean =>
    thresholdIsTarget
      ? e1rm >= threshold // pulled-down target: hitting it exactly still counts
      : e1rm > threshold + WORKING_SET_E1RM_EPSILON; // RIR-6 line: strict (RIR < 6)

  const setType: SetType =
    workingThresholdE1RM == null || estimatedOneRepMax == null
      ? "warmup"
      : meetsThreshold(estimatedOneRepMax, workingThresholdE1RM)
        ? "working"
        : "warmup";

  return { estimatedOneRepMax, priorBestEstimatedOneRepMax, intensity, setType };
}
