import type {
  MovementType,
  MuscleGroup,
  SeasonInstance,
  SessionInstance,
  SessionInstanceExercise,
  WeekInstance,
} from "../domain/models";
import { STORE_NAMES, getAll } from "../db/db";
import {
  getAllSetRecords,
  getAllTimePREvents,
  getExerciseSessionHistory,
  getSessionMetrics,
  getSeasonMetrics,
  getWeekMetrics,
  getAllExerciseTemplates,
  sessionCompletedDate,
  type PREvent,
} from "../repositories/programRepository";
import { loadAllImportedSets } from "./importedSetStore";

// ─── Review window / review year ─────────────────────────────────────────────

/** Inclusive open/close of the yearly review window, local time, 1-indexed months. */
export const REVIEW_WINDOW_OPEN = { month: 12, day: 25 };
export const REVIEW_WINDOW_CLOSE = { month: 1, day: 31 };

/**
 * "Now" for every year-in-review gate. In dev builds it honors a
 * localStorage override ("yearReviewNow", any Date-parsable string) so the
 * window and year logic can be exercised without changing the system clock.
 * Dead-code-eliminated in production.
 */
export function getReviewNow(): Date {
  if (import.meta.env.DEV) {
    const override = localStorage.getItem("yearReviewNow");
    if (override) {
      const d = new Date(override);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return new Date();
}

export interface YearInReviewState {
  inWindow: boolean;
  /** The calendar year the review covers: "the year just gone". */
  reviewYear: number;
}

export function getYearInReviewState(now: Date = getReviewNow()): YearInReviewState {
  const md = (now.getMonth() + 1) * 100 + now.getDate();
  const open = REVIEW_WINDOW_OPEN.month * 100 + REVIEW_WINDOW_OPEN.day;
  const close = REVIEW_WINDOW_CLOSE.month * 100 + REVIEW_WINDOW_CLOSE.day;
  const wraps = open > close;
  const inWindow = wraps ? md >= open || md <= close : md >= open && md <= close;
  // Default window wraps the year boundary: the December half reviews the
  // current (almost finished) year, the January half the year that just
  // ended. A non-wrapping window reviews the current calendar year.
  const reviewYear = wraps && md <= close ? now.getFullYear() - 1 : now.getFullYear();
  return { inWindow, reviewYear };
}

/**
 * Cheap gate for the interstitial, the dashboard CTA, and the page itself:
 * true when the review year has at least one completed session or one
 * imported set. Prompting into an empty review is pointless.
 */
export async function hasAnyReviewData(reviewYear: number): Promise<boolean> {
  const prefix = `${reviewYear}-`;
  const [sessions, importedSets] = await Promise.all([
    getAll<SessionInstance>(STORE_NAMES.sessionInstances),
    loadAllImportedSets(),
  ]);
  return (
    sessions.some(
      (s) => s.status === "completed" && sessionCompletedDate(s).startsWith(prefix)
    ) || importedSets.some((s) => s.date.startsWith(prefix))
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────

/** Sessions abandoned overnight carry huge durations; cap each at 6 hours. */
const DURATION_CAP_SECONDS = 6 * 3600;

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface TopExerciseStat {
  name: string;
  setCount: number;
  repCount: number;
  tonnageKg: number;
}

export interface MuscleGroupStat {
  name: string;
  setCount: number;
  /** Share of attributed sets, 0..1. */
  share: number;
}

export interface BiggestPr {
  exerciseName: string;
  date: string;
  newE1RM: number;
  previousE1RM: number;
  newWeight: number | null;
  newReps: number;
  /** (new - previous) / previous */
  relativeGain: number;
}

export interface BiggestRepPr {
  exerciseName: string;
  date: string;
  newReps: number;
  previousReps: number;
}

export interface E1rmProgressRow {
  name: string;
  previousBestE1RM: number;
  newBestE1RM: number;
  relativeGain: number;
}

export interface BusiestMonth {
  monthIndex: number;
  name: string;
  sessionCount: number;
}

export interface YearInReviewStats {
  reviewYear: number;
  totalCompletedSessions: number;
  totalTrainingSeconds: number;
  totalSets: number;
  totalReps: number;
  importedSetCount: number;
  totalTonnageKg: number;
  bodyweightReps: number;
  trainingDayCount: number;
  topExercises: TopExerciseStat[];
  muscleGroups: MuscleGroupStat[];
  /** Attributed in-year sets / all in-year sets, 0..1. */
  muscleAttributionShare: number;
  prCount: number;
  prExerciseCount: number;
  biggestPr: BiggestPr | null;
  biggestRepPr: BiggestRepPr | null;
  /** e1RM history of the biggest-PR exercise through the end of the review year, date-ascending, for the sparkline. */
  biggestPrHistory: { date: string; value: number }[];
  monthlySessionCounts: number[];
  monthsWithSessions: number;
  busiestMonth: BusiestMonth | null;
  longestWeeklyStreak: number;
  goldSessionCount: number;
  perfectWeekCount: number;
  aSeasonCount: number;
  seasonsCompleted: number;
  e1rmProgress: E1rmProgressRow[];
  hasMinimumData: boolean;
}

/** Local calendar date "YYYY-MM-DD" for an ISO datetime, same rule as sessionCompletedDate. */
function localDateOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Monday-aligned week index for a local "YYYY-MM-DD" date. Computed on the
 * UTC day count so DST shifts can't split a week. Day 0 (1970-01-01) was a
 * Thursday, so Mondays sit at day 4 + 7k.
 */
function mondayWeekIndex(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const days = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  return Math.floor((days - 4) / 7);
}

export async function computeYearInReviewStats(
  reviewYear: number
): Promise<YearInReviewStats> {
  const prefix = `${reviewYear}-`;
  const inYear = (date: string) => date.startsWith(prefix);

  const [
    sessions,
    weeks,
    seasons,
    setRecords,
    prEvents,
    sessionInstanceExercises,
    exerciseTemplates,
    movementTypes,
    muscleGroupRecords,
  ] = await Promise.all([
    getAll<SessionInstance>(STORE_NAMES.sessionInstances),
    getAll<WeekInstance>(STORE_NAMES.weekInstances),
    getAll<SeasonInstance>(STORE_NAMES.seasonInstances),
    getAllSetRecords(),
    getAllTimePREvents(),
    getAll<SessionInstanceExercise>(STORE_NAMES.sessionInstanceExercises),
    getAllExerciseTemplates(),
    getAll<MovementType>(STORE_NAMES.movementTypes),
    getAll<MuscleGroup>(STORE_NAMES.muscleGroups),
  ]);

  // ── Sessions ──
  const yearSessions = sessions.filter(
    (s) => s.status === "completed" && inYear(sessionCompletedDate(s))
  );
  const totalCompletedSessions = yearSessions.length;
  const totalTrainingSeconds = yearSessions.reduce(
    (sum, s) =>
      sum + Math.min(Math.max(s.durationSeconds ?? 0, 0), DURATION_CAP_SECONDS),
    0
  );

  // ── Sets (native + imported, ghost rows with no reps excluded). Native
  // sets only count from completed sessions so these stats agree with the
  // hasAnyReviewData gate; imported records carry no session. ──
  const yearSets = setRecords.filter(
    (r) =>
      inYear(r.date) &&
      r.reps != null &&
      r.reps > 0 &&
      (r.source === "imported" || r.sessionStatus === "completed")
  );
  const totalSets = yearSets.length;
  let totalReps = 0;
  let importedSetCount = 0;
  let totalTonnageKg = 0;
  let bodyweightReps = 0;
  const trainingDays = new Set<string>();
  for (const r of yearSets) {
    const reps = r.reps!;
    totalReps += reps;
    if (r.source === "imported") importedSetCount++;
    if (r.weight != null && r.weight > 0) {
      totalTonnageKg += r.weight * reps;
    } else {
      // Native bodyweight sets store null weight; imported ones store 0.
      bodyweightReps += reps;
    }
    trainingDays.add(r.date);
  }
  const trainingDayCount = trainingDays.size;

  // ── Top exercises (all sets: warmup/working classification is impossible
  // for imported history, so the split is deliberately not attempted) ──
  interface ExerciseAgg {
    setCount: number;
    repCount: number;
    tonnageKg: number;
    casings: Map<string, number>;
  }
  const byExercise = new Map<string, ExerciseAgg>();
  for (const r of yearSets) {
    const key = normalizeName(r.exerciseName);
    let agg = byExercise.get(key);
    if (!agg) {
      agg = { setCount: 0, repCount: 0, tonnageKg: 0, casings: new Map() };
      byExercise.set(key, agg);
    }
    agg.setCount++;
    agg.repCount += r.reps!;
    if (r.weight != null && r.weight > 0) agg.tonnageKg += r.weight * r.reps!;
    const casing = r.exerciseName.trim();
    agg.casings.set(casing, (agg.casings.get(casing) ?? 0) + 1);
  }
  const displayName = (agg: ExerciseAgg): string => {
    let best = "";
    let bestCount = -1;
    for (const [casing, count] of agg.casings) {
      if (count > bestCount) {
        best = casing;
        bestCount = count;
      }
    }
    return best;
  };
  const rankedExercises = [...byExercise.values()].sort(
    (a, b) =>
      b.setCount - a.setCount ||
      b.tonnageKg - a.tonnageKg ||
      displayName(a).localeCompare(displayName(b))
  );
  const topExercises: TopExerciseStat[] = rankedExercises.slice(0, 5).map((agg) => ({
    name: displayName(agg),
    setCount: agg.setCount,
    repCount: agg.repCount,
    tonnageKg: agg.tonnageKg,
  }));

  // ── Muscle-group split ──
  // Sets are attributed by exercise name: SessionInstanceExercise snapshots
  // (and exercise templates as fallback) carry movementTypeId, whose parent is
  // the muscle group. Name-based matching covers imported sets too; unmatched
  // names count as unattributed.
  const movementToMuscleGroup = new Map(
    movementTypes.map((mt) => [mt.id, mt.muscleGroupId])
  );
  const muscleGroupName = new Map(muscleGroupRecords.map((g) => [g.id, g.name]));
  const nameToMuscleGroupVotes = new Map<string, Map<string, number>>();
  const vote = (exerciseName: string, movementTypeId: string) => {
    const groupId = movementToMuscleGroup.get(movementTypeId);
    if (!groupId) return;
    const key = normalizeName(exerciseName);
    let votes = nameToMuscleGroupVotes.get(key);
    if (!votes) {
      votes = new Map();
      nameToMuscleGroupVotes.set(key, votes);
    }
    votes.set(groupId, (votes.get(groupId) ?? 0) + 1);
  };
  for (const sie of sessionInstanceExercises) vote(sie.exerciseName, sie.movementTypeId);
  for (const t of exerciseTemplates) vote(t.exerciseName, t.movementTypeId);
  const nameToMuscleGroup = new Map<string, string>();
  for (const [name, votes] of nameToMuscleGroupVotes) {
    let bestGroup = "";
    let bestCount = -1;
    for (const [groupId, count] of votes) {
      if (count > bestCount) {
        bestGroup = groupId;
        bestCount = count;
      }
    }
    nameToMuscleGroup.set(name, bestGroup);
  }
  const setsByMuscleGroup = new Map<string, number>();
  let attributedSets = 0;
  for (const r of yearSets) {
    const groupId = nameToMuscleGroup.get(normalizeName(r.exerciseName));
    if (!groupId) continue;
    attributedSets++;
    setsByMuscleGroup.set(groupId, (setsByMuscleGroup.get(groupId) ?? 0) + 1);
  }
  const muscleGroups: MuscleGroupStat[] = [...setsByMuscleGroup.entries()]
    .map(([groupId, setCount]) => ({
      name: muscleGroupName.get(groupId) ?? "Other",
      setCount,
      share: attributedSets > 0 ? setCount / attributedSets : 0,
    }))
    .sort((a, b) => b.setCount - a.setCount);
  const muscleAttributionShare = totalSets > 0 ? attributedSets / totalSets : 0;

  // ── PRs ──
  // Native per-instance history can emit two same-day events for one exercise
  // (double sessions). Merge them: keep the bigger new value but measure it
  // against the smaller (pre-day) previous best, so the gain is not computed
  // from a same-day intermediate PR and does not depend on record order.
  const prByNameAndDate = new Map<string, PREvent>();
  const minOrNull = (a: number | null, b: number | null) =>
    a != null && b != null ? Math.min(a, b) : a ?? b;
  for (const e of prEvents) {
    if (!inYear(e.date)) continue;
    const key = `${normalizeName(e.exerciseName)}|${e.date}`;
    const existing = prByNameAndDate.get(key);
    if (!existing) {
      prByNameAndDate.set(key, e);
      continue;
    }
    const value = (ev: PREvent) =>
      ev.prType === "e1rm" ? ev.newE1RM ?? 0 : ev.newReps;
    const winner = value(e) > value(existing) ? e : existing;
    prByNameAndDate.set(key, {
      ...winner,
      previousE1RM: minOrNull(e.previousE1RM, existing.previousE1RM),
      previousReps: minOrNull(e.previousReps, existing.previousReps),
      previousDate:
        e.previousDate != null && existing.previousDate != null
          ? (e.previousDate < existing.previousDate ? e.previousDate : existing.previousDate)
          : e.previousDate ?? existing.previousDate,
    });
  }
  const yearPrs = [...prByNameAndDate.values()];
  const prCount = yearPrs.length;
  const prExerciseCount = new Set(yearPrs.map((e) => normalizeName(e.exerciseName)))
    .size;

  let biggestPr: BiggestPr | null = null;
  for (const e of yearPrs) {
    if (e.prType !== "e1rm" || e.newE1RM == null) continue;
    if (e.previousE1RM == null || e.previousE1RM <= 0) continue;
    const relativeGain = (e.newE1RM - e.previousE1RM) / e.previousE1RM;
    const candidate: BiggestPr = {
      exerciseName: e.exerciseName,
      date: e.date,
      newE1RM: e.newE1RM,
      previousE1RM: e.previousE1RM,
      newWeight: e.newWeight,
      newReps: e.newReps,
      relativeGain,
    };
    if (
      biggestPr == null ||
      relativeGain > biggestPr.relativeGain ||
      (relativeGain === biggestPr.relativeGain &&
        (candidate.newE1RM - candidate.previousE1RM >
          biggestPr.newE1RM - biggestPr.previousE1RM ||
          (candidate.newE1RM - candidate.previousE1RM ===
            biggestPr.newE1RM - biggestPr.previousE1RM &&
            candidate.date < biggestPr.date)))
    ) {
      biggestPr = candidate;
    }
  }

  let biggestRepPr: BiggestRepPr | null = null;
  for (const e of yearPrs) {
    if (e.prType !== "reps" || e.previousReps == null) continue;
    const gain = e.newReps - e.previousReps;
    if (biggestRepPr == null || gain > biggestRepPr.newReps - biggestRepPr.previousReps) {
      biggestRepPr = {
        exerciseName: e.exerciseName,
        date: e.date,
        newReps: e.newReps,
        previousReps: e.previousReps,
      };
    }
  }

  let biggestPrHistory: { date: string; value: number }[] = [];
  if (biggestPr) {
    const history = await getExerciseSessionHistory(biggestPr.exerciseName);
    // Clip at the end of the review year so a January viewing doesn't paint
    // new-year sessions as part of the review-year run.
    const yearEnd = `${reviewYear + 1}-01-01`;
    biggestPrHistory = history
      .map((dp) =>
        dp.topEstimatedOneRepMax != null && dp.topEstimatedOneRepMax > 0
          ? { date: dp.date, value: dp.topEstimatedOneRepMax }
          : null
      )
      .filter(
        (p): p is { date: string; value: number } => p != null && p.date < yearEnd
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // ── Months ──
  const monthlySessionCounts = new Array<number>(12).fill(0);
  for (const s of yearSessions) {
    const monthIndex = Number(sessionCompletedDate(s).slice(5, 7)) - 1;
    monthlySessionCounts[monthIndex]++;
  }
  const monthsWithSessions = monthlySessionCounts.filter((c) => c > 0).length;
  let busiestMonth: BusiestMonth | null = null;
  for (let i = 0; i < 12; i++) {
    if (monthlySessionCounts[i] > (busiestMonth?.sessionCount ?? 0)) {
      busiestMonth = {
        monthIndex: i,
        name: MONTH_NAMES[i],
        sessionCount: monthlySessionCounts[i],
      };
    }
  }

  // ── Longest weekly streak (in-year sessions only; a run alive at Jan 1
  // restarts, so one year's review is reproducible from that year's data) ──
  const weekIndexes = [
    ...new Set(yearSessions.map((s) => mondayWeekIndex(sessionCompletedDate(s)))),
  ].sort((a, b) => a - b);
  let longestWeeklyStreak = 0;
  let run = 0;
  let prev: number | null = null;
  for (const w of weekIndexes) {
    run = prev != null && w === prev + 1 ? run + 1 : 1;
    prev = w;
    if (run > longestWeeklyStreak) longestWeeklyStreak = run;
  }

  // ── Achievements (mirrors the dashboard's loadAchievements rules; the
  // metrics getters backfill frozenMetrics on first read, which is the same
  // idempotent write the dashboard already performs) ──
  let goldSessionCount = 0;
  for (const s of yearSessions) {
    if (!s.completedAt) continue;
    const m = await getSessionMetrics(s);
    if (m && m.ragStatus === "green") goldSessionCount++;
  }

  let perfectWeekCount = 0;
  for (const w of weeks) {
    if (w.status !== "completed" || w.endedEarly || !w.completedAt) continue;
    if (!inYear(localDateOf(w.completedAt))) continue;
    const wm = await getWeekMetrics(w);
    if (wm.emojiRating === 1) perfectWeekCount++;
  }

  let aSeasonCount = 0;
  let seasonsCompleted = 0;
  for (const season of seasons) {
    if (season.status !== "completed" || !season.completedAt) continue;
    if (!inYear(localDateOf(season.completedAt))) continue;
    seasonsCompleted++;
    const sm = await getSeasonMetrics(season);
    if (sm.grade === "A") aSeasonCount++;
  }

  // ── Year-over-year e1RM progress for the most-trained weighted lifts ──
  const previousPrefix = `${reviewYear - 1}-`;
  const weightedCandidates = rankedExercises
    .filter((agg) => agg.tonnageKg > 0)
    .slice(0, 6)
    .map(displayName);
  const e1rmProgress: E1rmProgressRow[] = [];
  for (const name of weightedCandidates) {
    if (e1rmProgress.length >= 3) break;
    const history = await getExerciseSessionHistory(name);
    let previousBest = 0;
    let newBest = 0;
    let inYearPoints = 0;
    for (const dp of history) {
      const v = dp.topEstimatedOneRepMax;
      if (v == null || v <= 0) continue;
      if (dp.date.startsWith(previousPrefix) && v > previousBest) previousBest = v;
      if (inYear(dp.date)) {
        inYearPoints++;
        if (v > newBest) newBest = v;
      }
    }
    if (previousBest > 0 && newBest > 0 && inYearPoints >= 3) {
      e1rmProgress.push({
        name,
        previousBestE1RM: previousBest,
        newBestE1RM: newBest,
        relativeGain: (newBest - previousBest) / previousBest,
      });
    }
  }

  return {
    reviewYear,
    totalCompletedSessions,
    totalTrainingSeconds,
    totalSets,
    totalReps,
    importedSetCount,
    totalTonnageKg,
    bodyweightReps,
    trainingDayCount,
    topExercises,
    muscleGroups,
    muscleAttributionShare,
    prCount,
    prExerciseCount,
    biggestPr,
    biggestRepPr,
    biggestPrHistory,
    monthlySessionCounts,
    monthsWithSessions,
    busiestMonth,
    longestWeeklyStreak,
    goldSessionCount,
    perfectWeekCount,
    aSeasonCount,
    seasonsCompleted,
    e1rmProgress,
    hasMinimumData: totalCompletedSessions >= 1 || totalSets >= 1,
  };
}
