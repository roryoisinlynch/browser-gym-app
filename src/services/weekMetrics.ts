import type {
  EmojiRating,
  SessionInstanceStatus,
  SessionMetrics,
  WeekInstance,
  WeekMetrics,
  WeekTemplateItem,
} from "../domain/models";
import type { SessionInstanceView } from "../repositories/programRepository";
import { computeSessionMetrics } from "./sessionMetrics";

export type { EmojiRating, WeekMetrics };

/** One settled session's status + metrics — the input to week aggregation. */
export interface SessionMetricsEntry {
  status: SessionInstanceStatus;
  metrics: SessionMetrics;
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
  return computeWeekMetricsFromSessions(
    weekInstance,
    weekTemplateItems,
    sessionViews.map((sv) => ({
      status: sv.sessionInstance.status,
      metrics: computeSessionMetrics(sv),
    }))
  );
}

/**
 * Same as computeWeekMetrics but driven by already-computed session metrics
 * (frozen or fresh) instead of full session views — so week aggregation never
 * needs to rebuild a view.
 */
export function computeWeekMetricsFromSessions(
  weekInstance: WeekInstance,
  weekTemplateItems: WeekTemplateItem[],
  sessions: SessionMetricsEntry[]
): WeekMetrics {
  // Skipped sessions are treated as zero-effort completions: they count toward
  // the session totals (so the week settles) and pull volume/intensity averages
  // toward zero so the user is rated honestly for opting out.
  const completedViews = sessions.filter(
    (s) => s.status === "completed" || s.status === "skipped"
  );

  const totalSets = completedViews.reduce((sum, s) => sum + s.metrics.totalSets, 0);

  const totalSessions = completedViews.length;

  const durationLabel =
    weekInstance.startedAt && weekInstance.completedAt
      ? formatWeekDuration(weekInstance.startedAt, weekInstance.completedAt)
      : null;

  let volumeScore = 0;
  let intensityScore = 0;
  if (completedViews.length > 0) {
    volumeScore = Math.round(
      completedViews.reduce((s, x) => s + x.metrics.volumeScore, 0) / completedViews.length
    );
    intensityScore = Math.round(
      completedViews.reduce((s, x) => s + x.metrics.intensityScore, 0) / completedViews.length
    );
  }

  // Consistency: blended score of completion rate × timing rate.
  //   completionRate = genuinely-completed sessions / scheduled sessions
  //                    (capped at 1; skipped sessions DO NOT count as completed
  //                    here, so a skipped session tanks consistency just like
  //                    it tanks volume and intensity)
  //   timingRate     = expected calendar length / actual calendar length (capped at 1)
  // Both must be good for a high score; each independently penalises skips or delays.
  const expectedLength = weekTemplateItems.length; // calendar days the week was designed to span
  const scheduledSessionCount = weekTemplateItems.filter((i) => i.type === "session").length;
  const genuinelyCompletedCount = completedViews.filter(
    (s) => s.status === "completed"
  ).length;
  const skippedSessions = Math.max(0, scheduledSessionCount - genuinelyCompletedCount);

  let consistencyScore = 100;
  if (scheduledSessionCount > 0) {
    const completionRate = Math.min(1, genuinelyCompletedCount / scheduledSessionCount);
    let timingRate = 1;
    if (weekInstance.startedAt && weekInstance.completedAt && expectedLength > 0) {
      const startMs = new Date(weekInstance.startedAt).getTime();
      const endMs = new Date(weekInstance.completedAt).getTime();
      const actualLength = Math.max(1, (endMs - startMs) / 86_400_000);
      timingRate = Math.min(1, expectedLength / actualLength);
    }
    consistencyScore = Math.round(completionRate * timingRate * 100);
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
    skippedSessions,
  };
}
