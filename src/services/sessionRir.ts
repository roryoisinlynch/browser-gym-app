import type { SessionInstanceView } from "../repositories/programRepository";
import { percentileOrNull } from "./heuristicsScale";

export interface SessionRirSummary {
  /** Per working, non-AMRAP set RIR, sorted ascending — one entry per set. */
  values: number[];
  /** The session's target RIR (sv.effectiveRir) to draw as a reference line. */
  target: number;
  /** Working sets that produced a usable RIR (== values.length). */
  workingSetCount: number;
  /**
   * Working sets dropped because their exercise had no baseline to measure RIR
   * against (AMRAP / dormant / no history). Surfaced so the UI can explain the
   * gap rather than silently hide it.
   */
  amrapExcludedCount: number;
  /** Median RIR for the caption; null when there are no values. */
  median: number | null;
}

/**
 * Derive the distribution of per-set RIR (reps in reserve) across a session's
 * working sets.
 *
 * RIR is not stored on a set; it is derived from the set's e1RM against the
 * exercise's effective baseline — the SAME baseline the session's prescription
 * and `effectiveRir` target were built from, so the returned values and
 * `target` share one ruler. The integer form mirrors the prescription's floored
 * `zeroRirReps` (epsilon included), so a perfectly-executed set lands exactly on
 * the target.
 *
 * Caveat: `sv.effectiveRir` is the session-level target; it omits the
 * `weekInstance.rirTarget` / `exerciseInstance.prescribedRir` fallbacks that a
 * per-exercise prescription can use. The plotted values are always correct (they
 * don't depend on the week RIR); only the marker could sit off when those
 * overrides are set. In the common config (a season rirSequence, no per-exercise
 * override) they coincide.
 */
export function computeSessionRir(sv: SessionInstanceView): SessionRirSummary {
  const values: number[] = [];
  let amrapExcludedCount = 0;

  for (const group of sv.muscleGroups) {
    for (const exercise of group.exercises) {
      const working = exercise.sets.filter(
        (item) => item.analysis.setType === "working"
      );

      // No baseline to measure RIR against: AMRAP, dormant, or no history all
      // resolve to a null prescribed rep target. Count these so the UI can show
      // why they're missing rather than hiding them.
      if (exercise.prescribedRepTarget == null) {
        amrapExcludedCount += working.length;
        continue;
      }

      for (const { set } of working) {
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

        if (rir != null && Number.isFinite(rir)) values.push(rir);
      }
    }
  }

  values.sort((a, b) => a - b);

  // percentileOrNull returns null for n < 2; a lone sample is its own median.
  const median =
    values.length === 0 ? null : (percentileOrNull(values, 0.5) ?? values[0]);

  return {
    values,
    target: sv.effectiveRir,
    workingSetCount: values.length,
    amrapExcludedCount,
    median,
  };
}
