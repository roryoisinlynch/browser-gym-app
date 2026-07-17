import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  computeYearInReviewStats,
  getYearInReviewState,
  type YearInReviewStats,
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

function monthNoun(n: number): string {
  return n === 1 ? "month" : "months";
}

/**
 * Scope line for the cover: where the year's data came from, as chronological
 * fragments (quiet lead-in, imported history, app-logged months).
 */
function coverScopeLine(stats: YearInReviewStats): string {
  const leadIn = stats.emptyLeadInMonthCount;
  const imported = stats.importedMonthCount;
  const native = stats.nativeMonthCount;
  const parts: string[] = [];
  if (leadIn > 0) {
    parts.push(`${NUMBER_WORDS[leadIn]} quiet ${monthNoun(leadIn)} before your first set.`);
  }
  if (imported > 0) {
    parts.push(`${NUMBER_WORDS[imported]} ${monthNoun(imported)} of imported history.`);
  }
  if (native > 0) {
    parts.push(`${NUMBER_WORDS[native]} ${monthNoun(native)} logged right here.`);
  }
  return parts.join(" ");
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
      <p className="yir-sub yir-reveal yir-reveal--4">{coverScopeLine(stats)}</p>
      <p className="yir-hint">Tap to continue</p>
    </div>
  );
}

/**
 * GitHub-style contribution calendar: columns are Monday-aligned weeks, rows
 * Mon to Sun, cells shaded by that day's set count (native + imported).
 */
