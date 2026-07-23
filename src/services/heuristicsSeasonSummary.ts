import type { HeuristicEntry } from "../domain/models";

// A single season's heuristics rolled up across every active question. Used by
// the dashboard's season-vs-previous-season comparison block.
export interface HeuristicSeasonAggregate {
  /** Mean of all non-null answers across active questions; null when none. */
  mean: number | null;
  /** Count of rated (1–5) answers. */
  valueCount: number;
  /** Count of grey-N/A (null) answers. */
  skippedCount: number;
  /** activeQuestionCount × seasonDays — the coverage denominator. */
  totalSlots: number;
  /** valueCount / totalSlots × 100, clamped [0,100]; null when totalSlots === 0. */
  coveragePct: number | null;
  /** Distinct dates carrying ≥1 non-null answer — drives the ≥2-day gate. */
  distinctAnswerDays: number;
}

// Round (not floor) so a DST-crossing span isn't short a day, which would push
// coverage above 100%. Mirrors dayDiffInclusive in SeasonSummaryPage.
function dayDiffInclusive(startIso: string, endIso: string): number {
  const s = new Date(startIso + "T00:00:00").getTime();
  const e = new Date(endIso + "T00:00:00").getTime();
  return Math.round((e - s) / 86_400_000) + 1;
}

/**
 * Roll a season's heuristic entries into a single total across all questions.
 *
 * Null answers (grey N/A) are excluded from the mean rather than counted as 0,
 * so a skipped day never drags the score down. Coverage is measured against the
 * full grid of possible answers (active questions × days in the season), so both
 * skips and untouched days count against it — matching the per-question coverage
 * the Season/Week reports already show.
 */
export function aggregateHeuristicSeason(
  entries: ReadonlyArray<HeuristicEntry>,
  activeQuestionIds: ReadonlySet<string>,
  activeQuestionCount: number,
  startIso: string,
  endIso: string
): HeuristicSeasonAggregate {
  let valueSum = 0;
  let valueCount = 0;
  let skippedCount = 0;
  const valuedDays = new Set<string>();
  const ratedCells = new Set<string>(); // defensive vs duplicate rows per (q,day)

  for (const e of entries) {
    if (!activeQuestionIds.has(e.questionId)) continue; // drop deleted questions
    if (e.value == null) {
      skippedCount += 1; // a skip is NOT a 0
      continue;
    }
    const key = `${e.questionId}_${e.date}`;
    if (ratedCells.has(key)) continue;
    ratedCells.add(key);
    valueSum += e.value;
    valueCount += 1;
    valuedDays.add(e.date);
  }

  const totalDays = Math.max(0, dayDiffInclusive(startIso, endIso));
  const totalSlots = activeQuestionCount * totalDays;
  return {
    mean: valueCount > 0 ? valueSum / valueCount : null,
    valueCount,
    skippedCount,
    totalSlots,
    coveragePct:
      totalSlots > 0 ? Math.min(100, (valueCount / totalSlots) * 100) : null,
    distinctAnswerDays: valuedDays.size,
  };
}
