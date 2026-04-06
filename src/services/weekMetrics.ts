import type { WeekInstance, WeekTemplateItem } from "../domain/models";
import type { SessionInstanceView } from "../repositories/programRepository";
import { computeSessionMetrics } from "./sessionMetrics";

/**
 * 1 = best (😍), 5 = worst (😵).
 * Thresholds: 100 → 1, ≥96 → 2, ≥92 → 3, ≥88 → 4, <88 → 5.
 */
export type EmojiRating = 1 | 2 | 3 | 4 | 5;

export interface WeekMetrics {
  totalSets: number;
  totalSessions: number;
  durationLabel: string | null;
  volumeScore: number;
  intensityScore: number;
  consistencyScore: number;
  weekScore: number;
  emojiRating: EmojiRating;
}

export function getEmojiRating(score: number): EmojiRating {
  if (score >= 100) return 1;
  if (score >= 96) return 2;
  if (score >= 92) return 3;
  if (score >= 88) return 4;
  return 5;
}

export function emojiForRating(rating: EmojiRating): string {
  switch (rating) {
    case 1: return "🤩";
    case 2: return "🙂";
    case 3: return "😐";
    case 4: return "🙁";
    case 5: return "🤡";
  }
}

/** Dynamic duration label: days if ≥ 1 d, hours if ≥ 1 h, minutes otherwise. */
export function formatWeekDuration(startIso: string, endIso: string): string {
  const totalSeconds = Math.max(
    0,
    Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000)
  );

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days >= 1) return hours === 0 ? `${days}d` : `${days}d ${hours}h`;
  if (hours >= 1) return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Computes week-level performance metrics.
 *
 * Volume / Intensity: equal-weighted average across all completed sessions.
 * Consistency: scheduled days (total items in week template) ÷ actual calendar
 *   days taken, expressed as a %, capped at 100. Finishing faster than
 *   scheduled still counts as 100%.
 * Week score: equal-weighted average of the three components.
 */
export function computeWeekMetrics(
  weekInstance: WeekInstance,
  weekTemplateItems: WeekTemplateItem[],
  sessionViews: SessionInstanceView[]
): WeekMetrics {
  const completedViews = sessionViews.filter(
    (sv) => sv.sessionInstance.status === "completed"
  );

  const totalSets = completedViews.reduce(
    (sum, sv) => sum + computeSessionMetrics(sv).totalSets,
    0
  );

  const totalSessions = completedViews.length;

  const durationLabel =
    weekInstance.startedAt && weekInstance.completedAt
      ? formatWeekDuration(weekInstance.startedAt, weekInstance.completedAt)
      : null;

  let volumeScore = 0;
  let intensityScore = 0;
  if (completedViews.length > 0) {
    const sessionMetrics = completedViews.map(computeSessionMetrics);
    volumeScore = Math.round(
      sessionMetrics.reduce((s, m) => s + m.volumeScore, 0) / sessionMetrics.length
    );
    intensityScore = Math.round(
      sessionMetrics.reduce((s, m) => s + m.intensityScore, 0) / sessionMetrics.length
    );
  }

  // Consistency: how long did the week take vs how long it was scheduled to take.
  const scheduledDays = weekTemplateItems.length;
  let consistencyScore = 100;
  if (weekInstance.startedAt && weekInstance.completedAt && scheduledDays > 0) {
    const startMs = new Date(weekInstance.startedAt).getTime();
    const endMs = new Date(weekInstance.completedAt).getTime();
    const actualDays = Math.max(1, (endMs - startMs) / 86_400_000);
    consistencyScore = Math.min(100, Math.round((scheduledDays / actualDays) * 100));
  }

  const weekScore = Math.round((volumeScore + intensityScore + consistencyScore) / 3);
  const emojiRating = getEmojiRating(weekScore);

  return {
    totalSets,
    totalSessions,
    durationLabel,
    volumeScore,
    intensityScore,
    consistencyScore,
    weekScore,
    emojiRating,
  };
}
