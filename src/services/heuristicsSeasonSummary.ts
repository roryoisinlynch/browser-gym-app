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
  /** Per-question mean of non-null answers; a question absent here had no real
   *  rating this season. Feeds the biggest-mover comparison. */
  meanByQuestion: Map<string, number>;
}

// The question that moved the most between two seasons.
export interface HeuristicMover {
  questionId: string;
  label: string;
  from: number; // previous-season mean (rounded to 1 dp)
  to: number; // current-season mean (rounded to 1 dp)
  delta: number; // to − from
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
  const perQuestion = new Map<string, { sum: number; count: number }>();

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
    const pq = perQuestion.get(e.questionId);
    if (pq) {
      pq.sum += e.value;
      pq.count += 1;
    } else {
      perQuestion.set(e.questionId, { sum: e.value, count: 1 });
    }
  }

  const meanByQuestion = new Map<string, number>();
  for (const [qid, { sum, count }] of perQuestion) {
    meanByQuestion.set(qid, sum / count);
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
    meanByQuestion,
  };
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * The questions that moved the most between two seasons. A question only
 * qualifies when it has a real mean in BOTH seasons — otherwise there's no
 * change to measure. Means are rounded to the displayed 1-decimal precision
 * first, so a sub-0.05 wobble that reads as "3.0 → 3.0" is not called a mover.
 * Increase and decrease are disjoint (a delta has one sign); ties keep the
 * earliest question in the passed order.
 */
export function biggestMovers(
  current: HeuristicSeasonAggregate,
  previous: HeuristicSeasonAggregate,
  questions: ReadonlyArray<{ id: string; label: string }>
): { increase: HeuristicMover | null; decrease: HeuristicMover | null } {
  let increase: HeuristicMover | null = null;
  let decrease: HeuristicMover | null = null;

  for (const q of questions) {
    const rawTo = current.meanByQuestion.get(q.id);
    const rawFrom = previous.meanByQuestion.get(q.id);
    if (rawTo == null || rawFrom == null) continue;
    const to = round1(rawTo);
    const from = round1(rawFrom);
    const delta = round1(to - from);
    if (delta > 0 && (increase == null || delta > increase.delta)) {
      increase = { questionId: q.id, label: q.label, from, to, delta };
    } else if (delta < 0 && (decrease == null || delta < decrease.delta)) {
      decrease = { questionId: q.id, label: q.label, from, to, delta };
    }
  }
  return { increase, decrease };
}
