import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  computeYearInReviewStats,
  getYearInReviewState,
  MONTH_NAMES,
  type YearInReviewStats,
  type YearOnYearPr,
  type RepBox,
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

function monthsPhrase(n: number): string {
  const word = NUMBER_WORDS[n]?.toLowerCase() ?? String(n);
  return `${word} ${n === 1 ? "month" : "months"}`;
}

/**
 * Scope copy for the cover: a fixed intro paragraph, then a detail paragraph
 * describing anything unusual about the data (a gap before training began, or
 * a mix of import sources). A full twelve months logged in the app has nothing
 * to add, so only the intro shows.
 */
function coverScopeParagraphs(stats: YearInReviewStats): string[] {
  const preHistory = stats.preHistoryMonthCount;
  const imported = stats.importedMonthCount;
  const native = stats.nativeMonthCount;
  const intro =
    "The following pages were derived from your last twelve months of training data.";
  const clauses: string[] = [];
  if (preHistory > 0) {
    const begins = MONTH_NAMES[preHistory];
    clauses.push(
      preHistory === 1
        ? `The first month is missing, because your data begins in ${begins}.`
        : `The first ${NUMBER_WORDS[preHistory].toLowerCase()} months are missing, because your data begins in ${begins}.`
    );
  }
  if (imported > 0 && native > 0) {
    clauses.push(
      `Your data contains a mix of sources, with ${monthsPhrase(imported)} of historical CSV imports and ${monthsPhrase(native)} captured via the app.`
    );
  } else if (imported > 0) {
    clauses.push(
      `Your data came from ${monthsPhrase(imported)} of historical CSV imports.`
    );
  }
  return clauses.length > 0 ? [intro, clauses.join(" ")] : [intro];
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
        {coverScopeParagraphs(stats).map((paragraph) => (
          <p key={paragraph} className="yir-cover-scope__line">
            {paragraph}
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

// Sparse axis labels for the reps scale: 1, every fifth rep, and the final
// "N+" collapse bin. Unlabelled columns get a non-breaking space so the row
// keeps its height.
function repBinLabel(i: number, axisMax: number): string {
  const rep = i + 1;
  if (rep === axisMax) return `${axisMax}+`;
  if (rep === 1 || rep % 5 === 0) return `${rep}`;
  return " ";
}

/**
 * The reps distribution histogram. Bins run 1..bins.length reps, the last bin
 * collecting everything at that many reps or above. Its label row is the shared
 * x-axis for the box plots stacked below it.
 */
function RepsHistogram({ bins }: { bins: number[] }) {
  const axisMax = bins.length;
  const maxBin = Math.max(...bins, 1);
  const modalBin = bins.indexOf(maxBin);
  return (
    <div className="yir-histogram yir-histogram--reps" aria-hidden="true">
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
            {repBinLabel(i, axisMax)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** A horizontal reps box plot on the shared 1..axisMax reps scale. */
function RepBoxPlot({ box, axisMax }: { box: RepBox; axisMax: number }) {
  // Map a rep value to its histogram-column centre so the box lines up with the
  // bars above it.
  const pos = (v: number) => ((v - 0.5) / axisMax) * 100;
  const whiskerLeft = pos(box.whiskerLow);
  const whiskerRight = pos(box.whiskerHigh);
  const boxLeft = pos(box.q1);
  const boxRight = pos(box.q3);
  return (
    <div className="yir-box">
      <span className="yir-box__name">{box.name}</span>
      <span className="yir-box__track" aria-hidden="true">
        <span
          className="yir-box__whisker"
          style={{ left: `${whiskerLeft}%`, width: `${whiskerRight - whiskerLeft}%` }}
        />
        <span className="yir-box__cap" style={{ left: `${whiskerLeft}%` }} />
        <span className="yir-box__cap" style={{ left: `${whiskerRight}%` }} />
        <span
          className="yir-box__box"
          style={{ left: `${boxLeft}%`, width: `${Math.max(boxRight - boxLeft, 1)}%` }}
        />
        <span className="yir-box__median" style={{ left: `${pos(box.median)}%` }} />
      </span>
    </div>
  );
}

function SetsRepsSlide({ stats }: { stats: YearInReviewStats }) {
  const target = stats.totalReps;
  const shown = useCountUp(target);
  const avgReps =
    stats.totalSets > 0 ? Math.round(stats.totalReps / stats.totalSets) : 0;
  const profile = stats.repProfile;
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
      {stats.totalSets >= 20 && profile && (
        <>
          <div className="yir-boxplots yir-reveal yir-reveal--4">
            {profile.boxes.map((box) => (
              <RepBoxPlot key={box.name} box={box} axisMax={stats.repsAxisMax} />
            ))}
          </div>
          <p className="yir-footnote yir-reveal yir-reveal--4">
            Average rep counts varied across exercises. For example,{" "}
            {profile.boxes[0].name} averaged {Math.round(profile.boxes[0].avgReps)}{" "}
            reps per set, {profile.boxes[1].name} averaged{" "}
            {Math.round(profile.boxes[1].avgReps)}, and {profile.boxes[2].name}{" "}
            averaged {Math.round(profile.boxes[2].avgReps)}.
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
  const leaders = stats.volumeLeaders;
  const top = leaders[0];
  const runnersUp = leaders.slice(1, 5);
  const decliners = stats.volumeDecliners;
  return (
    <div className="yir-slide-body">
      <p className="yir-eyebrow yir-reveal">Your number one</p>
      <p className="yir-display yir-display--stamp yir-display--medium">{top.name}</p>
      <p className="yir-sub yir-reveal yir-reveal--3">
        {formatInt(top.setCount)} sets this year, more than any other exercise.
      </p>
      {runnersUp.length > 0 && (
        <ul className="yir-runner-list yir-reveal yir-reveal--4">
          {runnersUp.map((ex, i) => (
            <li key={ex.name} className="yir-runner-list__item">
              <span className="yir-runner-list__rank">{i + 2}.</span>
              <span className="yir-runner-list__name">{ex.name}</span>
              <span className="yir-runner-list__count">
                {formatInt(ex.setCount)} sets
              </span>
            </li>
          ))}
        </ul>
      )}
      {decliners.length > 0 && (
        <div className="yir-decliners yir-reveal yir-reveal--4">
          <p className="yir-decliners__heading">Biggest drop-offs versus last year</p>
          <ul className="yir-dropoff-list">
            {decliners.map((ex) => (
              <li key={ex.name} className="yir-dropoff-row">
                <span className="yir-dropoff-row__name">{ex.name}</span>
                <span className="yir-dropoff-row__from">
                  {formatInt(ex.prevSetCount)}
                </span>
                <span className="yir-dropoff-row__arrow">→</span>
                <span className="yir-dropoff-row__to">{formatInt(ex.setCount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="yir-sub yir-reveal yir-reveal--4">
        Across {formatInt(stats.distinctExerciseCount)} different exercises.
      </p>
    </div>
  );
}

function DebutsSlide({ stats }: { stats: YearInReviewStats }) {
  const rows = stats.debutExercises.slice(0, 8);
  const more = stats.debutExercises.length - rows.length;
  return (
    <div className="yir-slide-body">
      <p className="yir-eyebrow yir-reveal">New this year</p>
      <p className="yir-sub yir-reveal yir-reveal--2">
        Some exercises don't have historical data to compare against because
        they debuted this year. Here's a breakdown of how you got on with these
        lifts.
      </p>
      <table className="yir-debut-table yir-reveal yir-reveal--3">
        <thead>
          <tr>
            <th scope="col">Exercise</th>
            <th scope="col">Started at</th>
            <th scope="col">Best lift</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td className="yir-debut-table__name">{row.name}</td>
              <td className="yir-debut-table__num">
                {formatE1RM(row.firstWeekBestE1RM)} kg
              </td>
              <td className="yir-debut-table__num">
                {formatE1RM(row.yearBestE1RM)} kg
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="yir-footnote yir-reveal yir-reveal--4">
        Best-set estimated 1RM.
        {more > 0
          ? ` + ${formatInt(more)} more new ${more === 1 ? "exercise" : "exercises"}.`
          : ""}
      </p>
    </div>
  );
}

/** Union of the top three by percentage and the top three by kilograms. */
function unionTopThree(
  prs: YearOnYearPr[],
  kgGain: (p: YearOnYearPr) => number,
  wanted: "up" | "down"
): YearOnYearPr[] {
  const sign = wanted === "up" ? 1 : -1;
  const byPct = prs
    .filter((p) => sign * p.relativeDiff > 0)
    .sort((a, b) => sign * (b.relativeDiff - a.relativeDiff))
    .slice(0, 3);
  const byKg = prs
    .filter((p) => sign * kgGain(p) > 0)
    .sort((a, b) => sign * (kgGain(b) - kgGain(a)))
    .slice(0, 3);
  const seen = new Set<string>();
  const union: YearOnYearPr[] = [];
  for (const p of [...byPct, ...byKg]) {
    if (seen.has(p.name)) continue;
    seen.add(p.name);
    union.push(p);
  }
  return union.sort((a, b) => sign * (b.relativeDiff - a.relativeDiff));
}

function PrCountSlide({ stats }: { stats: YearInReviewStats }) {
  const kgGain = (p: YearOnYearPr) => p.bestYearE1RM - p.bestPriorE1RM;
  const winners = unionTopThree(stats.yearOnYearPrs, kgGain, "up");
  const losers = unionTopThree(stats.yearOnYearPrs, kgGain, "down");
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
        Your most significant changes since last year.
      </p>
      {winners.length > 0 && (
        <div className="yir-prlist yir-reveal yir-reveal--3">
          <p className="yir-prlist__heading">Biggest winners</p>
          {winners.map((p) => (
            <div key={p.name} className="yir-prlist__row">
              <span className="yir-prlist__name">
                <span className="yir-prlist__ex">{p.name}</span>
                <span className="yir-prlist__kg">+{formatE1RM(kgGain(p))} kg</span>
              </span>
              <span className="yir-chip">+{formatGainPct(p.relativeDiff)}%</span>
            </div>
          ))}
        </div>
      )}
      {losers.length > 0 && (
        <div className="yir-prlist yir-reveal yir-reveal--4">
          <p className="yir-prlist__heading">Biggest losers</p>
          {losers.map((p) => (
            <div key={p.name} className="yir-prlist__row">
              <span className="yir-prlist__name">
                <span className="yir-prlist__ex">{p.name}</span>
                <span className="yir-prlist__kg">{formatE1RM(kgGain(p))} kg</span>
              </span>
              <span className="yir-chip yir-chip--down">
                {formatGainPct(p.relativeDiff)}%
              </span>
            </div>
          ))}
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
      <p className="yir-eyebrow yir-reveal">{stats.reviewYear}, in review</p>
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
  if (stats.yearOnYearPrs.length >= 1) {
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
  // Hidden preview: /year-in-review?preview renders the deck outside the real
  // Dec 1 - Jan 31 window (e.g. to show someone in person). Bare ?preview shows
  // last year, the year the most recent real window covered; ?preview=YYYY picks
  // a specific review year. It bypasses the date gate on this page only; the
  // dashboard CTA and the app-open interstitial stay date-gated.
  const [previewYear] = useState<number | null>(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("preview")) return null;
    const asked = Number(params.get("preview"));
    return Number.isInteger(asked) && asked > 2000
      ? asked
      : new Date().getFullYear() - 1;
  });
  const [windowState] = useState(() => getYearInReviewState());
  const inWindow = previewYear != null || windowState.inWindow;
  const reviewYear = previewYear ?? windowState.reviewYear;
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
    const previewSuffix =
      previewYear != null ? `year-in-review?preview=${previewYear}` : "";
    const appUrl = `${window.location.origin}${import.meta.env.BASE_URL}${previewSuffix}`;
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
