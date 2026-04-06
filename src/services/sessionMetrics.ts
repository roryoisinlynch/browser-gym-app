import { calculateEstimatedOneRepMax } from "./setAnalysis";
import type { SessionInstanceView } from "../repositories/programRepository";

export type RagStatus = "green" | "amber" | "red";

export interface SessionMetrics {
  totalSets: number;
  durationSeconds: number | null;
  workingSetsCompleted: number;
  workingSetsTarget: number;
  volumeScore: number;
  setsMetIntensity: number;
  intensityTarget: number;
  intensityScore: number;
  sessionScore: number;
  ragStatus: RagStatus;
}

/**
 * Computes the core performance metrics for a completed session.
 *
 * Volume score: working sets completed as a % of target.
 * Intensity score: sets that met or exceeded the prescribed e1RM as a % of
 *   the intensity target (one intense set per every 3 target working sets).
 * Session score: equal-weighted average of both scores (0–100).
 * RAG status: green ≥ 100, amber 90–99, red < 90.
 */
export function computeSessionMetrics(view: SessionInstanceView): SessionMetrics {
  const workingSetsCompleted = view.muscleGroups.reduce(
    (sum, group) =>
      sum + group.exercises.reduce((gs, ex) => gs + ex.workingSetCount, 0),
    0
  );

  const workingSetsTarget = view.muscleGroups.reduce(
    (sum, group) => sum + group.sessionTemplateMuscleGroup.targetWorkingSets,
    0
  );

  const totalSets = view.muscleGroups.reduce(
    (sum, group) =>
      sum + group.exercises.reduce((gs, ex) => gs + ex.sets.length, 0),
    0
  );

  // One "intense" set expected per three target working sets, rounded down.
  const intensityTarget = Math.floor(workingSetsTarget / 3);

  // Count sets whose e1RM met or exceeded the prescribed e1RM target.
  // Bodyweight exercises (no prescribedWeight) are excluded from this metric
  // as we cannot reliably compute a weight-based e1RM target for them.
  let setsMetIntensity = 0;
  for (const group of view.muscleGroups) {
    for (const exercise of group.exercises) {
      if (!exercise.exerciseInstance) continue;
      const { prescribedWeight, prescribedRepTarget } = exercise.exerciseInstance;
      if (prescribedWeight == null || prescribedRepTarget == null) continue;
      const targetE1RM = calculateEstimatedOneRepMax(prescribedWeight, prescribedRepTarget);
      if (targetE1RM == null) continue;
      for (const { analysis } of exercise.sets) {
        if (
          analysis.estimatedOneRepMax != null &&
          analysis.estimatedOneRepMax >= targetE1RM
        ) {
          setsMetIntensity++;
        }
      }
    }
  }

  const volumeScore =
    workingSetsTarget > 0
      ? Math.min(100, Math.round((workingSetsCompleted / workingSetsTarget) * 100))
      : 0;

  // If there is no intensity target (very short session) treat as fully met.
  const intensityScore =
    intensityTarget > 0
      ? Math.min(100, Math.round((setsMetIntensity / intensityTarget) * 100))
      : 100;

  const sessionScore = Math.round((volumeScore + intensityScore) / 2);

  const ragStatus: RagStatus =
    sessionScore >= 100 ? "green" : sessionScore >= 90 ? "amber" : "red";

  return {
    totalSets,
    durationSeconds: view.sessionInstance.durationSeconds ?? null,
    workingSetsCompleted,
    workingSetsTarget,
    volumeScore,
    setsMetIntensity,
    intensityTarget,
    intensityScore,
    sessionScore,
    ragStatus,
  };
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}