function ContributionCalendar({ stats }: { stats: YearInReviewStats }) {
  const counts = stats.dailySetCounts;
  const max = Math.max(...counts, 1);
  // Monday-based weekday of Jan 1: UTC day 0 was a Thursday, so offset 3.
  const lead = (Math.floor(Date.UTC(stats.reviewYear, 0, 1) / 86400000) + 3) % 7;
  const total = Math.ceil((lead + counts.length) / 7) * 7;
  return (
    <div className="yir-cal" aria-hidden="true">
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
        <ContributionCalendar stats={stats} />
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
      <div className="yir-session-grid" aria-hidden="true">
        {Array.from({ length: Math.min(n, 60) }, (_, i) => (
          <span
            key={i}
            className="yir-session-grid__square"
            style={{ "--i": i } as React.CSSProperties}
          />
        ))}
      </div>
      <ContributionCalendar stats={stats} />
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

function SetsRepsSlide({ stats }: { stats: YearInReviewStats }) {
  const target = stats.totalReps;
  const shown = useCountUp(target);
  const maxBin = Math.max(...stats.repsHistogram, 1);
  const modalBin = stats.repsHistogram.indexOf(maxBin);
  const avgReps =
    stats.totalSets > 0 ? Math.round(stats.totalReps / stats.totalSets) : 0;
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
      {stats.totalSets >= 20 && (
        <div className="yir-histogram yir-histogram--reps" aria-hidden="true">
          {stats.repsHistogram.map((count, i) => (
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
      )}
      {avgReps > 0 && (
        <p className="yir-sub yir-reveal yir-reveal--4">
          That's an average of {avgReps} {avgReps === 1 ? "rep" : "reps"} per
          set.
        </p>
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
  const drawn = Math.min(streak, 16);
  const showAllTime = stats.hasPriorYearData && allTime > streak;
  const pctLonger =
    streak > 0 ? Math.round(((allTime - streak) / streak) * 100) : 0;
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
      {showAllTime && (
        <p className="yir-second-line yir-reveal yir-reveal--3">
          All-time best: {allTime} weeks
        </p>
      )}
      <p className={`yir-sub yir-reveal ${showAllTime ? "yir-reveal--4" : "yir-reveal--3"}`}>
        {showAllTime
          ? `Your longest run this year. Your all-time best was ${pctLonger}% longer.`
          : stats.hasPriorYearData
            ? "Your longest run of consecutive weeks with at least one session. That's your all-time best."
            : "Your longest run of consecutive weeks with at least one session."}
      </p>
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
  const top4 = stats.topExercises.slice(0, 4);
  const topSets = top4.reduce((sum, ex) => sum + ex.setCount, 0);
  const rows = top4.map((ex) => ({
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

function StrengthSlide({ rows }: { rows: YearInReviewStats["yearOnYearPrs"] }) {
  return (
    <div className="yir-slide-body">
      <p className="yir-eyebrow yir-reveal">Getting stronger</p>
      <div className="yir-strength">
        {rows.map((row, i) => (
          <div
            key={row.name}
            className="yir-strength__row yir-reveal"
            style={{ "--i": i } as React.CSSProperties}
          >
            <p className="yir-strength__name">{row.name}</p>
            <p className="yir-strength__values">
              {formatE1RM(row.bestPriorE1RM)} kg{" "}
              <span className="yir-strength__arrow">→</span>{" "}
              {formatE1RM(row.bestYearE1RM)} kg e1RM
              <span className="yir-chip">+{formatGainPct(row.relativeDiff)}%</span>
            </p>
          </div>
        ))}
      </div>
      <p className="yir-sub yir-reveal yir-reveal--4">
        Your best lifts, this year against everything before.
      </p>
    </div>
  );
}

function DebutsSlide({ stats }: { stats: YearInReviewStats }) {
  const rows = stats.debutExercises.slice(0, 3);
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
            <p className="yir-strength__values">
              {formatE1RM(row.firstWeekBestE1RM)} kg{" "}
              <span className="yir-strength__arrow">→</span>{" "}
              {formatE1RM(row.yearBestE1RM)} kg e1RM
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
    </div>
  );
}

function PrCountSlide({ stats }: { stats: YearInReviewStats }) {
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
      <p className="yir-display yir-reveal yir-reveal--2">
        {formatInt(stats.prUpCount)}
        <span className="yir-display__unit">
          {stats.prUpCount === 1 ? "lift up" : "lifts up"}
        </span>
      </p>
      {stats.prDownCount > 0 && (
        <p className="yir-second-line yir-reveal yir-reveal--3">
          {formatInt(stats.prDownCount)} down
        </p>
      )}
      <p
        className={`yir-sub yir-reveal ${
          stats.prDownCount > 0 ? "yir-reveal--4" : "yir-reveal--3"
        }`}
      >
        Your best this year against your best from every year before it.
      </p>
      {stats.debutExercises.length > 0 && (
        <p className="yir-footnote yir-reveal yir-reveal--4">
          {formatInt(stats.debutExercises.length)}{" "}
          {stats.debutExercises.length === 1
            ? "exercise made its debut this year."
            : "exercises made their debut this year."}
        </p>
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
  const pr = stats.biggestPr;
  const repPr = stats.biggestRepPr;

  if (pr) {
    return (
      <div className="yir-slide-body">
        <Confetti />
        <p className="yir-eyebrow yir-reveal">The big one</p>
        <p className="yir-display yir-display--stamp yir-display--medium">
          {pr.exerciseName}
        </p>
        <p className="yir-second-line yir-reveal yir-reveal--3">
          {formatE1RM(pr.previousE1RM)} kg{" "}
          <span className="yir-strength__arrow">→</span> {formatE1RM(pr.newE1RM)} kg
          e1RM
          <span className="yir-chip">+{formatGainPct(pr.relativeGain)}%</span>
        </p>
        <PeakSparkline points={stats.biggestPrHistory} reviewYear={stats.reviewYear} />
        <p className="yir-sub yir-reveal yir-reveal--4">
          {ordinalDate(pr.date)}. Your best lift of the year, and a new all-time
          record.
        </p>
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
        <p className="yir-second-line yir-reveal yir-reveal--3">
          {repPr.previousReps} <span className="yir-strength__arrow">→</span>{" "}
          {repPr.newReps} reps
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
  if (stats.totalTonnageKg > 0) {
    cells.push({ label: "Weight moved", value: `${formatInt(stats.totalTonnageKg)} kg` });
  }
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
  const strengthRows = stats.yearOnYearPrs
    .filter((r) => r.relativeDiff > 0)
    .slice(0, 3);
  if (strengthRows.length >= 1) {
    deck.push({
      key: "strength",
      glow: "green",
      node: <StrengthSlide rows={strengthRows} />,
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
