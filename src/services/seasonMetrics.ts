import type {
  SeasonInstance,
  WeekInstance,
  WeekInstanceItem,
  WeekTemplateItem,
} from "../domain/models";
import type { WeekMetrics } from "./weekMetrics";

export type SeasonGrade = "A" | "B" | "C" | "D" | "F" | "U";

export interface SeasonMetrics {
  totalSets: number;
  totalSessions: number;
  totalWeeks: number;
  durationLabel: string | null;
  volumeScore: number;
  intensityScore: number;
  consistencyScore: number;
  seasonScore: number;
  grade: SeasonGrade;
  totalSkippedSessions: number;
  endedEarly: boolean;
}

export function getSeasonGrade(score: number): SeasonGrade {
  if (score >= 100) return "A";
  if (score >= 96) return "B";
  if (score >= 92) return "C";
  if (score >= 88) return "D";
  return "F";
}

export function gradeColor(grade: SeasonGrade): "green" | "amber" | "red" | "grey" {
  if (grade === "U") return "grey";
  if (grade === "A" || grade === "B") return "green";
  if (grade === "C") return "amber";
  return "red";
}

export function formatSeasonDuration(startIso: string, endIso: string): string {
  const totalSeconds = Math.max(
    0,
    Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000)
  );
  const days = Math.floor(totalSeconds / 86400);
  const weeks = Math.floor(days / 7);
  const remainingDays = days % 7;
  if (weeks >= 1) return remainingDays === 0 ? `${weeks}w` : `${weeks}w ${remainingDays}d`;
  return `${days}d`;
}

export interface SeasonConsistencyWeek {
  week: WeekInstance;
  items: WeekInstanceItem[];
  completedSessionCount: number;
}

export interface SeasonConsistencyInput {
  startedAt: string;
  endedAt: string;
  weeks: SeasonConsistencyWeek[];
  canonicalWeekItems: WeekTemplateItem[];
}

/**
 * Working days the user delivered, divided by working days they should have
 * delivered in the elapsed time. Generated weeks contribute via their own
 * snapshot (frozen when the week was created); time past the last generated
 * week extrapolates the live canonical week pattern (current commitment).
 */
export function computeSeasonConsistency(input: SeasonConsistencyInput): number | null {
  const startMs = new Date(input.startedAt).getTime();
  const endMs = new Date(input.endedAt).getTime();
  const elapsedDays = Math.max(0, Math.floor((endMs - startMs) / 86_400_000));
  if (elapsedDays === 0) return null;

  let completed = 0;
  let expected = 0;
  let dayCursor = 0;

  const sortedWeeks = [...input.weeks].sort((a, b) => a.week.order - b.week.order);

  for (const w of sortedWeeks) {
    const items = [...w.items].sort((a, b) => a.order - b.order);
    const weekDays = items.length;
    if (weekDays === 0) continue;

    const remainingElapsed = elapsedDays - dayCursor;
    if (remainingElapsed <= 0) break;

    const daysFromThisWeek = Math.min(weekDays, remainingElapsed);
    const expectedThisWeek = items.filter(
      (it) => it.type === "session" && it.order <= daysFromThisWeek
    ).length;

    expected += expectedThisWeek;
    completed += w.completedSessionCount;
    dayCursor += weekDays;
  }

  // Extrapolate the live canonical week pattern past the last generated week.
  const canonicalDays = input.canonicalWeekItems.length;
  if (canonicalDays > 0 && elapsedDays > dayCursor) {
    const overrun = elapsedDays - dayCursor;
    const sortedCanonical = [...input.canonicalWeekItems].sort(
      (a, b) => a.order - b.order
    );
    const fullCycles = Math.floor(overrun / canonicalDays);
    const remainder = overrun % canonicalDays;
    const sessionsPerCycle = sortedCanonical.filter((it) => it.type === "session").length;
    const sessionsInRemainder = sortedCanonical.filter(
      (it) => it.type === "session" && it.order <= remainder
    ).length;
    expected += fullCycles * sessionsPerCycle + sessionsInRemainder;
  }

  if (expected === 0) return null;
  return Math.round(Math.min(1, completed / expected) * 100);
}

export function computeSeasonMetrics(
  seasonInstance: SeasonInstance,
  weekMetrics: WeekMetrics[],
  consistencyOverride?: number | null
): SeasonMetrics {
  const totalSets = weekMetrics.reduce((s, w) => s + w.totalSets, 0);
  const totalSessions = weekMetrics.reduce((s, w) => s + w.totalSessions, 0);
  const totalSkippedSessions = weekMetrics.reduce((s, w) => s + w.skippedSessions, 0);
  const completedWeeks = weekMetrics.length;

  const durationLabel =
    seasonInstance.startedAt && seasonInstance.completedAt
      ? formatSeasonDuration(seasonInstance.startedAt, seasonInstance.completedAt)
      : null;

  let volumeScore = 0;
  let intensityScore = 0;
  let weekConsistencyMean = 0;

  if (completedWeeks > 0) {
    volumeScore = Math.round(weekMetrics.reduce((s, w) => s + w.volumeScore, 0) / completedWeeks);
    intensityScore = Math.round(weekMetrics.reduce((s, w) => s + w.intensityScore, 0) / completedWeeks);
    weekConsistencyMean = Math.round(weekMetrics.reduce((s, w) => s + w.consistencyScore, 0) / completedWeeks);
  }

  const consistencyScore =
    consistencyOverride !== undefined && consistencyOverride !== null
      ? consistencyOverride
      : weekConsistencyMean;

  const seasonScore = Math.round((volumeScore + intensityScore + consistencyScore) / 3);
  const endedEarly = seasonInstance.status === "cancelled";
  const grade: SeasonGrade = endedEarly ? "U" : getSeasonGrade(seasonScore);

  return {
    totalSets,
    totalSessions,
    totalWeeks: completedWeeks,
    durationLabel,
    volumeScore,
    intensityScore,
    consistencyScore,
    seasonScore,
    grade,
    totalSkippedSessions,
    endedEarly,
  };
}
