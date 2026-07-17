import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  computeYearInReviewStats,
  getYearInReviewState,
  type YearInReviewStats,
  type StrengthMetric,
} from "../services/yearInReview";
import { formatDuration } from "../services/sessionMetrics";
import "./YearInReviewPage.css";

const numberFormat = new Intl.NumberFormat("en-GB");

function formatInt(n: number): string {
  return numberFormat.format(Math.round(n));
}

function formatE1RM(v: number): string {
  const rounded = Math.round(v * 10) / 10;
  return `${rounded}`;
}

function formatGainPct(relativeGain: number): string {
  const pct = relativeGain * 100;
  if (pct < 10) {
    const oneDp = Math.round(pct * 10) / 10;
    return `${oneDp}`;
  }
  return `${Math.round(pct)}`;
}

/** Caption for the dry-streak spotlight, tiered by how long the drought was. */
function drySpellCaption(pr: NonNullable<YearInReviewStats["drySpellPr"]>): string {
  const sets =
    pr.setsBetween > 0 ? ` ${formatInt(pr.setsBetween)} sets in the making.` : "";
  if (pr.gapDays >= 365) {
    const years = Math.floor(pr.gapDays / 365);
    return `${ordinalDate(pr.date)}. Your first ${pr.exerciseName} PR in over ${
      years === 1 ? "a year" : `${years} years`
    }.${sets}`;
  }
  if (pr.gapDays >= 60) {
    const months = Math.round(pr.gapDays / 30.44);
    return `${ordinalDate(pr.date)}. ${months} months between bests.${sets}`;
  }
  return `${ordinalDate(pr.date)}. The longest-standing best you broke this year.`;
}

/** "2024-10-14" -> "14th Oct 2024", for ranges that can leave the review year. */
function ordinalDateWithYear(date: string): string {
  return `${ordinalDate(date)} ${date.slice(0, 4)}`;
}

/**
 * "3rd Mar to 12th May", adding years only when the range spans two calendar
 * years (a streak's final week can end in early January).
 */
function formatDateRange(start: string, end: string): string {
  if (start.slice(0, 4) === end.slice(0, 4)) {
    return `${ordinalDate(start)} to ${ordinalDate(end)}`;
  }
  return `${ordinalDateWithYear(start)} to ${ordinalDateWithYear(end)}`;
}

/** "2026-10-14" -> "14th Oct" */
function ordinalDate(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const v = d % 100;
  const suffix = ["th", "st", "nd", "rd"][(v - 20) % 10] || ["th", "st", "nd", "rd"][v] || "th";
  return `${d}${suffix} ${months[m - 1]}`;
}

// ─── Count-up (the deck's only JS animation) ─────────────────────────────────

function useCountUp(target: number, durationMs = 600): number {
  const [value, setValue] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ? target : 0
  );
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

// ─── Slides ───────────────────────────────────────────────────────────────────

const NUMBER_WORDS = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six",
  "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
];

/**
 * Scope sentences for the cover: where the year's data came from. One
 * independent sentence per data state, each only present when that state has
 * months (pre-history, CSV-imported, app-logged).
 */
function coverScopeSentences(stats: YearInReviewStats): string[] {
  const preHistory = stats.preHistoryMonthCount;
  const imported = stats.importedMonthCount;
  const native = stats.nativeMonthCount;
  const sentences: string[] = [];
  if (preHistory > 0) {
    sentences.push(
      preHistory === 1
        ? "One month predates training history."
        : `${NUMBER_WORDS[preHistory]} months predate training history.`
    );
  }
  if (imported > 0) {
    sentences.push(
      imported === 1
        ? "One month was imported from CSVs."
        : `${NUMBER_WORDS[imported]} months were imported from CSVs.`
    );
  }
  if (native > 0) {
    sentences.push(
      native === 1
        ? "One month came from data logged directly in the app."
        : `${NUMBER_WORDS[native]} months came from data logged directly in the app.`
    );
  }
  return sentences;
}

function CoverSlide({ stats }: { stats: YearInReviewStats }) {
  return (
    <div className="yir-slide-body yir-slide-body--cover">
      <p className="yir-eyebrow yir-reveal">Year in review</p>
      <p className="yir-display yir-display--year yir-reveal yir-reveal--2">
        {stats.reviewYear}
      </p>
      <svg
        className="yir-barbell yir-reveal yir-reveal--3"
        viewBox="0 0 220 40"
        aria-hidden="true"
      >
        <path
          className="yir-barbell__path"
          pathLength={1}
          d="M6 20 H50 M50 8 V32 M62 4 V36 M62 20 H158 M158 4 V36 M170 8 V32 M170 20 H214"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
      <div className="yir-sub yir-cover-scope yir-reveal yir-reveal--4">
        {coverScopeSentences(stats).map((sentence) => (
          <p key={sentence} className="yir-cover-scope__line">
            {sentence}
          </p>
        ))}
      </div>
      <p className="yir-hint">Tap to continue</p>
    </div>
  );
}

