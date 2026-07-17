import type {
  SeasonInstance,
  SessionInstance,
  WeekInstance,
} from "../domain/models";
import { STORE_NAMES, getAll } from "../db/db";
import {
  getAllSetRecords,
  getAllTimePREvents,
  getExerciseSessionHistory,
  getSessionMetrics,
  getSessionDuration,
  getSeasonMetrics,
  getWeekMetrics,
  sessionCompletedDate,
  type PREvent,
} from "../repositories/programRepository";
import { calculateEstimatedOneRepMax } from "./setAnalysis";
import { loadAllImportedSets } from "./importedSetStore";
import { clearYearInReviewPromptFlag } from "../repositories/yearInReviewRepository";

// ─── Review window / review year ─────────────────────────────────────────────

/** Inclusive open/close of the yearly review window, local time, 1-indexed months. */
export const REVIEW_WINDOW_OPEN = { month: 12, day: 25 };
export const REVIEW_WINDOW_CLOSE = { month: 1, day: 31 };

const YEAR_REVIEW_NOW_KEY = "yearReviewNow";

/**
 * "Now" for every year-in-review gate. Honors a localStorage override
 * ("yearReviewNow", any Date-parsable string) so the window and year logic
 * can be exercised without changing the system clock. The override backs
 * both dev-time testing and the TEMPORARY Settings preview; once the
 * preview card is removed, this can be re-gated behind import.meta.env.DEV.
 */
