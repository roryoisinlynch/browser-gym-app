import type { SessionInstanceView } from "../repositories/programRepository";
import { percentileOrNull } from "./heuristicsScale";

export interface SessionRirPoint {
  /** RIR, clamped to a floor of 0 (a set past a 0-RIR prediction plots at 0). */
  rir: number;
  type: "working" | "warmup";
}

export interface SessionRirSummary {
  /** One dot per plotted set (working + warmup), from non-AMRAP exercises. */
  points: SessionRirPoint[];
  /** The session's target RIR (sv.effectiveRir) to draw as a reference line. */
  target: number;
  /** Working sets that produced a usable RIR. */
  workingSetCount: number;
  /** Warmup sets that produced a usable RIR (shown as context). */
  warmupSetCount: number;
  /**
   * Working sets that met or beat the target effort, i.e. RIR ≤ target (fewer
   * reps in reserve = at least as hard as prescribed).
   */
  targetMetCount: number;
  /**
   * Working sets dropped because their exercise had no baseline to measure RIR
   * against (AMRAP / dormant / no history). Surfaced so the UI can explain the
   * gap rather than silently hide it.
   */
  amrapExcludedCount: number;
  /** Median RIR over the working sets, for the caption; null when there are none. */
  median: number | null;
}

/**
 * Derive the distribution of per-set RIR (reps in reserve) across a session's
 * sets. Working sets carry the effort story; warmup sets ride along as grey
 * context. Working sets are RIR < 6 and warmups ≥ 6, so the two never share a
 * column.
 *
 * RIR is not stored on a set; it is derived from the set's e1RM against the
 * exercise's effective baseline — the SAME baseline the session's prescription
 * and `effectiveRir` target were built from, so the returned values and
 * `target` share one ruler. The integer form mirrors the prescription's floored
 * `zeroRirReps` (epsilon included), so a perfectly-executed set lands exactly on
 * the target. Values are clamped to a floor of 0: a set taken past its 0-RIR
 * prediction (a PR) plots at 0 rather than pulling the axis negative.
 *
 * Caveat: `sv.effectiveRir` is the session-level target; it omits the
 * `weekInstance.rirTarget` / `exerciseInstance.prescribedRir` fallbacks that a
 * per-exercise prescription can use. The plotted values are always correct (they
 * don't depend on the week RIR); only the marker could sit off when those
 * overrides are set. In the common config (a season rirSequence, no per-exercise
 * override) they coincide.
 */
export function computeSessionRir(sv: SessionInstanceView): SessionRirSummary {
  const points: SessionRirPoint[] = [];
  let amrapExcludedCount = 0;

  for (const group of sv.muscleGroups) {
    for (const exercise of group.exercises) {
      // No baseline to measure RIR against: AMRAP, dormant, or no history all
      // resolve to a null prescribed rep target. Count the working sets we skip
      // so the UI can explain the gap rather than hiding it.
      if (exercise.prescribedRepTarget == null) {
        amrapExcludedCount += exercise.sets.filter(
          (item) => item.analysis.setType === "working"
        ).length;
        continue;
      }

      for (const { set, analysis } of exercise.sets) {
        const reps = set.performedReps;
        if (reps == null) continue;

        let rir: number | null = null;
        if (set.performedWeight != null && set.performedWeight > 0) {
          // Weighted: zeroRirReps − reps, mirroring computePrescription's floor
          // (with the same +0.0001 epsilon) so an on-target set reads as target.
          if (exercise.effectiveE1RM != null) {
            const zeroRirReps = Math.floor(
              (exercise.effectiveE1RM / set.performedWeight - 1) * 30 + 0.0001
            );
            rir = zeroRirReps - reps;
          }
        } else if (set.performedWeight == null) {
          // Bodyweight: gap to the effective rep baseline.
          if (exercise.effectiveBaselineReps != null) {
            rir = exercise.effectiveBaselineReps - reps;
          }
        }

        if (rir != null && Number.isFinite(rir)) {
          points.push({ rir: Math.max(0, rir), type: analysis.setType });
        }
      }
    }
  }

  const workingValues = points
    .filter((p) => p.type === "working")
    .map((p) => p.rir)
    .sort((a, b) => a - b);

  // percentileOrNull returns null for n < 2; a lone sample is its own median.
  const median =
    workingValues.length === 0
      ? null
      : (percentileOrNull(workingValues, 0.5) ?? workingValues[0]);

  const target = sv.effectiveRir;
  // Met or beat the effort target: fewer (or equal) reps in reserve than asked.
  const targetMetCount = workingValues.filter((rir) => rir <= target).length;

  return {
    points,
    target,
    workingSetCount: workingValues.length,
    warmupSetCount: points.length - workingValues.length,
    targetMetCount,
    amrapExcludedCount,
    median,
  };
}