/**
 * GitHub-style contribution calendar for an arbitrary day range: columns are
 * Monday-aligned weeks, rows Mon to Sun, cells shaded by that day's set count
 * (native + imported). `max` is always passed in, never derived, so every
 * calendar on screen shares one intensity scale.
 */
function ContributionCalendar({
  counts,
  firstDayMs,
  max,
  variant,
}: {
  counts: number[];
  /** UTC ms of the range's first day, for weekday alignment. */
  firstDayMs: number;
  /** Shared shading ceiling: the full year's busiest day. */
  max: number;
  variant: "quarter" | "month";
}) {
  // Monday-based weekday of the first day: UTC day 0 was a Thursday, offset 3.
  const lead = (Math.floor(firstDayMs / 86400000) + 3) % 7;
  const total = Math.ceil((lead + counts.length) / 7) * 7;
  return (
    <div className={`yir-cal yir-cal--${variant}`} aria-hidden="true">
      {Array.from({ length: total }, (_, i) => {
        const day = i - lead;
        if (day < 0 || day >= counts.length) {
          return <span key={i} className="yir-cal__cell yir-cal__cell--pad" />;
        }
        const count = counts[day];
        const level = count === 0 ? 0 : Math.min(3, Math.ceil((count / max) * 3));
        return (
          <span
            key={i}
            className={`yir-cal__cell yir-cal__cell--l${level}`}
            style={{ "--c": Math.floor(i / 7) } as React.CSSProperties}
          />
        );
      })}
    </div>
  );
}

/** Slice of dailySetCounts covering months [startMonth, endMonthExcl). */
function monthRangeSlice(
  stats: YearInReviewStats,
  startMonth: number,
  endMonthExcl: number
): { counts: number[]; firstDayMs: number } {
  const jan1Ms = Date.UTC(stats.reviewYear, 0, 1);
  const firstDayMs = Date.UTC(stats.reviewYear, startMonth, 1);
  const from = (firstDayMs - jan1Ms) / 86400000;
  const to = (Date.UTC(stats.reviewYear, endMonthExcl, 1) - jan1Ms) / 86400000;
  return { counts: stats.dailySetCounts.slice(from, to), firstDayMs };
}

const QUARTER_LABELS = ["Jan-Mar", "Apr-Jun", "Jul-Sep", "Oct-Dec"];