export function getReviewNow(): Date {
  const override = localStorage.getItem(YEAR_REVIEW_NOW_KEY);
  if (override) {
    const d = new Date(override);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

// ─── TEMPORARY: Settings preview ──────────────────────────────────────────────
// Lets the feature be tried outside the real Dec 25 - Jan 31 window by
// simulating Dec 26 of the current year. Remove together with the Settings
// card once testing is done.

export function isYearInReviewPreviewActive(): boolean {
  return localStorage.getItem(YEAR_REVIEW_NOW_KEY) != null;
}

/**
 * Simulates Dec 26 of the current year and clears the prompt-seen flag for
 * the simulated review year so the app-open interstitial fires on the next
 * full load.
 */
export async function startYearInReviewPreview(): Promise<void> {
  const real = new Date();
  const previewNow = new Date(real.getFullYear(), 11, 26, 10, 0, 0);
  const { reviewYear } = getYearInReviewState(previewNow);
  await clearYearInReviewPromptFlag(reviewYear);
  localStorage.setItem(YEAR_REVIEW_NOW_KEY, previewNow.toISOString());
}

/**
 * Clears the simulated date and the prompt-seen flag the preview may have
 * burned, so the real review window still prompts exactly once.
 */
export async function endYearInReviewPreview(): Promise<void> {
  const override = localStorage.getItem(YEAR_REVIEW_NOW_KEY);
  localStorage.removeItem(YEAR_REVIEW_NOW_KEY);
  if (override) {
    const d = new Date(override);
    if (!Number.isNaN(d.getTime())) {
      const { reviewYear } = getYearInReviewState(d);
      await clearYearInReviewPromptFlag(reviewYear);
    }
  }
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

/** A session whose sets straddle an overnight gap carries a huge duration; cap each at 6 hours. */
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

export interface DrySpellPr {
  exerciseName: string;
  /** Date of the PR that ended the dry streak. */
  date: string;
  /** Date of the previous PR, where the dry streak began. */
  previousPrDate: string;
  gapDays: number;
  /** Sets of this exercise logged strictly between the two PR dates. */
  setsBetween: number;
  /** e1RM of the PR that broke the drought. */
  newE1RM: number;
  /** Where the lift ended the year; >= newE1RM when a later PR went higher. */
  yearBestE1RM: number;
  previousE1RM: number;
  newWeight: number | null;
  newReps: number;
}

export interface BiggestRepPr {
  exerciseName: string;
  date: string;
  newReps: number;
  previousReps: number;
}

export interface YearOnYearPr {
  name: string;
  /** Best e1RM across all years before the review year. */
  bestPriorE1RM: number;
  bestYearE1RM: number;
  /** (year - prior) / prior; negative when this year fell short. */
  relativeDiff: number;
  yearSetCount: number;
}

export interface DebutExercise {
  name: string;
  /** First date the exercise appears anywhere in the data. */
  firstDate: string;
  /** Best e1RM within 7 calendar days of the debut, inclusive. */
  firstWeekBestE1RM: number;
  yearBestE1RM: number;
  /** (yearBest - firstWeekBest) / firstWeekBest, always >= 0. */
  relativeGrowth: number;
  yearSetCount: number;
}

export interface BusiestMonth {
  monthIndex: number;
  name: string;
  count: number;
  unit: "sessions" | "training days";
}

export interface RepExtreme {
  name: string;
  avgReps: number;
  /** Same 15-bin structure as the overall repsHistogram. */
  histogram: number[];
  setCount: number;
}

export interface YearInReviewStats {
  reviewYear: number;
  totalCompletedSessions: number;
  totalTrainingSeconds: number;
  totalSets: number;
  totalReps: number;
  importedSetCount: number;
  /** Sets per rep count: index i = sets performed at i+1 reps, last bin = 15+. */
  repsHistogram: number[];
  /**
   * Rep-distribution outliers among the top 15 highest-volume exercises: the
   * lowest and highest average reps per set. Null with fewer than two
   * candidates.
   */
  repExtremes: { low: RepExtreme; high: RepExtreme } | null;
  /** Sets per day of the review year (native + imported), index = 0-based day-of-year. */
  dailySetCounts: number[];
  trainingDayCount: number;
  topExercises: TopExerciseStat[];
  /** Number of distinct exercise names trained in the review year. */
  distinctExerciseCount: number;
  /** Exercises trained both this year and before, this year's best vs all prior. */
  yearOnYearPrs: YearOnYearPr[];
  prUpCount: number;
  prDownCount: number;
  /** Exercises first trained this year. */
  debutExercises: DebutExercise[];
  /** The longest dry streak broken this year, by days and sets combined. */
  drySpellPr: DrySpellPr | null;
  biggestRepPr: BiggestRepPr | null;
  /** e1RM history of the spotlight exercise through the end of the review year, date-ascending, for the sparkline. */
  spotlightHistory: { date: string; value: number }[];
  monthlyActivityCounts: number[];
  monthsWithActivity: number;
  /** Months of the review year with at least one app-logged session or set. */
  nativeMonthCount: number;
  /** Months whose only data is imported history. */
  importedMonthCount: number;
  /**
   * Review-year months that predate all training history: empty months at the
   * start of the year, and only when no activity exists in any earlier year.
   * Interior gaps and post-history breaks are never counted.
   */
  preHistoryMonthCount: number;
  busiestMonth: BusiestMonth | null;
  longestWeeklyStreak: number;
  /** Monday-to-Sunday dates of the in-year streak; null when no streak. */
  longestWeeklyStreakRange: { start: string; end: string } | null;
  /** Longest weekly streak across all history up to the end of the review year. */
  allTimeLongestWeeklyStreak: number;
  /** Monday-to-Sunday dates of the all-time streak; null when no streak. */
  allTimeLongestWeeklyStreakRange: { start: string; end: string } | null;
  /**
   * Longest weekly streak that ended before the in-year streak began, for the
   * "you beat your all-time best" comparison. 0 when there is none.
   */
  previousBestWeeklyStreak: number;
  /** True when any completed session or imported set predates the review year. */
  hasPriorYearData: boolean;
  goldSessionCount: number;
  perfectWeekCount: number;
  aSeasonCount: number;
  seasonsCompleted: number;
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

/** UTC day count for a local "YYYY-MM-DD" date, so DST shifts can't skew gaps. */
function utcDayNumber(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/**
 * Monday-aligned week index for a local "YYYY-MM-DD" date. Day 0 (1970-01-01)
 * was a Thursday, so Mondays sit at day 4 + 7k.
 */
function mondayWeekIndex(date: string): number {
  return Math.floor((utcDayNumber(date) - 4) / 7);
}

interface WeekRun {
  length: number;
  startWeekIndex: number;
  endWeekIndex: number;
}

/**
 * Longest run of consecutive integers in an ascending-sorted list, with its
 * boundaries; the first maximal run wins ties. Null on empty input.
 */
function longestConsecutiveRun(sortedWeekIndexes: number[]): WeekRun | null {
  let best: WeekRun | null = null;
  let runStart = 0;
  let run = 0;
  let prev: number | null = null;
  for (const w of sortedWeekIndexes) {
    if (prev != null && w === prev + 1) {
      run++;
    } else {
      run = 1;
      runStart = w;
    }
    prev = w;
    if (best == null || run > best.length) {
      best = { length: run, startWeekIndex: runStart, endWeekIndex: w };
    }
  }
  return best;
}

/** "YYYY-MM-DD" for a UTC day number (inverse of utcDayNumber). */
function isoFromDayNumber(dayNumber: number): string {
  const d = new Date(dayNumber * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Monday-to-Sunday calendar range of a run of Monday-aligned week indexes. */
function weekRunRange(run: WeekRun): { start: string; end: string } {
  return {
    start: isoFromDayNumber(run.startWeekIndex * 7 + 4),
    end: isoFromDayNumber(run.endWeekIndex * 7 + 10),
  };
}

export async function computeYearInReviewStats(
  reviewYear: number
): Promise<YearInReviewStats> {
  const prefix = `${reviewYear}-`;
  const inYear = (date: string) => date.startsWith(prefix);
  const reviewYearStart = `${reviewYear}-01-01`;
  const reviewYearEnd = `${reviewYear + 1}-01-01`;

  const [sessions, weeks, seasons, setRecords, prEvents] = await Promise.all([
    getAll<SessionInstance>(STORE_NAMES.sessionInstances),
    getAll<WeekInstance>(STORE_NAMES.weekInstances),
    getAll<SeasonInstance>(STORE_NAMES.seasonInstances),
    getAllSetRecords(),
    getAllTimePREvents(),
  ]);

  // ── Sessions ──
  const yearSessions = sessions.filter(
    (s) => s.status === "completed" && inYear(sessionCompletedDate(s))
  );
  const totalCompletedSessions = yearSessions.length;

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
  const repsHistogram = new Array<number>(15).fill(0);
  const jan1Ms = Date.UTC(reviewYear, 0, 1);
  const daysInYear = Math.round((Date.UTC(reviewYear + 1, 0, 1) - jan1Ms) / 86400000);
  const dailySetCounts = new Array<number>(daysInYear).fill(0);
  const trainingDays = new Set<string>();
  for (const r of yearSets) {
    const reps = r.reps!;
    totalReps += reps;
    if (r.source === "imported") importedSetCount++;
    repsHistogram[Math.min(reps, 15) - 1]++;
    const [y, m, d] = r.date.split("-").map(Number);
    dailySetCounts[(Date.UTC(y, m - 1, d) - jan1Ms) / 86400000]++;
    trainingDays.add(r.date);
  }
  const trainingDayCount = trainingDays.size;

  // ── Month provenance (for the cover's scope lines): a month is "native" if
  // the app logged anything in it, "imported" if its only data is imported
  // history. Empty months only count as pre-history when they sit before the
  // first data month AND no activity exists in any earlier year, so neither a
  // mid-year gap nor a break after a prior-year history is miscounted. ──
  const monthHasNative = new Array<boolean>(12).fill(false);
  const monthHasImported = new Array<boolean>(12).fill(false);
  const monthOf = (date: string) => Number(date.slice(5, 7)) - 1;
  for (const s of yearSessions) monthHasNative[monthOf(sessionCompletedDate(s))] = true;
  for (const r of yearSets) {
    if (r.source === "imported") monthHasImported[monthOf(r.date)] = true;
    else monthHasNative[monthOf(r.date)] = true;
  }
  let nativeMonthCount = 0;
  let importedMonthCount = 0;
  for (let i = 0; i < 12; i++) {
    if (monthHasNative[i]) nativeMonthCount++;
    else if (monthHasImported[i]) importedMonthCount++;
  }
  let preHistoryMonthCount = 0;
  while (
    preHistoryMonthCount < 12 &&
    !monthHasNative[preHistoryMonthCount] &&
    !monthHasImported[preHistoryMonthCount]
  ) {
    preHistoryMonthCount++;
  }
  const hasPreYearActivity =
    sessions.some(
      (s) => s.status === "completed" && sessionCompletedDate(s) < reviewYearStart
    ) ||
    setRecords.some(
      (r) =>
        r.reps != null &&
        r.reps > 0 &&
        (r.source === "imported" || r.sessionStatus === "completed") &&
        r.date < reviewYearStart
    );
  if (hasPreYearActivity) preHistoryMonthCount = 0;

  // ── Top exercises (all sets: warmup/working classification is impossible
  // for imported history, so the split is deliberately not attempted) ──
  interface ExerciseAgg {
    setCount: number;
    repCount: number;
    tonnageKg: number;
    repsHistogram: number[];
    casings: Map<string, number>;
  }
  const byExercise = new Map<string, ExerciseAgg>();
  for (const r of yearSets) {
    const key = normalizeName(r.exerciseName);
    let agg = byExercise.get(key);
    if (!agg) {
      agg = {
        setCount: 0,
        repCount: 0,
        tonnageKg: 0,
        repsHistogram: new Array<number>(15).fill(0),
        casings: new Map(),
      };
      byExercise.set(key, agg);
    }
    agg.setCount++;
    agg.repCount += r.reps!;
    agg.repsHistogram[Math.min(r.reps!, 15) - 1]++;
    if (r.weight != null && r.weight > 0) agg.tonnageKg += r.weight * r.reps!;
    const casing = r.exerciseName.trim();
    agg.casings.set(casing, (agg.casings.get(casing) ?? 0) + 1);
  }
  const displayName = (casings: Map<string, number>): string => {
    let best = "";
    let bestCount = -1;
    for (const [casing, count] of casings) {
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
      displayName(a.casings).localeCompare(displayName(b.casings))
  );
  const topExercises: TopExerciseStat[] = rankedExercises.slice(0, 10).map((agg) => ({
    name: displayName(agg.casings),
    setCount: agg.setCount,
    repCount: agg.repCount,
    tonnageKg: agg.tonnageKg,
  }));
  const distinctExerciseCount = byExercise.size;

  // ── Rep extremes: among the top 15 highest-volume exercises, the lowest and
  // highest average reps per set. The Grind slide only shows the pair when
  // their averages sit at least 5 reps apart. ──
  let repExtremes: YearInReviewStats["repExtremes"] = null;
  {
    const pool = rankedExercises.slice(0, 15);
    const avg = (agg: ExerciseAgg) => agg.repCount / agg.setCount;
    let low = pool[0];
    let high = pool[0];
    for (const agg of pool) {
      if (avg(agg) < avg(low)) low = agg;
      if (avg(agg) > avg(high)) high = agg;
    }
    if (pool.length >= 2 && low !== high) {
      const toExtreme = (agg: ExerciseAgg): RepExtreme => ({
        name: displayName(agg.casings),
        avgReps: avg(agg),
        histogram: agg.repsHistogram,
        setCount: agg.setCount,
      });
      repExtremes = { low: toExtreme(low), high: toExtreme(high) };
    }
  }

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

  // Distinct in-year training dates from either source; trainingDays misses a
  // completed session with no logged sets, so union session dates in.
  const activeDays = new Set(trainingDays);
  for (const s of yearSessions) activeDays.add(sessionCompletedDate(s));

  // ── Year-on-year PRs and debuts ──
  // A PR is this year's best e1RM against the best across all prior years, in
  // either direction. An exercise first trained this year is a debut instead:
  // its first-week best against its best of the year. Bodyweight-only
  // exercises have no e1RM and appear in neither list.
  interface YoYAgg {
    casings: Map<string, number>;
    bestPriorE1RM: number;
    bestYearE1RM: number;
    firstEverDate: string | null;
    yearSetCount: number;
    /** In-year e1RM points, for the debut first-week best. */
    yearPoints: { date: string; e1rm: number }[];
    /** Set dates across all years, for dry-streak measurement. */
    allDates: string[];
  }
  const yoyByExercise = new Map<string, YoYAgg>();
  for (const r of setRecords) {
    if (r.reps == null || r.reps <= 0) continue;
    if (r.source !== "imported" && r.sessionStatus !== "completed") continue;
    // A January viewing must not leak new-year sets into the review.
    if (r.date >= reviewYearEnd) continue;
    const key = normalizeName(r.exerciseName);
    let agg = yoyByExercise.get(key);
    if (!agg) {
      agg = {
        casings: new Map(),
        bestPriorE1RM: 0,
        bestYearE1RM: 0,
        firstEverDate: null,
        yearSetCount: 0,
        yearPoints: [],
        allDates: [],
      };
      yoyByExercise.set(key, agg);
    }
    if (agg.firstEverDate == null || r.date < agg.firstEverDate) {
      agg.firstEverDate = r.date;
    }
    agg.allDates.push(r.date);
    const e1rm =
      r.weight != null && r.weight > 0
        ? calculateEstimatedOneRepMax(r.weight, r.reps)
        : null;
    if (inYear(r.date)) {
      agg.yearSetCount++;
      const casing = r.exerciseName.trim();
      agg.casings.set(casing, (agg.casings.get(casing) ?? 0) + 1);
      if (e1rm != null) {
        agg.yearPoints.push({ date: r.date, e1rm });
        if (e1rm > agg.bestYearE1RM) agg.bestYearE1RM = e1rm;
      }
    } else if (e1rm != null && e1rm > agg.bestPriorE1RM) {
      agg.bestPriorE1RM = e1rm;
    }
  }

  const yearOnYearPrs: YearOnYearPr[] = [];
  const debutExercises: DebutExercise[] = [];
  for (const agg of yoyByExercise.values()) {
    // Mirrors the old strength-progress rule: one or two sets is noise.
    if (agg.bestYearE1RM <= 0 || agg.yearSetCount < 3) continue;
    const name = displayName(agg.casings);
    if (agg.bestPriorE1RM > 0) {
      yearOnYearPrs.push({
        name,
        bestPriorE1RM: agg.bestPriorE1RM,
        bestYearE1RM: agg.bestYearE1RM,
        relativeDiff: (agg.bestYearE1RM - agg.bestPriorE1RM) / agg.bestPriorE1RM,
        yearSetCount: agg.yearSetCount,
      });
    } else if (agg.firstEverDate != null && inYear(agg.firstEverDate)) {
      const debutDay = utcDayNumber(agg.firstEverDate);
      let firstWeekBest = 0;
      for (const p of agg.yearPoints) {
        if (utcDayNumber(p.date) - debutDay <= 6 && p.e1rm > firstWeekBest) {
          firstWeekBest = p.e1rm;
        }
      }
      if (firstWeekBest <= 0) continue;
      debutExercises.push({
        name,
        firstDate: agg.firstEverDate,
        firstWeekBestE1RM: firstWeekBest,
        yearBestE1RM: agg.bestYearE1RM,
        relativeGrowth: (agg.bestYearE1RM - firstWeekBest) / firstWeekBest,
        yearSetCount: agg.yearSetCount,
      });
    }
  }
  const bySetCountDesc = (
    a: { yearSetCount: number; name: string },
    b: { yearSetCount: number; name: string }
  ) => b.yearSetCount - a.yearSetCount || a.name.localeCompare(b.name);
  yearOnYearPrs.sort(bySetCountDesc);
  debutExercises.sort(bySetCountDesc);
  const prUpCount = yearOnYearPrs.filter((p) => p.relativeDiff > 0).length;
  const prDownCount = yearOnYearPrs.filter((p) => p.relativeDiff < 0).length;

  // ── The Big One: the longest dry streak broken this year ──
  // Every in-year e1RM PR event ends a dry streak that began at the previous
  // PR. Size each streak by days elapsed and by sets logged between the two
  // PRs, normalize both against the biggest candidate, and spotlight the
  // largest combined score. Percentage uplift is deliberately not a factor:
  // it over-rewards barely-trained exercises.
  let drySpellPr: DrySpellPr | null = null;
  {
    const candidates: DrySpellPr[] = [];
    for (const e of yearPrs) {
      if (e.prType !== "e1rm" || e.newE1RM == null) continue;
      if (e.previousE1RM == null || e.previousE1RM <= 0) continue;
      if (e.previousDate == null) continue;
      const agg = yoyByExercise.get(normalizeName(e.exerciseName));
      const dates = agg?.allDates ?? [];
      let setsBetween = 0;
      for (const d of dates) {
        if (d > e.previousDate && d < e.date) setsBetween++;
      }
      candidates.push({
        exerciseName: e.exerciseName,
        date: e.date,
        previousPrDate: e.previousDate,
        gapDays: utcDayNumber(e.date) - utcDayNumber(e.previousDate),
        setsBetween,
        newE1RM: e.newE1RM,
        yearBestE1RM: Math.max(agg?.bestYearE1RM ?? 0, e.newE1RM),
        previousE1RM: e.previousE1RM,
        newWeight: e.newWeight,
        newReps: e.newReps,
      });
    }
    const maxGap = Math.max(...candidates.map((c) => c.gapDays), 0);
    const maxSets = Math.max(...candidates.map((c) => c.setsBetween), 0);
    const score = (c: DrySpellPr) =>
      (maxGap > 0 ? c.gapDays / maxGap : 0) +
      (maxSets > 0 ? c.setsBetween / maxSets : 0);
    for (const c of candidates) {
      if (
        drySpellPr == null ||
        score(c) > score(drySpellPr) ||
        (score(c) === score(drySpellPr) &&
          (c.gapDays > drySpellPr.gapDays ||
            (c.gapDays === drySpellPr.gapDays && c.date < drySpellPr.date)))
      ) {
        drySpellPr = c;
      }
    }
  }

  let spotlightHistory: { date: string; value: number }[] = [];
  if (drySpellPr) {
    const history = await getExerciseSessionHistory(drySpellPr.exerciseName);
    // Clip at the end of the review year so a January viewing doesn't paint
    // new-year sessions as part of the review-year run.
    spotlightHistory = history
      .map((dp) =>
        dp.topEstimatedOneRepMax != null && dp.topEstimatedOneRepMax > 0
          ? { date: dp.date, value: dp.topEstimatedOneRepMax }
          : null
      )
      .filter(
        (p): p is { date: string; value: number } =>
          p != null && p.date < reviewYearEnd
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // ── Months. With imported data present, count distinct training days per
  // month so imported months aren't rendered empty (a date with both native
  // and imported work counts once); with native-only data, count sessions so
  // double sessions still show as 2. ──
  const monthlyActivityCounts = new Array<number>(12).fill(0);
  const monthUnit: BusiestMonth["unit"] =
    importedSetCount > 0 ? "training days" : "sessions";
  if (monthUnit === "sessions") {
    for (const s of yearSessions) {
      const monthIndex = Number(sessionCompletedDate(s).slice(5, 7)) - 1;
      monthlyActivityCounts[monthIndex]++;
    }
  } else {
    for (const d of activeDays) {
      monthlyActivityCounts[Number(d.slice(5, 7)) - 1]++;
    }
  }
  const monthsWithActivity = monthlyActivityCounts.filter((c) => c > 0).length;
  let busiestMonth: BusiestMonth | null = null;
  for (let i = 0; i < 12; i++) {
    if (monthlyActivityCounts[i] > (busiestMonth?.count ?? 0)) {
      busiestMonth = {
        monthIndex: i,
        name: MONTH_NAMES[i],
        count: monthlyActivityCounts[i],
        unit: monthUnit,
      };
    }
  }

  // ── Weekly streaks. In-year: training days (either source) within the
  // review year; a run alive at Jan 1 restarts, so one year's review is
  // reproducible from that year's data. All-time: full history clipped at the
  // end of the review year, so a prior run can span a Jan 1 boundary. ──
  const inYearRun = longestConsecutiveRun(
    [...new Set([...activeDays].map(mondayWeekIndex))].sort((a, b) => a - b)
  );
  const longestWeeklyStreak = inYearRun?.length ?? 0;
  const longestWeeklyStreakRange = inYearRun ? weekRunRange(inYearRun) : null;

  const allActiveDates = new Set<string>();
  for (const s of sessions) {
    if (s.status !== "completed") continue;
    const d = sessionCompletedDate(s);
    if (d < reviewYearEnd) allActiveDates.add(d);
  }
  for (const r of setRecords) {
    if (r.source !== "imported") continue;
    if (r.reps == null || r.reps <= 0) continue;
    if (r.date < reviewYearEnd) allActiveDates.add(r.date);
  }
  const hasPriorYearData = [...allActiveDates].some((d) => d < reviewYearStart);
  const allWeekIndexes = [...new Set([...allActiveDates].map(mondayWeekIndex))].sort(
    (a, b) => a - b
  );
  const allTimeRun = longestConsecutiveRun(allWeekIndexes);
  const allTimeLongestWeeklyStreak = allTimeRun?.length ?? 0;
  const allTimeLongestWeeklyStreakRange = allTimeRun ? weekRunRange(allTimeRun) : null;
  const previousBestWeeklyStreak = inYearRun
    ? longestConsecutiveRun(
        allWeekIndexes.filter((w) => w < inYearRun.startWeekIndex)
      )?.length ?? 0
    : 0;

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

  // ── Time in the gym: first-to-last-set span per session (lazily backfilled
  // onto the record; sessions with no usable set timestamps count zero). Runs
  // after the metrics loops above so the two lazy backfill writes to the same
  // records can't clobber each other. ──
  let totalTrainingSeconds = 0;
  for (const s of yearSessions) {
    const seconds = (await getSessionDuration(s)) ?? 0;
    totalTrainingSeconds += Math.min(Math.max(seconds, 0), DURATION_CAP_SECONDS);
  }

  return {
    reviewYear,
    totalCompletedSessions,
    totalTrainingSeconds,
    totalSets,
    totalReps,
    importedSetCount,
    repsHistogram,
    repExtremes,
    dailySetCounts,
    trainingDayCount,
    topExercises,
    distinctExerciseCount,
    yearOnYearPrs,
    prUpCount,
    prDownCount,
    debutExercises,
    drySpellPr,
    biggestRepPr,
    spotlightHistory,
    monthlyActivityCounts,
    monthsWithActivity,
    nativeMonthCount,
    importedMonthCount,
    preHistoryMonthCount,
    busiestMonth,
    longestWeeklyStreak,
    longestWeeklyStreakRange,
    allTimeLongestWeeklyStreak,
    allTimeLongestWeeklyStreakRange,
    previousBestWeeklyStreak,
    hasPriorYearData,
    goldSessionCount,
    perfectWeekCount,
    aSeasonCount,
    seasonsCompleted,
    hasMinimumData: totalCompletedSessions >= 1 || totalSets >= 1,
  };
}
