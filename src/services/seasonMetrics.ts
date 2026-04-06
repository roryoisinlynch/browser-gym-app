import type { SeasonInstance } from "../domain/models";
import type { WeekMetrics } from "./weekMetrics";

export type SeasonGrade = "A" | "B" | "C" | "D" | "F";

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
}

export function getSeasonGrade(score: number): SeasonGrade {
  if (score >= 93) return "A";
  if (score >= 80) return "B";
  if (score >= 65) return "C";
  if (score >= 50) return "D";
  return "F";
}

export function gradeColor(grade: SeasonGrade): "green" | "amber" | "red" {
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

export function computeSeasonMetrics(
  seasonInstance: SeasonInstance,
  weekMetrics: WeekMetrics[]
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
  let consistencyScore = 0;

  if (completedWeeks > 0) {
    volumeScore = Math.round(weekMetrics.reduce((s, w) => s + w.volumeScore, 0) / completedWeeks);
    intensityScore = Math.round(weekMetrics.reduce((s, w) => s + w.intensityScore, 0) / completedWeeks);
    consistencyScore = Math.round(weekMetrics.reduce((s, w) => s + w.consistencyScore, 0) / completedWeeks);
  }

  const seasonScore = Math.round((volumeScore + intensityScore + consistencyScore) / 3);
  const grade = getSeasonGrade(seasonScore);

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
  };
}