function QuarterCalendars({ stats }: { stats: YearInReviewStats }) {
  const max = Math.max(...stats.dailySetCounts, 1);
  return (
    <div className="yir-cal-quarters" aria-hidden="true">
      {QUARTER_LABELS.map((label, q) => {
        const { counts, firstDayMs } = monthRangeSlice(stats, q * 3, q * 3 + 3);
        return (
          <div key={label} className="yir-cal-quarters__item">
            <ContributionCalendar
              counts={counts}
              firstDayMs={firstDayMs}
              max={max}
              variant="quarter"
            />
            <span className="yir-cal-quarters__label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function SessionsSlide({ stats }: { stats: YearInReviewStats }) {
  const n = stats.totalCompletedSessions;
  if (n === 0) {
    return (
      <div className="yir-slide-body">
        <p className="yir-eyebrow yir-reveal">Showing up</p>
        <p className="yir-display yir-reveal yir-reveal--2">
          {formatInt(stats.trainingDayCount)}
          <span className="yir-display__unit">
            training {stats.trainingDayCount === 1 ? "day" : "days"}
          </span>
        </p>
        <QuarterCalendars stats={stats} />
        <p className="yir-sub yir-reveal yir-reveal--3">
          Rebuilt from your imported history.
        </p>
      </div>
    );
  }
  return (
    <div className="yir-slide-body">
      <p className="yir-eyebrow yir-reveal">Showing up</p>
      <p className="yir-display yir-reveal yir-reveal--2">
        {formatInt(n)}
        <span className="yir-display__unit">{n === 1 ? "session" : "sessions"}</span>
      </p>
      {stats.totalTrainingSeconds > 0 && (
        <p className="yir-second-line yir-reveal yir-reveal--3">
          {formatDuration(stats.totalTrainingSeconds)} in the gym
        </p>
      )}
      <QuarterCalendars stats={stats} />
      {stats.totalTrainingSeconds > 0 && (
        <p className="yir-sub yir-reveal yir-reveal--4">
          That's an average of{" "}
          {formatDuration(Math.round(stats.totalTrainingSeconds / n))} per
          session.
        </p>
      )}
    </div>
  );
}

// Sparse axis labels for the reps histogram: only 1, 5, 10 and 15+ are marked.
// Unlabelled columns get a non-breaking space so every label row keeps height.
const REP_BIN_LABELS: Record<number, string> = { 0: "1", 4: "5", 9: "10", 14: "15+" };

/**
 * The fixed 15-bin reps distribution. Every instance spans the same 1 to 15+
 * x-axis by construction, so side-by-side histograms compare directly.
 */
function RepsHistogram({ bins, compact }: { bins: number[]; compact?: boolean }) {
  const maxBin = Math.max(...bins, 1);
  const modalBin = bins.indexOf(maxBin);
  return (
    <div
      className={`yir-histogram yir-histogram--reps${
        compact ? " yir-histogram--compact" : ""
      }`}
      aria-hidden="true"
    >
      {bins.map((count, i) => (
        <div key={i} className="yir-histogram__col">
          <span
            className={
              i === modalBin
                ? "yir-histogram__bar yir-histogram__bar--winner"
                : "yir-histogram__bar"
            }
            style={
              {
                "--i": i,
                height: `${Math.max((count / maxBin) * 100, count > 0 ? 6 : 2)}%`,
              } as React.CSSProperties
            }
          />
          <span className="yir-histogram__label">
            {REP_BIN_LABELS[i] ?? " "}
          </span>
        </div>
      ))}
    </div>
  );
}

function SetsRepsSlide({ stats }: { stats: YearInReviewStats }) {
  const target = stats.totalReps;
  const shown = useCountUp(target);
  const avgReps =
    stats.totalSets > 0 ? Math.round(stats.totalReps / stats.totalSets) : 0;
  const cmp = stats.repExtremes;
  const compare = cmp != null && cmp.high.avgReps - cmp.low.avgReps >= 5 ? cmp : null;
  // Size from the final value, not the animating one, so the count-up never
  // crosses a wrap threshold mid-animation.
  const long = formatInt(target).length >= 7;
  return (
    <div className="yir-slide-body">
      <p className="yir-eyebrow yir-reveal">The grind</p>
      <p
        className={`yir-display yir-reveal yir-reveal--2${long ? " yir-display--long" : ""}`}
      >
        {formatInt(shown)}
        <span className="yir-display__unit">{target === 1 ? "rep" : "reps"}</span>
      </p>
      <p className="yir-second-line yir-reveal yir-reveal--3">
        {formatInt(stats.totalSets)} {stats.totalSets === 1 ? "set" : "sets"}
      </p>
      {stats.totalSets >= 20 && <RepsHistogram bins={stats.repsHistogram} />}
      {avgReps > 0 && (
        <p className="yir-sub yir-reveal yir-reveal--4">
          That's an average of {avgReps} {avgReps === 1 ? "rep" : "reps"} per
          set.
        </p>
      )}
      {stats.totalSets >= 20 && compare && (
        <>
          <div className="yir-hist-compare yir-reveal yir-reveal--4">
            {[compare.low, compare.high].map((ex) => (
              <div key={ex.name} className="yir-hist-compare__item">
                <span className="yir-hist-compare__caption">{ex.name}</span>
                <RepsHistogram bins={ex.histogram} compact />
              </div>
            ))}
          </div>
          <p className="yir-footnote yir-reveal yir-reveal--4">
            Some exercises, like {compare.low.name}, had a lower average rep
            count, whereas some exercises, like {compare.high.name}, had a
            higher average rep count.
          </p>
        </>
      )}
    </div>
  );
}

function BusiestMonthSlide({ stats }: { stats: YearInReviewStats }) {
  const busiest = stats.busiestMonth!;
  const max = Math.max(...stats.monthlyActivityCounts, 1);
  const monthLetters = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  const monthCal = monthRangeSlice(stats, busiest.monthIndex, busiest.monthIndex + 1);
  return (
    <div className="yir-slide-body">
      <p className="yir-eyebrow yir-reveal">Peak month</p>
      <p className="yir-display yir-reveal yir-reveal--2">{busiest.name}</p>
      <div className="yir-histogram" aria-hidden="true">
        {stats.monthlyActivityCounts.map((count, i) => (
          <div key={i} className="yir-histogram__col">
            <span
              className={
                i === busiest.monthIndex
                  ? "yir-histogram__bar yir-histogram__bar--winner"
                  : "yir-histogram__bar"
              }
              style={
                {
                  "--i": i,
                  height: `${Math.max((count / max) * 100, count > 0 ? 6 : 2)}%`,
                } as React.CSSProperties
              }
            />
            <span className="yir-histogram__label">{monthLetters[i]}</span>
          </div>
        ))}
      </div>
      <p className="yir-sub yir-reveal yir-reveal--3">
        {formatInt(busiest.count)}{" "}
        {busiest.unit === "sessions"
          ? busiest.count === 1
            ? "session"
            : "sessions"
          : busiest.count === 1
            ? "training day"
            : "training days"}
        . Your biggest month of the year.
      </p>
      <ContributionCalendar
        counts={monthCal.counts}
        firstDayMs={monthCal.firstDayMs}
        max={Math.max(...stats.dailySetCounts, 1)}
        variant="month"
      />
    </div>
  );
}

function StreakSlide({ stats }: { stats: YearInReviewStats }) {
  const streak = stats.longestWeeklyStreak;
  const allTime = stats.allTimeLongestWeeklyStreak;
  const prevBest = stats.previousBestWeeklyStreak;
  const drawn = Math.min(streak, 16);
  const yearRange = stats.longestWeeklyStreakRange;
  const allTimeRange = stats.allTimeLongestWeeklyStreakRange;
  const yearDates = yearRange
    ? formatDateRange(yearRange.start, yearRange.end)
    : null;
  // The all-time run can only exceed the in-year one when older data exists,
  // so with prior-year data these are the doc's conditions 1 and 2; without
  // it, condition 3 (no comparison at all).
  const beatenByAllTime = stats.hasPriorYearData && allTime > streak;
  const beatAllTime = stats.hasPriorYearData && allTime <= streak;
  return (
    <div className="yir-slide-body">
      <p className="yir-eyebrow yir-reveal">Consistency</p>
      <p className="yir-display yir-display--medium yir-reveal yir-reveal--2">
        {streak} weeks in a row
      </p>
      <div className="yir-chain" aria-hidden="true">
        {Array.from({ length: drawn }, (_, i) => (
          <span
            key={i}
            className="yir-chain__link"
            style={{ "--i": i } as React.CSSProperties}
          />
        ))}
        {streak > drawn && <span className="yir-chain__more">+{streak - drawn}</span>}
      </div>
      <p className="yir-sub yir-reveal yir-reveal--3">
        {yearDates
          ? `Your longest run this year: ${yearDates}.`
          : "Your longest run this year."}
      </p>
      {(beatenByAllTime || beatAllTime) && (
        <>
          <p className="yir-second-line yir-reveal yir-reveal--4">
            All-time best: {allTime} weeks
          </p>
          <p className="yir-sub yir-reveal yir-reveal--4">
            {beatenByAllTime
              ? allTimeRange
                ? `${formatDateRange(allTimeRange.start, allTimeRange.end)}.`
                : ""
              : prevBest > 0
                ? `You beat your all-time streak this year with a run of ${streak} weeks; your best streak before then was ${prevBest} ${prevBest === 1 ? "week" : "weeks"}.`
                : `You set your all-time streak this year with a run of ${streak} weeks.`}
          </p>
        </>
      )}
    </div>
  );
}

function TopExerciseSlide({ stats }: { stats: YearInReviewStats }) {
  const top = stats.topExercises[0];
  const runnersUp = stats.topExercises.slice(1, 3);
  return (
    <div className="yir-slide-body">
      <p className="yir-eyebrow yir-reveal">Your number one</p>
      <p className="yir-display yir-display--stamp yir-display--medium">{top.name}</p>
      <p className="yir-sub yir-reveal yir-reveal--3">
        {formatInt(top.setCount)} sets this year, more than any other exercise.
      </p>
      {runnersUp.length >= 2 && (
        <ul className="yir-runner-list yir-reveal yir-reveal--4">
          {runnersUp.map((ex, i) => (
            <li key={ex.name} className="yir-runner-list__item">
              <span className="yir-runner-list__rank">{i + 2}.</span> {ex.name}
              <span className="yir-runner-list__count">
                {formatInt(ex.setCount)} sets
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ExerciseSplitSlide({ stats }: { stats: YearInReviewStats }) {
  const topExercises = stats.topExercises.slice(0, 10);
  const topSets = topExercises.reduce((sum, ex) => sum + ex.setCount, 0);
  const rows = topExercises.map((ex) => ({
    name: ex.name,
    share: stats.totalSets > 0 ? ex.setCount / stats.totalSets : 0,
  }));
  const restSets = stats.totalSets - topSets;
  if (restSets > 0) {
    rows.push({ name: "Everything else", share: restSets / stats.totalSets });
  }
  const topShare = rows[0]?.share ?? 0;
  const maxShare = Math.max(...rows.map((r) => r.share), 0.01);
  return (
    <div className="yir-slide-body">
      <p className="yir-eyebrow yir-reveal">Where the work went</p>
      <p className="yir-display yir-reveal yir-reveal--2">
        {Math.round(topShare * 100)}%
      </p>
      <p className="yir-second-line yir-reveal yir-reveal--3">
        of your year went to {rows[0]?.name}
      </p>
      <div className="yir-split yir-split--exercises">
        {rows.map((g, i) => (
          <div key={g.name} className="yir-split__row">
            <span className="yir-split__name">{g.name}</span>
            <span className="yir-split__track">
              <span
                className={
                  i === 0 ? "yir-split__bar yir-split__bar--top" : "yir-split__bar"
                }
                style={
                  {
                    "--i": i,
                    "--w": `${Math.max((g.share / maxShare) * 100, 4)}%`,
                  } as React.CSSProperties
                }
              />
            </span>
            <span className="yir-split__pct">{Math.round(g.share * 100)}%</span>
          </div>
        ))}
      </div>
      <p className="yir-sub yir-reveal yir-reveal--4">
        Across {formatInt(stats.distinctExerciseCount)} different exercises.
      </p>
    </div>
  );
}

const STRENGTH_METRIC_LABELS: Record<StrengthMetric, string> = {
  heaviest: "Heaviest lift",
  biggestPctGain: "Biggest percentage gain",
  biggestRawGain: "Biggest raw gain",
  topDebut: "Highest-volume debut",
  dryStreakBroken: "Longest dry streak broken",
};

/** Short, factual duration for the dry-streak detail line. */
function formatGapDuration(gapDays: number): string {
  if (gapDays >= 365) {
    const years = Math.floor(gapDays / 365);
    return years === 1 ? "a year" : `${years} years`;
  }
  if (gapDays >= 60) {
    return `${Math.round(gapDays / 30.44)} months`;
  }
  return `${gapDays} ${gapDays === 1 ? "day" : "days"}`;
}

function StrengthSlide({
  highlights,
}: {
  highlights: YearInReviewStats["strengthHighlights"];
}) {
  return (
    <div className="yir-slide-body">
      <p className="yir-eyebrow yir-reveal">Getting stronger</p>
      <div className="yir-strength">
        {highlights.map((row, i) => {
          const showChip = row.relativeDiff != null && row.relativeDiff > 0;
          const detail =
            row.gapDays != null
              ? `${formatGapDuration(row.gapDays)} between bests`
              : row.metrics.includes("topDebut")
                ? `${formatInt(row.yearSetCount)} sets this year`
                : null;
          return (
            <div
              key={row.name}
              className="yir-strength__row yir-reveal"
              style={{ "--i": i } as React.CSSProperties}
            >
              <p className="yir-strength__metric">
                {row.metrics.map((m) => STRENGTH_METRIC_LABELS[m]).join(" · ")}
              </p>
              <p className="yir-strength__name">{row.name}</p>
              <p className="yir-strength__values yir-valueline">
                {showChip && (
                  <span className="yir-chip yir-chip--ghost" aria-hidden="true">
                    +{formatGainPct(row.relativeDiff!)}%
                  </span>
                )}
                <span>
                  {row.bestPriorE1RM != null ? (
                    <>
                      {formatE1RM(row.bestPriorE1RM)} kg{" "}
                      <span className="yir-strength__arrow">→</span>{" "}
                      {formatE1RM(row.bestYearE1RM)} kg e1RM
                    </>
                  ) : (
                    <>{formatE1RM(row.bestYearE1RM)} kg e1RM</>
                  )}
                </span>
                {showChip && (
                  <span className="yir-chip">+{formatGainPct(row.relativeDiff!)}%</span>
                )}
              </p>
              {detail && <p className="yir-strength__detail">{detail}</p>}
            </div>
          );
        })}
      </div>
      <p className="yir-sub yir-reveal yir-reveal--4">
        Your best lifts this year, each by a different measure.
      </p>
    </div>
  );
}

function DebutsSlide({ stats }: { stats: YearInReviewStats }) {
  const rows = stats.debutExercises.slice(0, 5);
  const more = stats.debutExercises.length - rows.length;
  return (
    <div className="yir-slide-body">
      <p className="yir-eyebrow yir-reveal">New this year</p>
      <div className="yir-strength">
        {rows.map((row, i) => (
          <div
            key={row.name}
            className="yir-strength__row yir-reveal"
            style={{ "--i": i } as React.CSSProperties}
          >
            <p className="yir-strength__name">{row.name}</p>
            <p className="yir-strength__values yir-valueline">
              {row.relativeGrowth > 0 && (
                <span
                  className="yir-chip yir-chip--debut yir-chip--ghost"
                  aria-hidden="true"
                >
                  +{formatGainPct(row.relativeGrowth)}%
                </span>
              )}
              <span>
                {formatE1RM(row.firstWeekBestE1RM)} kg{" "}
                <span className="yir-strength__arrow">→</span>{" "}
                {formatE1RM(row.yearBestE1RM)} kg e1RM
              </span>
              {row.relativeGrowth > 0 && (
                <span className="yir-chip yir-chip--debut">
                  +{formatGainPct(row.relativeGrowth)}%
                </span>
              )}
            </p>
          </div>
        ))}
      </div>
      <p className="yir-sub yir-reveal yir-reveal--4">
        Started this year. First-week best against best of the year.
      </p>
      {more > 0 && (
        <p className="yir-footnote yir-reveal yir-reveal--4">
          + {formatInt(more)} more new {more === 1 ? "exercise" : "exercises"}.
        </p>
      )}
    </div>
  );
}

function extrasLabel(n: number): string {
  return `+ ${formatInt(n)} ${n === 1 ? "extra" : "extras"}.`;
}

function PrCountSlide({ stats }: { stats: YearInReviewStats }) {
  const winners = stats.yearOnYearPrs
    .filter((p) => p.relativeDiff > 0)
    .sort((a, b) => b.relativeDiff - a.relativeDiff)
    .slice(0, 3);
  const losers = stats.yearOnYearPrs
    .filter((p) => p.relativeDiff < 0)
    .sort((a, b) => a.relativeDiff - b.relativeDiff)
    .slice(0, 3);
  const winnerExtras = stats.prUpCount - winners.length;
  const loserExtras = stats.prDownCount - losers.length;
  return (
    <div className="yir-slide-body">
      <div className="yir-arrows" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="yir-arrows__arrow"
            style={{ "--i": i } as React.CSSProperties}
          >
            ↑
          </span>
        ))}
      </div>
      <p className="yir-eyebrow yir-reveal">Personal records</p>
      <p className="yir-sub yir-reveal yir-reveal--2">
        Your best this year against your best from every year before it.
      </p>
      {winners.length > 0 && (
        <div className="yir-prlist yir-reveal yir-reveal--3">
          <p className="yir-prlist__heading">Biggest winners</p>
          {winners.map((p) => (
            <div key={p.name} className="yir-prlist__row">
              <span className="yir-prlist__name">{p.name}</span>
              <span className="yir-chip">+{formatGainPct(p.relativeDiff)}%</span>
            </div>
          ))}
          {winnerExtras > 0 && (
            <p className="yir-prlist__extras">{extrasLabel(winnerExtras)}</p>
          )}
        </div>
      )}
      {losers.length > 0 && (
        <div className="yir-prlist yir-reveal yir-reveal--4">
          <p className="yir-prlist__heading">Biggest losers</p>
          {losers.map((p) => (
            <div key={p.name} className="yir-prlist__row">
              <span className="yir-prlist__name">{p.name}</span>
              <span className="yir-chip yir-chip--down">
                {formatGainPct(p.relativeDiff)}%
              </span>
            </div>
          ))}
          {loserExtras > 0 && (
            <p className="yir-prlist__extras">{extrasLabel(loserExtras)}</p>
          )}
        </div>
      )}
    </div>
  );
}

function PeakSparkline({
  points,
  reviewYear,
}: {
  points: { date: string; value: number }[];
  reviewYear: number;
}) {
  if (points.length <= 10) return null;

  const W = 320;
  const H = 60;
  const PAD = { top: 6, right: 4, bottom: 6, left: 4 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const time = (date: string) => {
    const [y, m, d] = date.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  const xs = points.map((p) => time(p.date));
  const xMin = xs[0];
  const xRange = xs[xs.length - 1] - xMin || 1;
  const ys = points.map((p) => p.value);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const yPad = (yMax - yMin) * 0.15 || 1;
  const xScale = (t: number) => PAD.left + ((t - xMin) / xRange) * plotW;
  const yScale = (v: number) =>
    PAD.top + plotH - ((v - (yMin - yPad)) / (yMax - yMin + 2 * yPad)) * plotH;

  // Highlight the review-year run; keep the last pre-year point so the accent
  // segment connects continuously to the base line.
  const splitTime = time(`${reviewYear}-01-01`);
  const base: string[] = [];
  const highlight: string[] = [];
  for (let i = 0; i < points.length; i++) {
    const xy = `${xScale(xs[i])},${yScale(points[i].value)}`;
    if (xs[i] >= splitTime) {
      if (highlight.length === 0 && base.length > 0) highlight.push(base[base.length - 1]);
      highlight.push(xy);
    } else {
      base.push(xy);
    }
  }

  return (
    <div className="yir-sparkline" aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {base.length >= 2 && (
          <polyline
            className="yir-sparkline__base"
            pathLength={1}
            points={base.join(" ")}
            fill="none"
            stroke="var(--text-soft)"
            strokeOpacity="0.55"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {highlight.length >= 2 && (
          <polyline
            className="yir-sparkline__highlight"
            pathLength={1}
            points={highlight.join(" ")}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
      </svg>
    </div>
  );
}

function Confetti() {
  return (
    <div className="yir-confetti" aria-hidden="true">
      {Array.from({ length: 12 }, (_, i) => (
        <span
          key={i}
          className="yir-confetti__piece"
          style={
            {
              "--i": i,
              "--dx": `${Math.cos((i / 12) * Math.PI * 2) * 130}px`,
              "--dy": `${Math.sin((i / 12) * Math.PI * 2) * 110 - 40}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

function PeakSlide({ stats }: { stats: YearInReviewStats }) {
  const pr = stats.drySpellPr;
  const repPr = stats.biggestRepPr;

  if (pr) {
    const relativeGain = (pr.yearBestE1RM - pr.previousE1RM) / pr.previousE1RM;
    return (
      <div className="yir-slide-body">
        <Confetti />
        <p className="yir-eyebrow yir-reveal">The big one</p>
        <p className="yir-display yir-display--stamp yir-display--medium">
          {pr.exerciseName}
        </p>
        <p className="yir-second-line yir-valueline yir-reveal yir-reveal--3">
          <span className="yir-chip yir-chip--ghost" aria-hidden="true">
            +{formatGainPct(relativeGain)}%
          </span>
          <span>
            {formatE1RM(pr.previousE1RM)} kg{" "}
            <span className="yir-strength__arrow">→</span>{" "}
            {formatE1RM(pr.yearBestE1RM)} kg e1RM
          </span>
          <span className="yir-chip">+{formatGainPct(relativeGain)}%</span>
        </p>
        <PeakSparkline points={stats.spotlightHistory} reviewYear={stats.reviewYear} />
        <p className="yir-sub yir-reveal yir-reveal--4">{drySpellCaption(pr)}</p>
      </div>
    );
  }

  if (repPr) {
    return (
      <div className="yir-slide-body">
        <Confetti />
        <p className="yir-eyebrow yir-reveal">The big one</p>
        <p className="yir-display yir-display--stamp yir-display--medium">
          {repPr.exerciseName}
        </p>
        <p className="yir-second-line yir-valueline yir-reveal yir-reveal--3">
          <span className="yir-chip yir-chip--ghost" aria-hidden="true">
            +{repPr.newReps - repPr.previousReps}
          </span>
          <span>
            {repPr.previousReps} <span className="yir-strength__arrow">→</span>{" "}
            {repPr.newReps} reps
          </span>
          <span className="yir-chip">+{repPr.newReps - repPr.previousReps}</span>
        </p>
        <p className="yir-sub yir-reveal yir-reveal--4">
          {ordinalDate(repPr.date)}. Your best set of the year, and a new all-time
          record.
        </p>
      </div>
    );
  }

  const n = stats.totalCompletedSessions;
  return (
    <div className="yir-slide-body">
      <p className="yir-eyebrow yir-reveal">Personal records</p>
      <p className="yir-display yir-display--medium yir-reveal yir-reveal--2">
        No new records
      </p>
      <p className="yir-sub yir-reveal yir-reveal--3">
        {formatInt(Math.max(n, stats.trainingDayCount))}{" "}
        {n > 0
          ? n === 1
            ? "session"
            : "sessions"
          : stats.trainingDayCount === 1
            ? "training day"
            : "training days"}{" "}
        logged this year. Your all-time bests stayed where they were.
      </p>
    </div>
  );
}

function PosterSlide({
  stats,
  onDone,
}: {
  stats: YearInReviewStats;
  onDone: () => void;
}) {
  const cells: { label: string; value: string }[] = [];
  if (stats.totalCompletedSessions > 0) {
    cells.push({ label: "Sessions", value: formatInt(stats.totalCompletedSessions) });
  }
  if (stats.totalTrainingSeconds > 0) {
    cells.push({ label: "Gym time", value: formatDuration(stats.totalTrainingSeconds) });
  }
  cells.push({ label: "Sets", value: formatInt(stats.totalSets) });
  cells.push({ label: "Reps", value: formatInt(stats.totalReps) });
  if (stats.trainingDayCount > 0) {
    cells.push({ label: "Training days", value: formatInt(stats.trainingDayCount) });
  }
  if (stats.busiestMonth && stats.monthsWithActivity >= 3) {
    cells.push({ label: "Peak month", value: stats.busiestMonth.name });
  }
  if (stats.longestWeeklyStreak >= 3) {
    cells.push({ label: "Best streak", value: `${stats.longestWeeklyStreak} weeks` });
  }
  if (stats.topExercises.length > 0 && stats.topExercises[0].setCount >= 20) {
    cells.push({ label: "Top exercise", value: stats.topExercises[0].name });
  }
  if (stats.prUpCount > 0) {
    cells.push({ label: "Lifts up", value: formatInt(stats.prUpCount) });
  }
  if (stats.debutExercises.length > 0) {
    cells.push({ label: "Debuts", value: formatInt(stats.debutExercises.length) });
  }

  const medalParts: string[] = [];
  if (stats.goldSessionCount > 0) medalParts.push(`🥇 ×${stats.goldSessionCount}`);
  if (stats.perfectWeekCount > 0) medalParts.push(`🤩 ×${stats.perfectWeekCount}`);
  if (stats.aSeasonCount > 0) medalParts.push(`A ×${stats.aSeasonCount}`);

  return (
    <div className="yir-slide-body yir-slide-body--poster">
      <p className="yir-eyebrow yir-reveal">{stats.reviewYear}, wrapped up</p>
      <div className="yir-poster-grid">
        {cells.map((cell, i) => (
          <div
            key={cell.label}
            className="yir-poster-grid__cell yir-reveal"
            style={{ "--i": i } as React.CSSProperties}
          >
            <span className="yir-poster-grid__value">{cell.value}</span>
            <span className="yir-poster-grid__label">{cell.label}</span>
          </div>
        ))}
      </div>
      {medalParts.length > 0 && (
        <p className="yir-medal-line yir-reveal yir-reveal--4">
          {medalParts.join(" · ")}
        </p>
      )}
      <p className="yir-sub yir-reveal yir-reveal--4">That was {stats.reviewYear}.</p>
      <button type="button" className="yir-done-button" onClick={onDone}>
        Back to dashboard
      </button>
    </div>
  );
}

// ─── Deck ─────────────────────────────────────────────────────────────────────

interface SlideDef {
  key: string;
  glow: string;
  node: React.ReactNode;
}

function buildDeck(stats: YearInReviewStats, onDone: () => void): SlideDef[] {
  const deck: SlideDef[] = [];
  deck.push({ key: "cover", glow: "lime", node: <CoverSlide stats={stats} /> });
  deck.push({ key: "sessions", glow: "green", node: <SessionsSlide stats={stats} /> });
  deck.push({ key: "sets", glow: "lime", node: <SetsRepsSlide stats={stats} /> });
  if (stats.busiestMonth && stats.monthsWithActivity >= 3) {
    deck.push({
      key: "busiest-month",
      glow: "amber",
      node: <BusiestMonthSlide stats={stats} />,
    });
  }
  if (stats.longestWeeklyStreak >= 3) {
    deck.push({ key: "streak", glow: "green", node: <StreakSlide stats={stats} /> });
  }
  if (stats.topExercises.length > 0 && stats.topExercises[0].setCount >= 20) {
    deck.push({
      key: "top-exercise",
      glow: "lime",
      node: <TopExerciseSlide stats={stats} />,
    });
  }
  if (stats.topExercises.length >= 3 && stats.totalSets >= 50) {
    deck.push({
      key: "exercise-split",
      glow: "blue",
      node: <ExerciseSplitSlide stats={stats} />,
    });
  }
  if (stats.strengthHighlights.length >= 1) {
    deck.push({
      key: "strength",
      glow: "green",
      node: <StrengthSlide highlights={stats.strengthHighlights} />,
    });
  }
  if (stats.prUpCount + stats.prDownCount >= 3) {
    deck.push({ key: "pr-count", glow: "lime", node: <PrCountSlide stats={stats} /> });
  }
  if (stats.debutExercises.length >= 1) {
    deck.push({ key: "debuts", glow: "blue", node: <DebutsSlide stats={stats} /> });
  }
  deck.push({ key: "peak", glow: "peak", node: <PeakSlide stats={stats} /> });
  deck.push({
    key: "poster",
    glow: "lime",
    node: <PosterSlide stats={stats} onDone={onDone} />,
  });
  return deck;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function YearInReviewPage() {
  const navigate = useNavigate();
  const cancelled = useRef(false);
  const [isDesktop] = useState(() => window.innerWidth >= 1024);
  const [{ inWindow, reviewYear }] = useState(() => getYearInReviewState());
  const [stats, setStats] = useState<YearInReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    if (!inWindow || isDesktop) return;
    cancelled.current = false;
    computeYearInReviewStats(reviewYear)
      .then((s) => {
        if (cancelled.current) return;
        setStats(s);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled.current) return;
        setLoading(false);
      });
    return () => {
      cancelled.current = true;
    };
  }, [inWindow, isDesktop, reviewYear]);

  if (!inWindow) {
    return <Navigate to="/" replace />;
  }

  if (isDesktop) {
    const appUrl = `${window.location.origin}${import.meta.env.BASE_URL}`;
    return (
      <main className="yir-page yir-page--desktop">
        <div className="yir-qr">
          <img
            className="yir-qr__img"
            src={`${import.meta.env.BASE_URL}qr.png`}
            alt="QR code to open app on mobile"
          />
          <p className="yir-qr__url">{appUrl}</p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="yir-page">
        <p className="yir-loading">Building your year…</p>
      </main>
    );
  }

  if (!stats || !stats.hasMinimumData) {
    return (
      <main className="yir-page">
        <div className="yir-empty">
          <p className="yir-eyebrow">Year in review</p>
          <p className="yir-empty__text">
            Nothing logged in {reviewYear} yet. The review opens once you have
            trained.
          </p>
          <button
            type="button"
            className="yir-done-button"
            onClick={() => navigate("/")}
          >
            Back to dashboard
          </button>
        </div>
      </main>
    );
  }

  const deck = buildDeck(stats, () => navigate("/"));
  const slide = deck[slideIndex];

  return (
    <main className={`yir-page yir-page--glow-${slide.glow}`}>
      <header className="yir-header">
        <div className="yir-progress" aria-hidden="true">
          {deck.map((s, i) => (
            <span
              key={s.key}
              className={
                i < slideIndex
                  ? "yir-progress__segment yir-progress__segment--completed"
                  : i === slideIndex
                    ? "yir-progress__segment yir-progress__segment--current"
                    : "yir-progress__segment"
              }
            />
          ))}
        </div>
        <button
          type="button"
          className="yir-close"
          aria-label="Close year in review"
          onClick={() => navigate("/")}
        >
          ×
        </button>
      </header>

      <button
        type="button"
        className="yir-tapzone yir-tapzone--prev"
        aria-label="Previous slide"
        onClick={() => setSlideIndex((i) => Math.max(i - 1, 0))}
      />
      <button
        type="button"
        className="yir-tapzone yir-tapzone--next"
        aria-label="Next slide"
        onClick={() => setSlideIndex((i) => Math.min(i + 1, deck.length - 1))}
      />

      {/* The live region must be stable across slide changes; only the inner
          keyed element remounts (to replay entry animations). */}
      <div className="yir-slide-live" aria-live="polite">
        <div className="yir-slide" key={slide.key}>
          <span className="yir-visually-hidden">
            Slide {slideIndex + 1} of {deck.length}
          </span>
          {slide.node}
        </div>
      </div>
    </main>
  );
}
