import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SeasonInstance, SessionInstance, WeekInstance } from "../domain/models";
import type { ExerciseSessionDataPoint, PREvent, WeekInstanceItemView } from "../repositories/programRepository";
import {
  getActiveSeasonInstance,
  getAllTimePREvents,
  getCanonicalWeekTemplateForSeason,
  findExerciseNeedingWeight,
  getExerciseSessionHistory,
  getLastCompletedSessionInstance,
  getLastCompletedWeekInstance,
  getLastEndedSeasonInstance,
  getSeasonCalendarWeeks,
  getSeasonMetrics,
  getSessionInstanceById,
  getSessionInstanceView,
  getSessionMetrics,
  getWeekInstanceItemsForCurrentWeek,
  getWeekInstanceItemsForWeekInstance,
  getWeekMetrics,
  getWeekTemplateItemsForWeekTemplate,
} from "../repositories/programRepository";
import { getAll, getById, STORE_NAMES } from "../db/db";
import { formatDayCount } from "../services/relativeTime";
import {
  isHeuristicsEnabled,
  getPendingHeuristicDates,
} from "../repositories/heuristicsRepository";
import Medal from "../components/Medal";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import PageLoader from "../components/PageLoader";
import TutorialBlock from "../components/TutorialBlock";
import Reveal from "../components/Reveal";
import WeekGradeHero from "../components/WeekGradeHero";
// The report mock below borrows the summary reports' shared type scale and
// narrative styling; importing it here makes that dependency explicit.
import "../styles/summary.css";
import WeeksBreadcrumb from "../components/WeeksBreadcrumb";
import type { BreadcrumbWeek } from "../components/WeeksBreadcrumb";
import ExerciseSummaryCard from "../components/ExerciseSummaryCard";
import { emojiForRating } from "../services/weekMetrics";
import { gradeColor } from "../services/seasonMetrics";
import { getYearInReviewState, hasAnyReviewData } from "../services/yearInReview";
import "./DashboardPage.css";

// ─── Tutorial: exercise graph mock ─────────────────────────────────────────
// Standalone component so it can hold its own bin-toggle state. Each bin shows
// a different fabricated dataset + x-axis labels so the toggle is functional.

type GraphBin = "week" | "season" | "quarter" | "year";

const GRAPH_DATASETS: Record<
  GraphBin,
  { points: number[]; labels: [string, string, string]; previousLabel: string; bestLabel: string; previousValue: string; bestValue: string; previousE1RM: string; bestE1RM: string }
> = {
  week: {
    points: [88, 91, 90, 94, 97, 96, 102, 105],
    labels: ["Mar '26", "Apr '26", "May '26"],
    previousLabel: "7 May '26",
    bestLabel: "14 May '26",
    previousValue: "90kg × 5",
    bestValue: "95kg × 5",
    previousE1RM: "105kg e1RM",
    bestE1RM: "110.8kg e1RM",
  },
  season: {
    points: [82, 92, 105],
    labels: ["Autumn '25", "Winter '26", "Spring '26"],
    previousLabel: "Winter '26",
    bestLabel: "Spring '26",
    previousValue: "85kg × 5",
    bestValue: "95kg × 5",
    previousE1RM: "99.2kg e1RM",
    bestE1RM: "110.8kg e1RM",
  },
  quarter: {
    points: [78, 84, 95, 105],
    labels: ["Q2 '25", "Q3 '25", "Q1 '26"],
    previousLabel: "Q1 '26",
    bestLabel: "Q2 '26",
    previousValue: "85kg × 5",
    bestValue: "95kg × 5",
    previousE1RM: "99.2kg e1RM",
    bestE1RM: "110.8kg e1RM",
  },
  year: {
    points: [70, 88, 105],
    labels: ["2024", "2025", "2026"],
    previousLabel: "2025",
    bestLabel: "2026",
    previousValue: "80kg × 5",
    bestValue: "95kg × 5",
    previousE1RM: "93.3kg e1RM",
    bestE1RM: "110.8kg e1RM",
  },
};

function ExerciseGraphMock() {
  const [bin, setBin] = useState<GraphBin>("week");
  const data = GRAPH_DATASETS[bin];

  const CHART_W = 300;
  const CHART_H = 128;
  const PAD = { top: 14, right: 10, bottom: 28, left: 38 };
  const PLOT_W = CHART_W - PAD.left - PAD.right;
  const PLOT_H = CHART_H - PAD.top - PAD.bottom;
  const n = data.points.length;
  const minVal = Math.min(...data.points);
  const maxVal = Math.max(...data.points);
  const range = maxVal - minVal || 10;
  const yPadding = range * 0.2;
  const yMin = Math.max(0, minVal - yPadding);
  const yMax = maxVal + yPadding;
  const xScale = (i: number) => PAD.left + (n > 1 ? (i / (n - 1)) * PLOT_W : PLOT_W / 2);
  const yScale = (v: number) => PAD.top + PLOT_H - ((v - yMin) / (yMax - yMin)) * PLOT_H;
  const yTicks = [0, 1, 2].map((i) => {
    const v = yMin + (i / 2) * (yMax - yMin);
    return { label: Math.round(v), y: yScale(v) };
  });
  const linePoints = data.points.map((p, i) => `${xScale(i)},${yScale(p)}`).join(" ");
  const areaD =
    n > 1
      ? `M ${xScale(0)},${yScale(data.points[0])} ` +
        data.points.slice(1).map((p, i) => `L ${xScale(i + 1)},${yScale(p)}`).join(" ") +
        ` L ${xScale(n - 1)},${PAD.top + PLOT_H} L ${xScale(0)},${PAD.top + PLOT_H} Z`
      : "";

  return (
    <section className="exercise-insights">
      <div className="exercise-insights__header-row">
        <p className="exercise-insights__eyebrow">Insights</p>
        <div className="exercise-insights__bin-toggle">
          {(["week", "season", "quarter", "year"] as GraphBin[]).map((b) => (
            <button
              key={b}
              type="button"
              className={`exercise-insights__bin-btn${bin === b ? " exercise-insights__bin-btn--active" : ""}`}
              onClick={() => setBin(b)}
            >
              {b.charAt(0).toUpperCase() + b.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="exercise-insights__chart">
        <p className="exercise-insights__chart-label">e1RM over time (kg)</p>
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="tutorial-mock-graph-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d8f06a" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#d8f06a" stopOpacity="0" />
            </linearGradient>
          </defs>
          {yTicks.map(({ label, y }) => (
            <g key={label}>
              <line x1={PAD.left} y1={y} x2={CHART_W - PAD.right} y2={y} stroke="#2b313a" strokeWidth="1" />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize="9" fill="#7e8794">
                {label}
              </text>
            </g>
          ))}
          {areaD && <path d={areaD} fill="url(#tutorial-mock-graph-fill)" />}
          {n > 1 && (
            <polyline points={linePoints} fill="none" stroke="#c4e23c" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          )}
          {data.points.map((p, i) => (
            <circle key={i} cx={xScale(i)} cy={yScale(p)} r="3" fill="#1a1f26" stroke="#c4e23c" strokeWidth="2" />
          ))}
          <text x={xScale(0)} y={CHART_H - 4} textAnchor="start" fontSize="9" fill="#7e8794">{data.labels[0]}</text>
          {n > 2 && (
            <text x={xScale(Math.floor((n - 1) / 2))} y={CHART_H - 4} textAnchor="middle" fontSize="9" fill="#7e8794">
              {data.labels[1]}
            </text>
          )}
          <text x={xScale(n - 1)} y={CHART_H - 4} textAnchor="end" fontSize="9" fill="#7e8794">
            {n > 2 ? data.labels[2] : data.labels[1]}
          </text>
        </svg>
      </div>
      <div className="exercise-insights__metrics-grid">
        <div className="exercise-insights__metric">
          <span className="exercise-insights__metric-eyebrow">Previous lift</span>
          <span className="exercise-insights__metric-date">{data.previousLabel}</span>
          <strong className="exercise-insights__metric-value">{data.previousValue}</strong>
          <span className="exercise-insights__metric-e1rm">{data.previousE1RM}</span>
        </div>
        <div className="exercise-insights__metric">
          <span className="exercise-insights__metric-eyebrow">Best lift</span>
          <span className="exercise-insights__metric-date">{data.bestLabel}</span>
          <strong className="exercise-insights__metric-value">{data.bestValue}</strong>
          <span className="exercise-insights__metric-e1rm">{data.bestE1RM}</span>
        </div>
      </div>
    </section>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type UpNextState =
  | { type: "loading" }
  | { type: "no_program" }
  | { type: "active_session"; sessionId: string; sessionName: string }
  | { type: "overdue_session"; sessionId: string; sessionName: string; date: string; daysOverdue: number; sessionCompletedToday: boolean }
  | { type: "today_session"; sessionId: string; sessionName: string }
  | { type: "rest_day"; nextSessionName: string | null; nextDate: string | null; daysUntil: number | null }
  | { type: "upcoming"; sessionId: string; sessionName: string; date: string; daysUntil: number }
  | { type: "week_complete" };

type DaySquareStatus = "green" | "overdue" | "skipped" | "grey" | "rest-past" | "rest-future";

interface DaySquare {
  type: "session" | "rest";
  scheduledDate: string;
  status: DaySquareStatus;
}

interface SeasonTimelineData {
  startDate: string;
  endDate: string;
  totalWeeks: number;
  weeks: DaySquare[][];
  currentWeekOrder: number;
  sessionsCompleted: number;
  sessionsExpected: number;
}

type RecentDayStatus = "green" | "skipped" | "green-skipped" | "grey" | "rest-past" | "rest-behind";

interface RecentDayCell {
  dateIso: string;
  status: RecentDayStatus;
  isToday: boolean;
}

interface RecentDayRow {
  cols: number;            // columns in this row = this program week's actual length
  headerLetters: string[]; // weekday letters for each cell in this row
  cells: (RecentDayCell | null)[]; // null = future placeholder in current row
  done: number;     // sessions completed within this week's calendar window
  expected: number; // template-projected sessions within this week's window
  delta: number;    // running season delta (done - expected) at week end
}

interface RecentDaysData {
  rows: RecentDayRow[];
}

interface RecentCard {
  id: string;
  name: string;
  grade: string | null;
  gradeKind?: "emoji" | "letter";
  gradeColor: "green" | "amber" | "red" | "grey" | null;
  ragStatus?: "green" | "amber" | "red" | "skipped";
  link: string;
}

interface Achievements {
  goldSessions: string[]; // ISO completedAt dates, newest first
  perfectWeeks: string[];
  aSeasons: string[];
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function localDateIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Normalise any ISO date string to local midnight to avoid timezone drift.
// e.g. "2026-04-08T23:00:00Z" in UTC+1 → local April 9, not April 8.
function toLocalMidnight(iso: string): Date {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toLocalMidnight(toIso).getTime() - toLocalMidnight(fromIso).getTime()) / 86400000);
}

function friendlyDate(iso: string): string {
  const d = toLocalMidnight(iso);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const ord = (n: number) => {
    const v = n % 100;
    return n + (["th", "st", "nd", "rd"][(v - 20) % 10] || ["th", "st", "nd", "rd"][v] || "th");
  };
  return `${days[d.getDay()]} ${ord(d.getDate())} ${months[d.getMonth()]}`;
}

function shortDate(iso: string): string {
  const d = toLocalMidnight(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
}

// Picks the shortest unambiguous label for an achievement date given its
// recency: weekday for the past week, ordinal day within this month, month
// within this year, and bare year for anything older.
function compactAchievementDate(iso: string): string {
  const d = toLocalMidnight(iso);
  const today = toLocalMidnight(localDateIso());
  const daysAgo = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (daysAgo === 0) return "Today";
  if (daysAgo >= 1 && daysAgo <= 6) {
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
  }
  if (d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth()) {
    const n = d.getDate();
    const v = n % 100;
    const suffix = ["th", "st", "nd", "rd"][(v - 20) % 10] || ["th", "st", "nd", "rd"][v] || "th";
    return `${n}${suffix}`;
  }
  if (d.getFullYear() === today.getFullYear()) {
    return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
  }
  return String(d.getFullYear());
}

function computeUpNext(
  activeSeason: SeasonInstance | null | undefined,
  weekItems: WeekInstanceItemView[],
  lastCompletedSession: SessionInstance | null
): UpNextState {
  const today = localDateIso();
  if (!activeSeason) return { type: "no_program" };

  // Active session in progress?
  const activeItem = weekItems.find(
    (item) =>
      item.weekInstanceItem.type === "session" &&
      item.sessionInstance?.status === "in_progress"
  );
  if (activeItem?.sessionInstance && activeItem.sessionTemplate) {
    return {
      type: "active_session",
      sessionId: activeItem.sessionInstance.id,
      sessionName: activeItem.sessionTemplate.name,
    };
  }

  const sessionItems = weekItems.filter(
    (item) => item.weekInstanceItem.type === "session" && item.sessionInstance
  );
  if (sessionItems.length === 0) return { type: "week_complete" };

  // Anchor week start on the first session item's scheduled date
  const anchor = sessionItems[0];
  const weekStartMs =
    toLocalMidnight(anchor.sessionInstance!.date).getTime() -
    (anchor.weekInstanceItem.order - 1) * 86400000;

  const itemDate = (item: WeekInstanceItemView) =>
    localDateIso(new Date(weekStartMs + (item.weekInstanceItem.order - 1) * 86400000));

  // Surface the oldest incomplete session regardless of whether it's past/today/future.
  // Skipped sessions count as settled — the user has opted out, so they shouldn't
  // be surfaced as "up next".
  const oldest = sessionItems
    .filter(
      (item) =>
        item.sessionInstance?.status !== "completed" &&
        item.sessionInstance?.status !== "skipped"
    )
    .sort((a, b) => a.weekInstanceItem.order - b.weekInstanceItem.order)[0];

  if (!oldest) {
    // All sessions done for this week
    return { type: "week_complete" };
  }

  const oldestDate = itemDate(oldest);

  if (oldestDate < today) {
    // If the user already finished a real session today (anywhere in the
    // season, not just the current week — finishing the last session of
    // week N rolls the dashboard into week N+1), they're unlikely to do
    // another even if a prior day's session is still overdue. Mark the
    // state so the heuristics CTA can take priority over the overdue card.
    const sessionCompletedToday =
      lastCompletedSession?.completedAt != null &&
      localDateIso(new Date(lastCompletedSession.completedAt)) === today;
    return {
      type: "overdue_session",
      sessionId: oldest.sessionInstance!.id,
      sessionName: oldest.sessionTemplate?.name ?? "Session",
      date: oldestDate,
      daysOverdue: daysBetween(oldestDate, today),
      sessionCompletedToday,
    };
  }

  if (oldestDate === today) {
    return {
      type: "today_session",
      sessionId: oldest.sessionInstance!.id,
      sessionName: oldest.sessionTemplate?.name ?? "Session",
    };
  }

  // Oldest incomplete session is in the future — check if today is a rest day
  const todayItem = weekItems.find((item) => itemDate(item) === today);
  if (todayItem?.weekInstanceItem.type === "rest") {
    return {
      type: "rest_day",
      nextSessionName: oldest.sessionTemplate?.name ?? null,
      nextDate: oldestDate,
      daysUntil: daysBetween(today, oldestDate),
    };
  }

  return {
    type: "upcoming",
    sessionId: oldest.sessionInstance!.id,
    sessionName: oldest.sessionTemplate?.name ?? "Session",
    date: oldestDate,
    daysUntil: daysBetween(today, oldestDate),
  };
}

// ─── Async loaders ────────────────────────────────────────────────────────────

async function loadTimeline(
  season: SeasonInstance
): Promise<SeasonTimelineData | null> {
  const [calendarWeeks, canonicalWeek] = await Promise.all([
    getSeasonCalendarWeeks(season.id),
    getCanonicalWeekTemplateForSeason(season.seasonTemplateId),
  ]);
  if (!canonicalWeek || calendarWeeks.length === 0) return null;

  const templateItems = (
    await getWeekTemplateItemsForWeekTemplate(canonicalWeek.id)
  ).sort((a, b) => a.order - b.order);
  if (templateItems.length === 0) return null;
  if (!season.startedAt) return null;

  const totalWeeks = calendarWeeks.length;
  const seasonStartMs = toLocalMidnight(season.startedAt).getTime();
  const seasonStartIso = localDateIso(new Date(seasonStartMs));
  const today = localDateIso();

  const inProgressWeek = calendarWeeks.find((w) => w.weekInstance?.status === "in_progress");
  const completedCount = calendarWeeks.filter((w) => w.weekInstance?.status === "completed").length;
  const currentWeekOrder = inProgressWeek?.weekOrder ?? Math.min(completedCount + 1, totalWeeks);

  // Build one DaySquare[] per week. Keeping weeks separate avoids the
  // misalignment that occurs when generated and projected weeks have different
  // lengths (e.g. a day was added to the template mid-season).
  const weeks: DaySquare[][] = [];
  let dayOffset = 0; // running total of days across all weeks (handles variable week lengths)

  for (const calendarWeek of calendarWeeks) {
    const weekSquares: DaySquare[] = [];

    if (calendarWeek.weekInstance) {
      const weekItems = (
        await getWeekInstanceItemsForWeekInstance(calendarWeek.weekInstance.id)
      ).sort((a, b) => a.order - b.order);

      for (const item of weekItems) {
        const scheduledDate = localDateIso(
          new Date(seasonStartMs + (dayOffset + item.order - 1) * 86400000)
        );

        if (item.type === "rest") {
          weekSquares.push({ type: "rest", scheduledDate, status: scheduledDate < today ? "rest-past" : "rest-future" });
          continue;
        }

        if (!item.sessionInstanceId) {
          weekSquares.push({ type: "session", scheduledDate, status: scheduledDate < today ? "overdue" : "grey" });
          continue;
        }

        const session = await getSessionInstanceById(item.sessionInstanceId);
        if (!session) {
          weekSquares.push({ type: "session", scheduledDate, status: "grey" });
          continue;
        }

        if (session.status === "skipped") {
          weekSquares.push({ type: "session", scheduledDate, status: "skipped" });
          continue;
        }

        if (session.status !== "completed") {
          weekSquares.push({ type: "session", scheduledDate, status: scheduledDate < today ? "overdue" : "grey" });
          continue;
        }

        weekSquares.push({ type: "session", scheduledDate, status: "green" });
      }

      dayOffset += weekItems.length;
    } else {
      // Week not yet generated — project from the current template. A behind
      // user may have un-generated weeks whose scheduled dates are already in
      // the past; those sessions should surface as overdue, not upcoming.
      for (const item of templateItems) {
        const scheduledDate = localDateIso(
          new Date(seasonStartMs + (dayOffset + item.order - 1) * 86400000)
        );
        const isPast = scheduledDate < today;
        if (item.type === "rest") {
          weekSquares.push({ type: "rest", scheduledDate, status: isPast ? "rest-past" : "rest-future" });
        } else {
          weekSquares.push({ type: "session", scheduledDate, status: isPast ? "overdue" : "grey" });
        }
      }

      dayOffset += templateItems.length;
    }

    weeks.push(weekSquares);
  }

  const lastWeekSquares = weeks[weeks.length - 1] ?? [];
  const endDate = lastWeekSquares[lastWeekSquares.length - 1]?.scheduledDate ?? seasonStartIso;

  // Schedule status compares actual session completions to template-expected
  // sessions. Fully-elapsed days (before today) always count as expected;
  // today's session counts only once it's done, so a still-pending session due
  // today reads as on-schedule rather than behind — matching the squares, which
  // show today as upcoming, not overdue. A session done early counts as
  // completed even if its scheduled date is still in the future.
  let sessionsCompleted = 0;
  let sessionsExpected = 0;
  for (const weekSquares of weeks) {
    for (const sq of weekSquares) {
      if (sq.type !== "session") continue;
      const done = sq.status === "green" || sq.status === "skipped";
      if (done) sessionsCompleted++;
      if (sq.scheduledDate < today || (sq.scheduledDate === today && done)) {
        sessionsExpected++;
      }
    }
  }

  return {
    startDate: seasonStartIso,
    endDate,
    totalWeeks,
    weeks,
    currentWeekOrder,
    sessionsCompleted,
    sessionsExpected,
  };
}

async function loadRecentDays(season: SeasonInstance): Promise<RecentDaysData | null> {
  if (!season.startedAt) return null;

  const seasonStartMs = toLocalMidnight(season.startedAt).getTime();
  const todayMs = toLocalMidnight(localDateIso()).getTime();
  const daysSinceStart = Math.round((todayMs - seasonStartMs) / 86400000);
  if (daysSinceStart < 0) return null;

  const [calendarWeeks, canonicalWeek] = await Promise.all([
    getSeasonCalendarWeeks(season.id),
    getCanonicalWeekTemplateForSeason(season.seasonTemplateId),
  ]);
  if (!canonicalWeek) return null;

  const templateItems = (
    await getWeekTemplateItemsForWeekTemplate(canonicalWeek.id)
  ).sort((a, b) => a.order - b.order);
  if (templateItems.length === 0) return null;

  // Hide until the calendar reaches the start of program week 2 — a single
  // partial row isn't useful and the block needs at least one finished week of
  // context to be readable.
  if (daysSinceStart < templateItems.length) return null;

  type Slot = {
    type: "session" | "rest";
    sessionInstance: SessionInstance | null;
    originalDateIso: string;
  };
  const slots: Slot[] = [];
  // Day-index span of each program week. Generated weeks keep their original
  // snapshotted length, so after a mid-season template change earlier weeks can
  // be shorter/longer than the current template — the actual-schedule rows are
  // built from these spans (not a fixed width) so each "Week N" row maps to one
  // real week. See the row-building loop below.
  const weekSpans: { start: number; length: number }[] = [];
  let dayOffset = 0;

  for (const calWeek of calendarWeeks) {
    const weekStart = dayOffset;
    if (calWeek.weekInstance) {
      const items = (
        await getWeekInstanceItemsForWeekInstance(calWeek.weekInstance.id)
      ).sort((a, b) => a.order - b.order);
      for (const item of items) {
        const originalDateIso = localDateIso(
          new Date(seasonStartMs + (dayOffset + item.order - 1) * 86400000)
        );
        if (item.type === "session") {
          const session = item.sessionInstanceId
            ? await getSessionInstanceById(item.sessionInstanceId)
            : null;
          slots.push({ type: "session", sessionInstance: session ?? null, originalDateIso });
        } else {
          slots.push({ type: "rest", sessionInstance: null, originalDateIso });
        }
      }
      dayOffset += items.length;
    } else {
      for (const item of templateItems) {
        const originalDateIso = localDateIso(
          new Date(seasonStartMs + (dayOffset + item.order - 1) * 86400000)
        );
        slots.push({ type: item.type as "session" | "rest", sessionInstance: null, originalDateIso });
      }
      dayOffset += templateItems.length;
    }
    weekSpans.push({ start: weekStart, length: dayOffset - weekStart });
  }

  // Index completed sessions by their actual completion date. Skipped sessions
  // count toward "settled" (so they appear in completedDates for the
  // ahead/behind tally) but their square placement is decided separately
  // below — see `relocatedSkippedDates` and `settleSkipTotals`.
  const completedByDate = new Map<string, Slot>();
  const completedDates: string[] = [];
  for (const slot of slots) {
    if (slot.type !== "session" || !slot.sessionInstance?.completedAt) continue;
    const settledDate = localDateIso(toLocalMidnight(slot.sessionInstance.completedAt));
    if (slot.sessionInstance.status === "completed") {
      completedByDate.set(settledDate, slot);
      completedDates.push(settledDate);
    } else if (slot.sessionInstance.status === "skipped") {
      completedDates.push(settledDate);
    }
  }

  // List of originally-projected dates for every session slot in the template.
  const sessionOriginalDates: string[] = slots
    .filter((s) => s.type === "session")
    .map((s) => s.originalDateIso);

  function countLessOrEqual(dates: string[], target: string): number {
    let n = 0;
    for (const d of dates) if (d <= target) n++;
    return n;
  }

  // Background classification for a date when no settled-session marker is
  // claiming it — either a rest cross (caught-up) or a behind-rest / grey cell.
  function fallbackStatus(dateIso: string, isToday: boolean): RecentDayStatus {
    const actualThrough = countLessOrEqual(completedDates, dateIso);
    const expectedThrough = countLessOrEqual(sessionOriginalDates, dateIso);
    if (isToday) {
      // Today is still in progress: never render as rest-behind, because the
      // user could still salvage the day by training. If they're caught up
      // including today's slot, show as on-schedule rest; otherwise grey
      // (upcoming gym day, which behind users will see until they train).
      return actualThrough >= expectedThrough ? "rest-past" : "grey";
    }
    return actualThrough < expectedThrough ? "rest-behind" : "rest-past";
  }

  // Relocate skipped-session markers onto the day each one was originally
  // scheduled for, when (a) that day is in the past and (b) it currently
  // renders as a rest cross. This surfaces skips on the slot they belonged to
  // rather than on whatever day the user pressed Skip.
  const todayIsoStr = localDateIso(new Date(todayMs));
  const relocatedSkippedDates = new Set<string>();
  // Per-settle-date counts so a relocation only "frees up" the original cell
  // when every skip on that settle date has somewhere else to go.
  const settleSkipTotals = new Map<string, number>();
  const settleSkipRelocated = new Map<string, number>();
  // Iterate in original-date order for deterministic placement when two skips
  // ever target the same fallback X.
  const skippedSlots = slots
    .filter(
      (s): s is Slot & { sessionInstance: SessionInstance } =>
        s.type === "session"
        && s.sessionInstance != null
        && s.sessionInstance.status === "skipped"
        && s.sessionInstance.completedAt != null
    )
    .sort((a, b) => a.originalDateIso.localeCompare(b.originalDateIso));
  for (const slot of skippedSlots) {
    const settleDate = localDateIso(toLocalMidnight(slot.sessionInstance.completedAt!));
    settleSkipTotals.set(settleDate, (settleSkipTotals.get(settleDate) ?? 0) + 1);
    const originalDate = slot.originalDateIso;
    if (originalDate >= todayIsoStr) continue;
    if (originalDate === settleDate) continue;
    if (completedByDate.has(originalDate)) continue;
    if (relocatedSkippedDates.has(originalDate)) continue;
    const fallback = fallbackStatus(originalDate, false);
    if (fallback !== "rest-past" && fallback !== "rest-behind") continue;
    relocatedSkippedDates.add(originalDate);
    settleSkipRelocated.set(settleDate, (settleSkipRelocated.get(settleDate) ?? 0) + 1);
  }

  function buildCell(dateMs: number, isToday: boolean): RecentDayCell {
    const dateIso = localDateIso(new Date(dateMs));
    const hasCompleted = completedByDate.has(dateIso);
    // A skip stays on its settle date only if at least one skip on that date
    // wasn't relocated; relocated markers appear on their original-scheduled
    // day instead.
    const settleSkipsRemaining =
      (settleSkipTotals.get(dateIso) ?? 0) - (settleSkipRelocated.get(dateIso) ?? 0);
    const hasSkipped = settleSkipsRemaining > 0 || relocatedSkippedDates.has(dateIso);
    if (hasCompleted && hasSkipped) {
      return { dateIso, status: "green-skipped", isToday };
    }
    if (hasCompleted) {
      return { dateIso, status: "green", isToday };
    }
    if (hasSkipped) {
      return { dateIso, status: "skipped", isToday };
    }
    return { dateIso, status: fallbackStatus(dateIso, isToday), isToday };
  }

  // One row per program week, each spanning that week's actual length. A fixed
  // width keyed off the current template would, after a mid-season length
  // change, bleed a neighbouring week's session into the wrong week's tally
  // (e.g. a 9-day week 1 charged against a 10-day row picks up week 2's first
  // session → "3/7"). With non-7 weeks the weekday alignment shifts each row,
  // so headers are computed per-row from the actual calendar dates.
  const allLetters = ["S", "M", "T", "W", "T", "F", "S"];
  // Today's session is still in progress, so it shouldn't be charged against the
  // ahead/behind tally until the day is actually missed — mirroring the cells,
  // which render today as grey/upcoming rather than rest-behind. Drop any session
  // originally scheduled for today that hasn't settled from the "expected" count.
  const todayUnsettledExpected = slots.filter(
    (s) =>
      s.type === "session"
      && s.originalDateIso === todayIsoStr
      && s.sessionInstance?.status !== "completed"
      && s.sessionInstance?.status !== "skipped"
  ).length;
  const rows: RecentDayRow[] = [];
  let prevDoneCum = 0;
  let prevExpectedCum = 0;
  for (const { start, length } of weekSpans) {
    if (start > daysSinceStart) break; // week hasn't begun yet
    const cells: (RecentDayCell | null)[] = [];
    const headerLetters: string[] = [];
    for (let c = 0; c < length; c++) {
      const dayIndex = start + c;
      const dms = seasonStartMs + dayIndex * 86400000;
      headerLetters.push(allLetters[new Date(dms).getDay()]);
      if (dayIndex > daysSinceStart) {
        cells.push(null);
      } else {
        cells.push(buildCell(dms, dayIndex === daysSinceStart));
      }
    }
    // Cap the in-progress (last started) week at today so expected/delta don't
    // yet include sessions scheduled later this week. Earlier weeks have fully
    // elapsed, so their end index is already <= daysSinceStart.
    const lastDayIndex = Math.min(start + length - 1, daysSinceStart);
    const lastDayIso = localDateIso(new Date(seasonStartMs + lastDayIndex * 86400000));
    const doneCum = countLessOrEqual(completedDates, lastDayIso);
    // Only the in-progress week ends on today; past weeks end before it, so this
    // adjustment leaves their expected counts untouched.
    const expectedCum = countLessOrEqual(sessionOriginalDates, lastDayIso)
      - (lastDayIso === todayIsoStr ? todayUnsettledExpected : 0);
    const done = doneCum - prevDoneCum;
    const expected = expectedCum - prevExpectedCum;
    const delta = doneCum - expectedCum;
    prevDoneCum = doneCum;
    prevExpectedCum = expectedCum;
    rows.push({ cols: length, cells, headerLetters, done, expected, delta });
  }

  return { rows };
}

async function buildSessionCard(session: SessionInstance): Promise<RecentCard | null> {
  try {
    const view = await getSessionInstanceView(session.id);
    if (!view) return null;
    if (session.status === "skipped") {
      return {
        id: session.id,
        name: view.sessionTemplate?.name ?? "Session",
        grade: null,
        gradeColor: "red",
        ragStatus: "skipped",
        link: `/session/${session.id}/summary`,
      };
    }
    // Read the frozen-or-backfilled score (the same source the session report
    // uses) rather than recomputing live. A live recompute drifts from the
    // frozen report whenever the scoring logic changes, so the card and the
    // report it links to could disagree (e.g. gold here, silver on click-in).
    const m = await getSessionMetrics(session);
    if (!m) return null;
    const color = m.ragStatus;
    return {
      id: session.id,
      name: view.sessionTemplate?.name ?? "Session",
      grade: null,
      gradeColor: color,
      ragStatus: color,
      link: `/session/${session.id}/summary`,
    };
  } catch {
    return null;
  }
}

async function buildWeekCard(week: WeekInstance): Promise<RecentCard | null> {
  try {
    const wm = await getWeekMetrics(week);
    const scoreColor: "green" | "amber" | "red" | "grey" = week.endedEarly
      ? "grey"
      : wm.weekScore >= 96 ? "green" : wm.weekScore >= 88 ? "amber" : "red";
    return {
      id: week.id,
      name: `Week ${week.order}`,
      grade: emojiForRating(wm.emojiRating),
      gradeKind: "emoji",
      gradeColor: scoreColor,
      link: `/week/${week.id}/summary`,
    };
  } catch {
    return null;
  }
}

async function buildSeasonCard(season: SeasonInstance): Promise<RecentCard | null> {
  try {
    const sm = await getSeasonMetrics(season);
    return {
      id: season.id,
      name: season.name,
      grade: sm.grade,
      gradeKind: "letter",
      gradeColor: gradeColor(sm.grade),
      link: `/season/${season.id}/summary`,
    };
  } catch {
    return null;
  }
}

async function loadAchievements(): Promise<Achievements> {
  const [allSessions, allWeeks, allSeasons] = await Promise.all([
    getAll<SessionInstance>(STORE_NAMES.sessionInstances),
    getAll<WeekInstance>(STORE_NAMES.weekInstances),
    getAll<SeasonInstance>(STORE_NAMES.seasonInstances),
  ]);

  // Read each settled record's frozen metrics (computed + cached on first
  // access). Earlier dashboard loads pay the one-time backfill; after that this
  // is just stored-value reads — no session-view rebuilds.

  const goldSessions: string[] = [];
  for (const s of allSessions) {
    if (s.status !== "completed" || !s.completedAt) continue;
    const m = await getSessionMetrics(s);
    if (m && m.ragStatus === "green") goldSessions.push(s.completedAt);
  }
  goldSessions.sort((a, b) => b.localeCompare(a));

  // Star-eyed weeks: emojiRating 1 (score ≥ 100). Exclude force-completed weeks
  // since the recent-week card already paints them grey rather than green.
  const perfectWeeks: string[] = [];
  for (const w of allWeeks) {
    if (w.status !== "completed" || w.endedEarly || !w.completedAt) continue;
    const wm = await getWeekMetrics(w);
    if (wm.emojiRating === 1) perfectWeeks.push(w.completedAt);
  }
  perfectWeeks.sort((a, b) => b.localeCompare(a));

  const aSeasons: string[] = [];
  for (const season of allSeasons) {
    if (season.status !== "completed" || !season.completedAt) continue;
    const sm = await getSeasonMetrics(season);
    if (sm.grade === "A") aSeasons.push(season.completedAt);
  }
  aSeasons.sort((a, b) => b.localeCompare(a));

  return { goldSessions, perfectWeeks, aSeasons };
}

// ─── AchievementsShelf ────────────────────────────────────────────────────────
// Shared between the real dashboard render and the tutorial mock so both
// render with identical markup, CSS, and ResizeObserver-driven placeholder
// fill. Date labels are pre-formatted by the caller (the live render passes
// values through compactAchievementDate; the mock passes static labels).

// Must match the slot width set on `.dashboard-achievement` in the CSS so the
// column-count math matches what the browser actually lays out.
const ACHIEVEMENT_SLOT_WIDTH = 44;

interface ShelfIndividual {
  icon: string;
  iconClass?: string;
  displayDate: string;
}

interface ShelfBucket {
  icon: string;
  iconClass?: string;
  count: number;
  // Period this aggregate covers: "Jun 2026" for an earlier-this-year month
  // bucket, "2025" for a previous-year bucket.
  label: string;
}

interface AchievementsShelfProps {
  individuals: ShelfIndividual[];
  buckets: ShelfBucket[];
}

// Bucket glow opacity as a function of its count. Bounds are ABSOLUTE (not
// relative to the user's own max), so an ×25 bucket glows identically for every
// user regardless of whether their largest bucket is ×27 or ×1000. A gentle log
// curve keeps small counts faint and large counts from blowing out: ×1 ≈ 0.12,
// ×25 ≈ 0.30, ×100 ≈ 0.38, capped at 0.42 by ~×200.
function bucketGlowAlpha(count: number): number {
  const MIN = 0.12;
  const MAX = 0.42;
  const SLOPE = 0.057;
  const alpha = MIN + SLOPE * Math.log(Math.max(1, count));
  return Math.round(Math.min(MAX, alpha) * 1000) / 1000;
}

function AchievementsShelf({ individuals, buckets }: AchievementsShelfProps) {
  const shelfRef = useRef<HTMLDivElement | null>(null);
  const [columns, setColumns] = useState(0);

  useLayoutEffect(() => {
    const el = shelfRef.current;
    if (!el) {
      setColumns(0);
      return;
    }
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      // contentRect.width is the inner width (excluding padding), which matches
      // the area items actually wrap inside — so dividing by SLOT_WIDTH yields
      // the column count the browser is using.
      setColumns(
        Math.max(1, Math.floor(entry.contentRect.width / ACHIEVEMENT_SLOT_WIDTH))
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const totalRendered = individuals.length + buckets.length;
  const placeholderCount =
    columns > 0
      ? (columns - (totalRendered % columns)) % columns
      : 0;

  return (
    <div className="dashboard-achievements" ref={shelfRef}>
      {individuals.map((item, i) => (
        <div key={`i${i}`} className="dashboard-achievement">
          <span
            className={["dashboard-achievement__icon", item.iconClass]
              .filter(Boolean)
              .join(" ")}
          >
            {item.icon}
          </span>
          <span className="dashboard-achievement__date">{item.displayDate}</span>
        </div>
      ))}
      {buckets.map((bucket, i) => (
        <div
          key={`b${i}`}
          className="dashboard-achievement dashboard-achievement--count"
          style={
            { "--bucket-glow": bucketGlowAlpha(bucket.count) } as React.CSSProperties
          }
        >
          <span
            className={["dashboard-achievement__icon", bucket.iconClass]
              .filter(Boolean)
              .join(" ")}
          >
            {bucket.icon}
            <span className="dashboard-achievement__count">×{bucket.count}</span>
          </span>
          <span className="dashboard-achievement__date">{bucket.label}</span>
        </div>
      ))}
      {Array.from({ length: placeholderCount }, (_, i) => (
        <div
          key={`p${i}`}
          className="dashboard-achievement dashboard-achievement--placeholder"
          aria-hidden="true"
        >
          <span className="dashboard-achievement__slot" />
        </div>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

const LOADING_CARD = Symbol("loading");

export default function DashboardPage() {
  const navigate = useNavigate();
  const cancelled = useRef(false);

  const [isDesktop] = useState(() => window.innerWidth >= 1024);
  const [loaderDone, setLoaderDone] = useState(false);
  const [upNext, setUpNext] = useState<UpNextState>({ type: "loading" });
  const [seasonTimeline, setSeasonTimeline] = useState<SeasonTimelineData | null>(null);
  const [isPreviousSeason, setIsPreviousSeason] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [recentDays, setRecentDays] = useState<RecentDaysData | null>(null);
  const [recentDaysLoading, setRecentDaysLoading] = useState(true);
  const [recentSession, setRecentSession] = useState<RecentCard | null | typeof LOADING_CARD>(LOADING_CARD);
  const [recentWeek, setRecentWeek] = useState<RecentCard | null | typeof LOADING_CARD>(LOADING_CARD);
  const [recentSeason, setRecentSeason] = useState<RecentCard | null | typeof LOADING_CARD>(LOADING_CARD);
  const [prEvents, setPrEvents] = useState<PREvent[] | null>(null);
  // Histories keyed by exercise name for every PR sharing the most recent PR
  // date (one card per same-date PR). null while still loading.
  const [spotlightHistories, setSpotlightHistories] = useState<
    Record<string, ExerciseSessionDataPoint[]> | null
  >(null);
  const [recentTooltipOpen, setRecentTooltipOpen] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<string | null | "loading">("loading");
  const [hasSettledWeek, setHasSettledWeek] = useState<boolean | "loading">("loading");
  const [achievements, setAchievements] = useState<Achievements | null>(null);
  const [pendingHeuristicDays, setPendingHeuristicDays] = useState(0);
  const [exerciseNeedingWeight, setExerciseNeedingWeight] = useState<
    { exerciseTemplateId: string; exerciseName: string; sessionName: string } | null
  >(null);
  const [yearReviewYear, setYearReviewYear] = useState<number | null>(null);
  const recentTooltipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!recentTooltipRef.current?.contains(e.target as Node)) {
        setRecentTooltipOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Year in Review CTA: visible for the whole review window whenever the
  // review year has data. Deliberately not gated by the one-time interstitial
  // flag, which only suppresses the app-open prompt.
  useEffect(() => {
    const { inWindow, reviewYear } = getYearInReviewState();
    if (!inWindow) return;
    let cancel = false;
    hasAnyReviewData(reviewYear).then((hasData) => {
      if (!cancel && hasData) setYearReviewYear(reviewYear);
    });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    cancelled.current = false;

    async function loadBase() {
      const [activeSeason, weekItems, lastCompletedSession] = await Promise.all([
        getActiveSeasonInstance(),
        getWeekInstanceItemsForCurrentWeek(),
        getLastCompletedSessionInstance(),
      ]);
      if (cancelled.current) return;

      setUpNext(computeUpNext(activeSeason, weekItems, lastCompletedSession));

      const seasonToShow = activeSeason ?? (await getLastEndedSeasonInstance());
      if (cancelled.current) return;
      if (seasonToShow) {
        const isPrev = !activeSeason;
        loadTimeline(seasonToShow).then((tl) => {
          if (!cancelled.current) {
            setSeasonTimeline(tl);
            setIsPreviousSeason(isPrev);
            setTimelineLoading(false);
          }
        });
      } else {
        setTimelineLoading(false);
      }

      // Day-by-day grid is anchored to "now" — only render for an active season.
      if (activeSeason) {
        loadRecentDays(activeSeason).then((data) => {
          if (!cancelled.current) {
            setRecentDays(data);
            setRecentDaysLoading(false);
          }
        });

        findExerciseNeedingWeight(activeSeason.id).then((ex) => {
          if (!cancelled.current) setExerciseNeedingWeight(ex);
        });
      } else {
        setRecentDaysLoading(false);
      }

      loadSecondary();
    }

    async function loadSecondary() {
      const [lastSession, lastWeek, lastSeason, prList] = await Promise.all([
        getLastCompletedSessionInstance(),
        getLastCompletedWeekInstance(),
        getLastEndedSeasonInstance(),
        getAllTimePREvents(),
      ]);
      if (cancelled.current) return;

      setPrEvents(prList);

      // Fetch histories for every exercise that PR'd on the most recent PR
      // date — multiple exercises can share that date and all get stacked.
      const spotlightDate = prList[0]?.date ?? null;
      const spotlightNames = spotlightDate
        ? [
            ...new Set(
              prList.filter((p) => p.date === spotlightDate).map((p) => p.exerciseName)
            ),
          ]
        : [];
      if (spotlightNames.length > 0) {
        Promise.all(
          spotlightNames.map((name) =>
            getExerciseSessionHistory(name).then((h) => [name, h] as const)
          )
        ).then((entries) => {
          if (!cancelled.current) setSpotlightHistories(Object.fromEntries(entries));
        });
      } else {
        setSpotlightHistories({});
      }

      const [sessionCard, weekCard, seasonCard] = await Promise.all([
        lastSession ? buildSessionCard(lastSession) : null,
        lastWeek ? buildWeekCard(lastWeek) : null,
        lastSeason ? buildSeasonCard(lastSeason) : null,
      ]);
      if (cancelled.current) return;

      setRecentSession(sessionCard);
      setRecentWeek(weekCard);
      setRecentSeason(seasonCard);

      const a = await loadAchievements();
      if (cancelled.current) return;
      setAchievements(a);
    }

    loadBase();

    return () => {
      cancelled.current = true;
    };
  }, []);

  useEffect(() => {
    getById<{ key: string; value: string }>(STORE_NAMES.meta, "lastBackupAt").then(
      (record) => setLastBackupAt(record?.value ?? null)
    );
    getLastCompletedWeekInstance().then((w) => setHasSettledWeek(w != null));
  }, []);

  useEffect(() => {
    async function loadHeuristics() {
      if (!(await isHeuristicsEnabled())) return;
      const pending = await getPendingHeuristicDates(3);
      setPendingHeuristicDays(pending.length);
    }
    loadHeuristics();
  }, []);

  // Cards that yield priority to a higher-priority secondary CTA (exercise
  // needing weight, then heuristics, in that order). Sessions in active/today
  // states never yield — only states where the user is between sessions or
  // their overdue card has already been deprioritised by a completion today.
  const yieldsToSecondaryCta =
    upNext.type === "rest_day" ||
    upNext.type === "upcoming" ||
    upNext.type === "week_complete" ||
    (upNext.type === "overdue_session" && upNext.sessionCompletedToday);

  const showExerciseNeedsWeight = exerciseNeedingWeight != null && yieldsToSecondaryCta;
  const showHeuristicsUpNext =
    !showExerciseNeedsWeight && pendingHeuristicDays > 0 && yieldsToSecondaryCta;

  function renderExerciseNeedsWeightCard() {
    if (!exerciseNeedingWeight) return null;
    const { exerciseTemplateId, exerciseName, sessionName } = exerciseNeedingWeight;
    const target = `/config/exercises/${exerciseTemplateId}?returnTo=${encodeURIComponent("/")}`;
    return (
      <div
        className="dashboard-up-next dashboard-up-next--heuristics dashboard-up-next--with-cta"
        role="button"
        tabIndex={0}
        onClick={() => navigate(target)}
        onKeyDown={(e) => e.key === "Enter" && navigate(target)}
      >
        <div className="dashboard-up-next__content">
          <span className="dashboard-up-next__pill dashboard-up-next__pill--heuristics">Up next</span>
          <p className="dashboard-up-next__heading">Set working weight</p>
          <p className="dashboard-up-next__sub">{exerciseName} · {sessionName}</p>
        </div>
        <span className="dashboard-up-next__cta dashboard-up-next__cta--heuristics">Configure →</span>
      </div>
    );
  }

  // ─── Up Next ──────────────────────────────────────────────────────────────

  function renderUpNext() {
    switch (upNext.type) {
      case "loading":
        return (
          <div className="dashboard-up-next dashboard-up-next--loading">
            <span className="dashboard-up-next__label">Loading…</span>
          </div>
        );

      case "no_program":
        return (
          <div className="dashboard-up-next dashboard-up-next--muted">
            <span className="dashboard-up-next__pill">No program</span>
            <p className="dashboard-up-next__heading">Start a program to begin training.</p>
            <button
              type="button"
              className="dashboard-up-next__action"
              onClick={() => navigate("/season")}
            >
              Browse programs →
            </button>
          </div>
        );

      case "active_session":
        return (
          <div
            className="dashboard-up-next dashboard-up-next--active dashboard-up-next--with-cta"
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/session/${upNext.sessionId}`)}
            onKeyDown={(e) => e.key === "Enter" && navigate(`/session/${upNext.sessionId}`)}
          >
            <div className="dashboard-up-next__content">
              <span className="dashboard-up-next__pill dashboard-up-next__pill--active">In progress</span>
              <p className="dashboard-up-next__heading">{upNext.sessionName}</p>
            </div>
            <span className="dashboard-up-next__cta dashboard-up-next__cta--active">Continue session →</span>
          </div>
        );

      case "overdue_session":
        if (showExerciseNeedsWeight) {
          return renderExerciseNeedsWeightCard();
        }
        if (showHeuristicsUpNext) {
          return (
            <div
              className="dashboard-up-next dashboard-up-next--heuristics dashboard-up-next--with-cta"
              role="button"
              tabIndex={0}
              onClick={() => navigate("/heuristics")}
              onKeyDown={(e) => e.key === "Enter" && navigate("/heuristics")}
            >
              <div className="dashboard-up-next__content">
                <span className="dashboard-up-next__pill dashboard-up-next__pill--heuristics">Up next</span>
                <p className="dashboard-up-next__heading">Log today's heuristics</p>
                <p className="dashboard-up-next__sub">
                  {pendingHeuristicDays === 1
                    ? "1 day to fill in"
                    : `${pendingHeuristicDays} days to fill in`}
                </p>
              </div>
              <span className="dashboard-up-next__cta dashboard-up-next__cta--heuristics">Log heuristics →</span>
            </div>
          );
        }
        return (
          <div
            className="dashboard-up-next dashboard-up-next--overdue dashboard-up-next--with-cta"
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/session/${upNext.sessionId}`)}
            onKeyDown={(e) => e.key === "Enter" && navigate(`/session/${upNext.sessionId}`)}
          >
            <div className="dashboard-up-next__content">
              <span className="dashboard-up-next__pill dashboard-up-next__pill--overdue">
                {upNext.daysOverdue === 1 ? "1 day overdue" : `${upNext.daysOverdue} days overdue`}
              </span>
              <p className="dashboard-up-next__heading">{upNext.sessionName}</p>
              <p className="dashboard-up-next__sub">{friendlyDate(upNext.date)}</p>
            </div>
            <span className="dashboard-up-next__cta dashboard-up-next__cta--overdue">View session →</span>
          </div>
        );

      case "today_session":
        return (
          <div
            className="dashboard-up-next dashboard-up-next--today dashboard-up-next--with-cta"
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/session/${upNext.sessionId}`)}
            onKeyDown={(e) => e.key === "Enter" && navigate(`/session/${upNext.sessionId}`)}
          >
            <div className="dashboard-up-next__content">
              <span className="dashboard-up-next__pill dashboard-up-next__pill--today">Today</span>
              <p className="dashboard-up-next__heading">{upNext.sessionName}</p>
            </div>
            <span className="dashboard-up-next__cta dashboard-up-next__cta--today">View session →</span>
          </div>
        );

      case "rest_day":
        if (showExerciseNeedsWeight) {
          return renderExerciseNeedsWeightCard();
        }
        if (showHeuristicsUpNext) {
          return (
            <div
              className="dashboard-up-next dashboard-up-next--heuristics dashboard-up-next--with-cta"
              role="button"
              tabIndex={0}
              onClick={() => navigate("/heuristics")}
              onKeyDown={(e) => e.key === "Enter" && navigate("/heuristics")}
            >
              <div className="dashboard-up-next__content">
                <span className="dashboard-up-next__pill dashboard-up-next__pill--heuristics">Rest day</span>
                <p className="dashboard-up-next__heading">Log today's heuristics</p>
                <p className="dashboard-up-next__sub">
                  {pendingHeuristicDays === 1
                    ? "1 day to fill in"
                    : `${pendingHeuristicDays} days to fill in`}
                </p>
              </div>
              <span className="dashboard-up-next__cta dashboard-up-next__cta--heuristics">Log heuristics →</span>
            </div>
          );
        }
        return (
          <div className="dashboard-up-next dashboard-up-next--rest">
            <span className="dashboard-up-next__pill">Rest day</span>
            <p className="dashboard-up-next__heading">Today is a rest day.</p>
            {upNext.nextSessionName && upNext.nextDate && (
              <p className="dashboard-up-next__sub">
                Next: {upNext.nextSessionName} on{" "}
                <strong>{friendlyDate(upNext.nextDate)}</strong>
                {upNext.daysUntil === 1 ? " (tomorrow)" : upNext.daysUntil != null ? ` (in ${upNext.daysUntil} days)` : ""}
              </p>
            )}
          </div>
        );

      case "upcoming":
        if (showExerciseNeedsWeight) {
          return renderExerciseNeedsWeightCard();
        }
        if (showHeuristicsUpNext) {
          return (
            <div
              className="dashboard-up-next dashboard-up-next--heuristics dashboard-up-next--with-cta"
              role="button"
              tabIndex={0}
              onClick={() => navigate("/heuristics")}
              onKeyDown={(e) => e.key === "Enter" && navigate("/heuristics")}
            >
              <div className="dashboard-up-next__content">
                <span className="dashboard-up-next__pill dashboard-up-next__pill--heuristics">Heuristics</span>
                <p className="dashboard-up-next__heading">Log today's heuristics</p>
                <p className="dashboard-up-next__sub">
                  {pendingHeuristicDays === 1
                    ? "1 day to fill in"
                    : `${pendingHeuristicDays} days to fill in`}
                  {" · "}Next session {upNext.daysUntil === 1 ? "tomorrow" : `in ${upNext.daysUntil} days`}
                </p>
              </div>
              <span className="dashboard-up-next__cta dashboard-up-next__cta--heuristics">Log heuristics →</span>
            </div>
          );
        }
        return (
          <div className="dashboard-up-next dashboard-up-next--upcoming">
            <span className="dashboard-up-next__pill">
              {upNext.daysUntil === 1 ? "Tomorrow" : `In ${upNext.daysUntil} days`}
            </span>
            <p className="dashboard-up-next__heading">{upNext.sessionName}</p>
            <p className="dashboard-up-next__sub">{friendlyDate(upNext.date)}</p>
          </div>
        );

      case "week_complete":
        if (showExerciseNeedsWeight) {
          return renderExerciseNeedsWeightCard();
        }
        if (showHeuristicsUpNext) {
          return (
            <div
              className="dashboard-up-next dashboard-up-next--heuristics dashboard-up-next--with-cta"
              role="button"
              tabIndex={0}
              onClick={() => navigate("/heuristics")}
              onKeyDown={(e) => e.key === "Enter" && navigate("/heuristics")}
            >
              <div className="dashboard-up-next__content">
                <span className="dashboard-up-next__pill dashboard-up-next__pill--heuristics">Week complete</span>
                <p className="dashboard-up-next__heading">Log today's heuristics</p>
                <p className="dashboard-up-next__sub">
                  {pendingHeuristicDays === 1
                    ? "1 day to fill in"
                    : `${pendingHeuristicDays} days to fill in`}
                </p>
              </div>
              <span className="dashboard-up-next__cta dashboard-up-next__cta--heuristics">Log heuristics →</span>
            </div>
          );
        }
        return (
          <div className="dashboard-up-next dashboard-up-next--muted">
            <span className="dashboard-up-next__pill">Week complete</span>
            <p className="dashboard-up-next__heading">All sessions done. Check back next week.</p>
          </div>
        );
    }
  }

  // ─── Season timeline ──────────────────────────────────────────────────────

  function renderPlannedSchedule() {
    if (!seasonTimeline) return null;
    const { startDate, endDate, weeks, currentWeekOrder, sessionsCompleted, sessionsExpected, totalWeeks } = seasonTimeline;
    const isAhead = sessionsCompleted > sessionsExpected;
    const isBehind = sessionsCompleted < sessionsExpected;
    const today = localDateIso();

    const statusLabel = isAhead ? "Ahead of schedule" : isBehind ? "Behind schedule" : "On schedule";
    const statusClass = isAhead ? "dashboard-timeline__status--ahead"
      : isBehind ? "dashboard-timeline__status--behind"
      : "dashboard-timeline__status--ok";

    return (
      <section className="dashboard-section">
        <h2 className="dashboard-section-title">{isPreviousSeason ? "Previous season" : "Season progress"}</h2>
        <div className="dashboard-timeline">
          <div className="dashboard-timeline__label">Schedule (planned)</div>
          <div className="dashboard-timeline__body">
            {/* Left: week-row grid — auto-sizing squares to fill 50% width */}
            <div className="dashboard-timeline__grid">
              {weeks.map((week, wi) => (
                <div key={wi} className="dashboard-timeline__week-row">
                  <span className="dashboard-timeline__week-label">W{wi + 1}</span>
                  <div
                    className="dashboard-timeline__days"
                    style={{ ["--day-count" as string]: week.length }}
                  >
                    {week.map((day, di) => {
                      const isToday = day.scheduledDate === today;
                      const classes = [
                        "dashboard-timeline__day",
                        `dashboard-timeline__day--${day.status}`,
                        day.type === "rest" ? "dashboard-timeline__day--rest" : "",
                        isToday ? "dashboard-timeline__day--today" : "",
                      ].filter(Boolean).join(" ");
                      return (
                        <div key={di} className="dashboard-timeline__slot">
                          <div className={classes} title={day.scheduledDate} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Right: status + dates */}
            <div className="dashboard-timeline__sidebar">
              <div className="dashboard-timeline__sidebar-status">
                <span className="dashboard-timeline__sidebar-week">Week {currentWeekOrder} of {totalWeeks}</span>
                <span className={statusClass}>{statusLabel}</span>
              </div>
              <div className="dashboard-timeline__sidebar-dates">
                <div className="dashboard-timeline__sidebar-date">
                  <span className="dashboard-timeline__sidebar-caption">Start</span>
                  <span className="dashboard-timeline__sidebar-value">{shortDate(startDate)}</span>
                </div>
                <div className="dashboard-timeline__sidebar-date">
                  <span className="dashboard-timeline__sidebar-caption">Finish</span>
                  <span className="dashboard-timeline__sidebar-value">{shortDate(endDate)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Legend */}
          {(() => {
            const allSquares = weeks.flat();
            const statuses = new Set(allSquares.map((d) => d.status));
            const hasRest = allSquares.some((d) => d.type === "rest");
            const todayDay = allSquares.find((d) => d.scheduledDate === today);

            function chip(key: string, icon: React.ReactNode, label: string) {
              return (
                <span key={key} className="dashboard-timeline__legend-chip">
                  {icon}
                  <span className="dashboard-timeline__legend-label">{label}</span>
                </span>
              );
            }

            const entries: React.ReactNode[] = [];
            if (statuses.has("green")) entries.push(chip("green",
              <span className="dashboard-timeline__legend-item dashboard-timeline__legend-item--green" />, "Done"));
            if (statuses.has("skipped")) entries.push(chip("skipped",
              <span className="dashboard-timeline__legend-item dashboard-timeline__legend-item--skipped" />, "Skipped"));
            if (statuses.has("overdue")) entries.push(chip("overdue",
              <span className="dashboard-timeline__legend-item dashboard-timeline__legend-item--overdue" />, "Overdue"));
            if (statuses.has("grey")) entries.push(chip("grey",
              <span className="dashboard-timeline__legend-item dashboard-timeline__legend-item--grey" />, "Upcoming"));
            if (hasRest) entries.push(chip("rest",
              <span className="dashboard-timeline__legend-dot dashboard-timeline__legend-dot--rest" />, "Rest"));
            if (todayDay) {
              const todayClasses = [
                "dashboard-timeline__legend-day--today",
                `dashboard-timeline__day--${todayDay.status}`,
                todayDay.type === "rest" ? "dashboard-timeline__day--rest" : "",
                "dashboard-timeline__day--today",
              ].filter(Boolean).join(" ");
              entries.push(chip("today", <span className={todayClasses} />, "Today"));
            }
            return entries.length > 0 ? (
              <div className="dashboard-timeline__legend">{entries}</div>
            ) : null;
          })()}
        </div>
      </section>
    );
  }

  function renderActualSchedule() {
    if (!recentDays) return null;
    return (
      <section className="dashboard-section">
        <div className="dashboard-timeline-recent">
          <div className="dashboard-timeline-recent__label">Schedule (actual)</div>
          <div className="dashboard-timeline-recent__grid">
              {recentDays.rows.map((row, ri) => {
                const deltaLabel = row.delta > 0
                  ? `${row.delta} day${row.delta === 1 ? "" : "s"} ahead`
                  : row.delta < 0
                    ? `${-row.delta} day${row.delta === -1 ? "" : "s"} behind`
                    : "On track";
                const deltaModifier = row.delta > 0 ? "ahead" : row.delta < 0 ? "behind" : "ok";
                return (
                  <div key={ri} className="dashboard-timeline-recent__row-block">
                    <div
                      className="dashboard-timeline-recent__row-main"
                      style={{ ["--cols" as string]: row.cols }}
                    >
                      <div className="dashboard-timeline-recent__row-headers">
                        {row.headerLetters.map((letter, i) => (
                          <span key={i} className="dashboard-timeline-recent__header-cell">{letter}</span>
                        ))}
                      </div>
                      <div className="dashboard-timeline-recent__row">
                        {row.cells.map((cell, ci) => {
                          if (!cell) {
                            return <div key={ci} className="dashboard-timeline-recent__slot" />;
                          }
                          // Today, when nothing's been logged or skipped yet,
                          // is a "still pending" placeholder — render an accent
                          // dash instead of a square so it reads as in-flight.
                          const isPendingToday =
                            cell.isToday &&
                            cell.status !== "green" &&
                            cell.status !== "skipped" &&
                            cell.status !== "green-skipped";
                          return (
                            <div key={ci} className="dashboard-timeline-recent__slot">
                              {isPendingToday ? (
                                <span
                                  className="dashboard-timeline-recent__today-dash"
                                  title={cell.dateIso}
                                  aria-label="Today"
                                >
                                  −
                                </span>
                              ) : (
                                <div
                                  className={[
                                    "dashboard-timeline__day",
                                    `dashboard-timeline__day--${cell.status}`,
                                    cell.status === "rest-past" || cell.status === "rest-behind"
                                      ? "dashboard-timeline__day--rest"
                                      : "",
                                    cell.isToday ? "dashboard-timeline__day--today" : "",
                                  ].filter(Boolean).join(" ")}
                                  title={cell.dateIso}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="dashboard-timeline-recent__row-side">
                      <span className="dashboard-timeline-recent__row-side-count">
                        Week {ri + 1} - {row.done}/{row.expected}
                      </span>
                      <span className={`dashboard-timeline-recent__row-side-delta dashboard-timeline-recent__row-side-delta--${deltaModifier}`}>
                        {deltaLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </section>
    );
  }

  // ─── Recent summaries ─────────────────────────────────────────────────────

  function renderRecentCard(card: RecentCard | null | typeof LOADING_CARD, label: string) {
    // The recent-activity panel only reveals once every card has resolved, so
    // a card here is either present or genuinely absent — never mid-load.
    const data = card === LOADING_CARD ? null : card;
    if (!data) return null;
    return (
      <div
        className="dashboard-recent-card dashboard-recent-card--link"
        aria-label={label}
        role="button"
        tabIndex={0}
        onClick={() => navigate(data.link)}
        onKeyDown={(e) => e.key === "Enter" && navigate(data.link)}
      >
        <div className="dashboard-recent-card__icon">
          {data.ragStatus ? (
            <Medal status={data.ragStatus} size="lg" />
          ) : data.grade ? (
            <span
              className={[
                "dashboard-recent-card__grade",
                data.gradeKind ? `dashboard-recent-card__grade--${data.gradeKind}` : "",
                data.gradeColor ? `dashboard-recent-card__grade--${data.gradeColor}` : "",
              ].filter(Boolean).join(" ")}
            >
              {data.grade}
            </span>
          ) : null}
        </div>
        <span className="dashboard-recent-card__name">{data.name}</span>
      </div>
    );
  }

  const hasAnyRecent =
    recentSession !== null || recentWeek !== null || recentSeason !== null;

  // ─── Achievements ────────────────────────────────────────────────────────

  const MONTH_ABBREVS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  function renderAchievements() {
    if (achievements === null) return null;
    const { goldSessions, perfectWeeks, aSeasons } = achievements;
    if (goldSessions.length === 0 && perfectWeeks.length === 0 && aSeasons.length === 0) {
      return null;
    }

    // Each achievement type carries its glyph plus a stable ordering rank used
    // to lay out the per-type buckets within a single period (session, then
    // week, then season — matching the order they're declared here).
    type Typed = { date: string; icon: string; iconClass?: string; typeRank: number };
    const typed: Typed[] = [
      ...goldSessions.map((date) => ({ date, icon: "🥇", typeRank: 0 } as Typed)),
      ...perfectWeeks.map((date) => ({ date, icon: "🤩", typeRank: 1 } as Typed)),
      ...aSeasons.map(
        (date) =>
          ({
            date,
            icon: "A",
            iconClass: "dashboard-achievement__icon--grade",
            typeRank: 2,
          } as Typed)
      ),
    ];

    const today = toLocalMidnight(localDateIso());
    const curYear = today.getFullYear();
    const curMonth = today.getMonth();

    // Three time tiers:
    //   1. Earned this calendar month  → shown individually, no cap.
    //   2. Earlier this calendar year  → bucketed by (month, type).
    //   3. A previous calendar year    → bucketed by (year, type); a year's
    //      month buckets dissolve and merge once that year is over.
    type Agg = {
      icon: string;
      iconClass?: string;
      count: number;
      sortKey: number; // higher = more recent, so buckets pin newest-first
      typeRank: number;
      label: string;
    };
    const individualsRaw: Typed[] = [];
    const aggregates = new Map<string, Agg>();

    for (const t of typed) {
      const d = toLocalMidnight(t.date);
      const y = d.getFullYear();
      const m = d.getMonth();
      if (y === curYear && m === curMonth) {
        individualsRaw.push(t);
        continue;
      }
      const inThisYear = y === curYear;
      const key = inThisYear
        ? `m:${y}-${m}:${t.typeRank}`
        : `y:${y}:${t.typeRank}`;
      const existing = aggregates.get(key);
      if (existing) {
        existing.count++;
      } else {
        aggregates.set(key, {
          icon: t.icon,
          iconClass: t.iconClass,
          count: 1,
          // Month buckets (this year) sort above year buckets; within a tier,
          // more recent periods come first.
          sortKey: inThisYear ? y * 100 + m + 100000 : y,
          typeRank: t.typeRank,
          label: inThisYear ? `${MONTH_ABBREVS[m]} ${y}` : `${y}`,
        });
      }
    }

    const allIndividuals: ShelfIndividual[] = individualsRaw
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(({ icon, iconClass, date }) => ({
        icon,
        iconClass,
        displayDate: compactAchievementDate(date),
      }));

    const allBuckets: ShelfBucket[] = [...aggregates.values()]
      .sort((a, b) => b.sortKey - a.sortKey || a.typeRank - b.typeRank)
      .map(({ icon, iconClass, count, label }) => ({
        icon,
        iconClass,
        count,
        label,
      }));

    return (
      <section className="dashboard-section">
        <h2 className="dashboard-section-title">Achievements</h2>
        <AchievementsShelf individuals={allIndividuals} buckets={allBuckets} />
      </section>
    );
  }

  // ─── PR Spotlight ─────────────────────────────────────────────────────────

  const spotlight = prEvents?.[0] ?? null;

  function renderPRSpotlight() {
    if (!spotlight) return null;

    // Stack every PR set on the most recent PR date — different exercises can
    // peak on the same day. These are the graphed records; the list below
    // continues with the next PRs chronologically before this batch.
    const spotlightPRs = prEvents!.filter((pr) => pr.date === spotlight.date);

    return (
      <section className="dashboard-section">
        <h2 className="dashboard-section-title">Recent personal records</h2>
        <div className="dashboard-pr-spotlight-stack">
          {spotlightPRs.map((pr) =>
            renderSpotlightCard(pr, spotlightHistories?.[pr.exerciseName] ?? null)
          )}
        </div>
      </section>
    );
  }

  function renderSpotlightCard(
    pr: PREvent,
    history: ExerciseSessionDataPoint[] | null
  ) {
    const daysSincePrev =
      pr.previousDate ? daysBetween(pr.previousDate, pr.date) : null;
    const pctImprovement =
      pr.prType === "e1rm" && pr.newE1RM && pr.previousE1RM
        ? Math.round(((pr.newE1RM - pr.previousE1RM) / pr.previousE1RM) * 100)
        : pr.prType === "reps" && pr.newReps && pr.previousReps
        ? Math.round(((pr.newReps - pr.previousReps) / pr.previousReps) * 100)
        : null;

    // Stats since this PR's predecessor — i.e. the work it took to set this PR
    // after the prior one. previousDate is the date of the previous all-time
    // best; absence means this is the user's first recorded PR for the
    // exercise, so "since last PR" == "all time".
    const sinceDate = pr.previousDate ?? null;
    const exerciseName = pr.exerciseName;
    let sessionsAllTime = 0;
    let sessionsSincePR = 0;
    if (history) {
      for (const dp of history) {
        sessionsAllTime += 1;
        if (sinceDate == null || dp.date > sinceDate) {
          sessionsSincePR += 1;
        }
      }
    }

    // Span from the user's first recorded attempt through this PR. History is
    // sorted ascending, so [0] is the earliest session.
    const daysSinceFirst =
      history && history.length > 0
        ? daysBetween(history[0].date, pr.date)
        : null;

    // Each stat is a bolded value plus trailing text. Day spans are bucketed
    // into weeks/months/years via the shared formatDayCount; counts stay raw.
    type SpotlightStat = { value: string; label: string };

    // "Since your last PR" only applies when there's a prior PR to measure from.
    const sinceItems: SpotlightStat[] = [];
    if (sinceDate != null && daysSincePrev != null) {
      sinceItems.push({ value: formatDayCount(daysSincePrev), label: "passed" });
      sinceItems.push({
        value: String(sessionsSincePR),
        label: `${exerciseName} ${sessionsSincePR === 1 ? "session logged" : "sessions logged"}`,
      });
    }

    return (
      <div className="dashboard-pr-spotlight" key={`${pr.exerciseName}-${pr.prType}`}>
        <p className="dashboard-pr-spotlight__exercise">PR Spotlight: {pr.exerciseName}</p>
        <div className="dashboard-pr-spotlight__values">
          {pr.prType === "e1rm" ? (
            <>
              {pr.previousE1RM != null && (
                <span className="dashboard-pr-spotlight__prev">
                  {Math.round(pr.previousE1RM * 10) / 10}kg e1RM
                </span>
              )}
              {pr.previousE1RM != null && <span className="dashboard-pr-spotlight__arrow">→</span>}
              <span className="dashboard-pr-spotlight__new">
                {pr.newE1RM != null ? `${Math.round(pr.newE1RM * 10) / 10}kg e1RM` : "—"}
              </span>
            </>
          ) : (
            <>
              {pr.previousReps != null && (
                <span className="dashboard-pr-spotlight__prev">{pr.previousReps} reps</span>
              )}
              {pr.previousReps != null && <span className="dashboard-pr-spotlight__arrow">→</span>}
              <span className="dashboard-pr-spotlight__new">{pr.newReps} reps</span>
            </>
          )}
          {pctImprovement != null && (
            <span className="dashboard-pr-spotlight__pct">+{pctImprovement}%</span>
          )}
        </div>
        <div className="dashboard-pr-spotlight__meta">
          <span>{shortDate(pr.date)}</span>
        </div>
        {renderSpotlightSparkline(pr, history, sinceDate)}
        {sinceItems.length > 0 && (
          <div className="dashboard-pr-spotlight__narrative">
            <p className="dashboard-pr-spotlight__narrative-intro">
              Since your last {exerciseName} PR…
            </p>
            <ul className="dashboard-pr-spotlight__narrative-list">
              {sinceItems.map((item) => (
                <li
                  key={item.label}
                  className="dashboard-pr-spotlight__narrative-item"
                >
                  <strong>{item.value}</strong> {item.label}
                </li>
              ))}
            </ul>
          </div>
        )}
        {daysSinceFirst != null && (
          <p className="dashboard-pr-spotlight__narrative-summary">
            It has been <strong>{formatDayCount(daysSinceFirst)}</strong> since
            your first {exerciseName} attempt, over which time you have logged{" "}
            <strong>{sessionsAllTime}</strong> {exerciseName}{" "}
            {sessionsAllTime === 1 ? "session" : "sessions"}.
          </p>
        )}
      </div>
    );
  }

  function renderSpotlightSparkline(
    pr: PREvent,
    history: ExerciseSessionDataPoint[] | null,
    sinceDate: string | null
  ) {
    if (history === null) {
      return <div className="dashboard-pr-spotlight__sparkline dashboard-pr-spotlight__sparkline--empty" />;
    }
    const points = history
      .map((dp) => {
        const v = pr.prType === "reps" ? dp.topRepCount : dp.topEstimatedOneRepMax;
        return v != null && v > 0 ? { date: dp.date, value: v } : null;
      })
      .filter((p): p is { date: string; value: number } => p != null)
      .sort((a, b) => a.date.localeCompare(b.date));
    // Suppress the sparkline until there's enough history for a trend line
    // to read as meaningful — a handful of dots conveys noise, not progress.
    if (points.length <= 10) return null;

    const W = 320;
    const H = 56;
    const PAD = { top: 6, right: 4, bottom: 6, left: 4 };
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const xs = points.map((p) => toLocalMidnight(p.date).getTime());
    const xMin = xs[0];
    const xMax = xs[xs.length - 1];
    const xRange = xMax - xMin || 1;
    const ys = points.map((p) => p.value);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const yPad = (yMax - yMin) * 0.15 || 1;
    const yLo = yMin - yPad;
    const yHi = yMax + yPad;
    const xScale = (t: number) => PAD.left + ((t - xMin) / xRange) * plotW;
    const yScale = (v: number) => PAD.top + plotH - ((v - yLo) / (yHi - yLo)) * plotH;

    // Highlight the segment running from the previous PR up to the current PR.
    // splitTime sits on the previous-PR date so the highlighted span covers
    // every session between (exclusive of) the prior PR and (inclusive of)
    // the new one.
    const splitTime = sinceDate ? toLocalMidnight(sinceDate).getTime() : null;
    const baseSegment: { x: number; y: number }[] = [];
    const highlightSegment: { x: number; y: number }[] = [];
    for (let i = 0; i < points.length; i++) {
      const t = xs[i];
      const xy = { x: xScale(t), y: yScale(points[i].value) };
      if (splitTime != null && t > splitTime) {
        // Stitch the transition: include the prior point so the highlight
        // segment connects continuously to the base segment.
        if (highlightSegment.length === 0 && baseSegment.length > 0) {
          highlightSegment.push(baseSegment[baseSegment.length - 1]);
        }
        highlightSegment.push(xy);
      } else {
        baseSegment.push(xy);
      }
    }
    const polyStr = (seg: { x: number; y: number }[]) =>
      seg.map((p) => `${p.x},${p.y}`).join(" ");

    const lastPoint = points[points.length - 1];
    const lastXY = { x: xScale(xs[xs.length - 1]), y: yScale(lastPoint.value) };

    return (
      <div className="dashboard-pr-spotlight__sparkline" aria-hidden="true">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          style={{ width: "66%", height: H, display: "block", margin: "0 auto" }}
        >
          {baseSegment.length >= 2 && (
            <polyline
              points={polyStr(baseSegment)}
              fill="none"
              stroke="var(--text-soft)"
              strokeOpacity="0.55"
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {highlightSegment.length >= 2 && (
            <polyline
              points={polyStr(highlightSegment)}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          <circle cx={lastXY.x} cy={lastXY.y} r="2.6" fill="var(--accent)" />
        </svg>
      </div>
    );
  }

  // ─── All PRs ──────────────────────────────────────────────────────────────

  function renderAllPRs() {
    // Continuation list beneath the spotlight: its own reveal gate, held back
    // until the spotlight above it is in.
    if (prEvents === null || !spotlight) return null;
    // Drop the most-recent-date batch (shown as graphs above) and list the
    // next 5 PRs chronologically before it so none appear twice.
    const displayedPRs = prEvents
      .filter((pr) => pr.date !== spotlight.date)
      .slice(0, 5);
    if (displayedPRs.length === 0) return null;
    return (
      <section className="dashboard-section">
      <ul className="dashboard-pr-list">
        {displayedPRs.map((pr, i) => {
          const daysAgo = daysBetween(pr.date, localDateIso());
          const agoLabel = daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : `${daysAgo} days ago`;
          return (
            <li key={i} className="dashboard-pr-item" style={{ "--i": i } as React.CSSProperties}>
              <div className="dashboard-pr-item__top">
                <span className="dashboard-pr-item__exercise">{pr.exerciseName}</span>
                <span className="dashboard-pr-item__date">{shortDate(pr.date)}</span>
              </div>
              <span className="dashboard-pr-item__ago">{agoLabel}</span>
              {pr.prType === "e1rm" ? (
                <span className="dashboard-pr-item__detail">
                  {pr.previousE1RM != null && (
                    <>{Math.round(pr.previousE1RM * 10) / 10}kg <span className="dashboard-pr-item__arrow">→</span> </>
                  )}
                  <span className="dashboard-pr-item__new">{pr.newE1RM != null ? `${Math.round(pr.newE1RM * 10) / 10}kg` : "—"}</span> e1RM
                  {pr.previousE1RM && pr.newE1RM && (
                    <> (+{Math.round(((pr.newE1RM - pr.previousE1RM) / pr.previousE1RM) * 100)}%)</>
                  )}
                </span>
              ) : (
                <span className="dashboard-pr-item__detail">
                  {pr.previousReps != null && (
                    <>{pr.previousReps} reps <span className="dashboard-pr-item__arrow">→</span> </>
                  )}
                  <span className="dashboard-pr-item__new">{pr.newReps} reps</span>
                  {pr.previousReps != null && pr.previousReps > 0 && (
                    <> (+{Math.round(((pr.newReps - pr.previousReps) / pr.previousReps) * 100)}%)</>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      </section>
    );
  }

  // ─── Backup nudge ─────────────────────────────────────────────────────────

  function renderBackupNudge() {
    if (lastBackupAt === "loading" || hasSettledWeek === "loading") return null;
    if (!hasSettledWeek) return null;
    const THRESHOLD_DAYS = 30;
    let daysSince: number | null = null;
    if (lastBackupAt !== null) {
      const msPerDay = 86400000;
      daysSince = Math.floor((Date.now() - new Date(lastBackupAt).getTime()) / msPerDay);
      if (daysSince < THRESHOLD_DAYS) return null;
    }
    const label =
      lastBackupAt === null
        ? "You have never backed up your data."
        : `Your last backup was ${daysSince} days ago.`;
    return (
      <button
        type="button"
        className="dashboard-backup-nudge"
        onClick={() => navigate("/backup")}
      >
        <div className="dashboard-backup-nudge__body">
          <span className="dashboard-backup-nudge__title">Back up your data</span>
          <span className="dashboard-backup-nudge__desc">{label}</span>
        </div>
        <span className="dashboard-backup-nudge__chevron">›</span>
      </button>
    );
  }

  // ─── Tutorial mocks ───────────────────────────────────────────────────────

  function renderScheduleMock() {
    // Reuse the real season-progress markup so the mock renders identically
    // by construction — only the day-status data is fake.
    type Cell = "green" | "skipped" | "overdue" | "grey" | "rest";
    type Day = { cell: Cell; today?: boolean };
    const weeks: Day[][] = [
      [{cell:"green"},{cell:"green"},{cell:"rest"},{cell:"green"},{cell:"green"},{cell:"rest"},{cell:"rest"}],
      [{cell:"green"},{cell:"green"},{cell:"rest"},{cell:"green"},{cell:"green"},{cell:"rest"},{cell:"rest"}],
      [{cell:"green"},{cell:"overdue"},{cell:"rest"},{cell:"overdue"},{cell:"overdue"},{cell:"rest",today:true},{cell:"rest"}],
      [{cell:"grey"},{cell:"grey"},{cell:"rest"},{cell:"grey"},{cell:"grey"},{cell:"rest"},{cell:"rest"}],
      [{cell:"grey"},{cell:"grey"},{cell:"rest"},{cell:"grey"},{cell:"grey"},{cell:"rest"},{cell:"rest"}],
      [{cell:"grey"},{cell:"grey"},{cell:"rest"},{cell:"grey"},{cell:"grey"},{cell:"rest"},{cell:"rest"}],
    ];
    return (
      <div className="dashboard-timeline">
        <div className="dashboard-timeline__label">Schedule (planned)</div>
        <div className="dashboard-timeline__body">
          <div className="dashboard-timeline__grid">
            {weeks.map((week, wi) => (
              <div key={wi} className="dashboard-timeline__week-row">
                <span className="dashboard-timeline__week-label">W{wi + 1}</span>
                <div
                  className="dashboard-timeline__days"
                  style={{ ["--day-count" as string]: week.length }}
                >
                  {week.map((d, di) => {
                    const classes = [
                      "dashboard-timeline__day",
                      `dashboard-timeline__day--${d.cell}`,
                      d.cell === "rest" ? "dashboard-timeline__day--rest" : "",
                      d.today ? "dashboard-timeline__day--today" : "",
                    ].filter(Boolean).join(" ");
                    return (
                      <div key={di} className="dashboard-timeline__slot">
                        <div className={classes} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="dashboard-timeline__sidebar">
            <div className="dashboard-timeline__sidebar-status">
              <span className="dashboard-timeline__sidebar-week">Week 3 of 6</span>
              <span className="dashboard-timeline__status--behind">Behind schedule</span>
            </div>
            <div className="dashboard-timeline__sidebar-dates">
              <div className="dashboard-timeline__sidebar-date">
                <span className="dashboard-timeline__sidebar-caption">Start</span>
                <span className="dashboard-timeline__sidebar-value">27 Apr '26</span>
              </div>
              <div className="dashboard-timeline__sidebar-date">
                <span className="dashboard-timeline__sidebar-caption">Finish</span>
                <span className="dashboard-timeline__sidebar-value">19 Jun '26</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderReportMock() {
    // Reuses the real week-summary score block markup so the report looks
    // identical to what the user sees when tapping any completed week. The
    // narrative sits inside the same card as the score breakdown so the whole
    // block reads as one self-contained example rather than as commentary.
    // Reuses the real WeekGradeHero with fabricated scores, so the tutorial
    // can't drift out of date the way a hand-built copy of the layout did.
    return (
      <section className="dashboard-report-mock">
        <WeekGradeHero
          emojiRating={1}
          volumeScore={92}
          intensityScore={90}
          consistencyScore={100}
          endedEarly={false}
        />
        <p className="sum-narrative">
          You logged enough sets to meet your volume target, lifted enough weight
          to hit your intensity target and stayed consistent with your schedule.
        </p>
      </section>
    );
  }

  function renderMetricsMock() {
    return (
      <div className="tutorial-mock-metrics">
        <div className="tutorial-mock-metrics__item">
          <span className="tutorial-mock-metrics__dot" />
          <div>
            <span className="tutorial-mock-metrics__name">Consistency</span>
            <span className="tutorial-mock-metrics__desc">
              Did you train on the days your program said to?
            </span>
          </div>
        </div>
        <div className="tutorial-mock-metrics__item">
          <span className="tutorial-mock-metrics__dot tutorial-mock-metrics__dot--volume" />
          <div>
            <span className="tutorial-mock-metrics__name">Volume</span>
            <span className="tutorial-mock-metrics__desc">
              Did you hit the working-set targets for each muscle group?
            </span>
          </div>
        </div>
        <div className="tutorial-mock-metrics__item">
          <span className="tutorial-mock-metrics__dot tutorial-mock-metrics__dot--intensity" />
          <div>
            <span className="tutorial-mock-metrics__name">Intensity</span>
            <span className="tutorial-mock-metrics__desc">
              Did each set reach the prescribed effort relative to your historical best?
            </span>
          </div>
        </div>
      </div>
    );
  }

  function renderGraphMock() {
    return <ExerciseGraphMock />;
  }

  function renderAchievementsMock() {
    // Drives the real AchievementsShelf with fabricated entries spanning the
    // three time tiers: this month's achievements show individually (compact
    // date band — Today/weekday/ordinal); earlier months of this year collapse
    // into per-type "month" buckets ("Jun 2026"); previous years collapse into
    // per-type "year" buckets ("2025"). The shelf's ResizeObserver fills any
    // partial row with placeholder dots — same code path as the live render.
    const individuals: ShelfIndividual[] = [
      { icon: "🥇", displayDate: "Today" },
      { icon: "🤩", displayDate: "Wed" },
      { icon: "🥇", displayDate: "Tue" },
      { icon: "🥇", displayDate: "8th" },
      { icon: "🤩", displayDate: "4th" },
      { icon: "🥇", displayDate: "1st" },
    ];
    const buckets: ShelfBucket[] = [
      // Earlier this year → bucketed by month + type, newest month first.
      { icon: "🥇", count: 11, label: "May 2026" },
      { icon: "🤩", count: 3, label: "May 2026" },
      { icon: "🥇", count: 9, label: "Apr 2026" },
      { icon: "A", iconClass: "dashboard-achievement__icon--grade", count: 1, label: "Apr 2026" },
      // Previous year → the whole year merges into one bucket per type.
      { icon: "🥇", count: 48, label: "2025" },
      { icon: "🤩", count: 9, label: "2025" },
      { icon: "A", iconClass: "dashboard-achievement__icon--grade", count: 1, label: "2025" },
    ];
    return <AchievementsShelf individuals={individuals} buckets={buckets} />;
  }

  function renderPRSpotlightMock() {
    // Reuses the real spotlight markup with fabricated values: a 14-session
    // climb with mild week-to-week noise, where the last four points
    // (post-previous-PR) carry the accent highlight, mirroring the live
    // renderSpotlightSparkline output.
    return (
      <div className="dashboard-pr-spotlight">
        <p className="dashboard-pr-spotlight__exercise">Squat</p>
        <div className="dashboard-pr-spotlight__values">
          <span className="dashboard-pr-spotlight__prev">105kg e1RM</span>
          <span className="dashboard-pr-spotlight__arrow">→</span>
          <span className="dashboard-pr-spotlight__new">112.5kg e1RM</span>
          <span className="dashboard-pr-spotlight__pct">+7%</span>
        </div>
        <div className="dashboard-pr-spotlight__meta">
          <span>12 May '26</span>
        </div>
        <div className="dashboard-pr-spotlight__sparkline" aria-hidden="true">
          <svg
            viewBox="0 0 320 56"
            preserveAspectRatio="none"
            style={{ width: "66%", height: 56, display: "block", margin: "0 auto" }}
          >
            <polyline
              points="4,44.9 28,42.2 52,46.3 76,38 100,40.8 124,33.9 148,36.6 172,29.7 196,25.6 220,28.4 244,22.8"
              fill="none"
              stroke="var(--text-soft)"
              strokeOpacity="0.55"
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <polyline
              points="244,22.8 268,18.7 292,14.5 316,11.1"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <circle cx="316" cy="11.1" r="2.6" fill="var(--accent)" />
          </svg>
        </div>
        <div className="dashboard-pr-spotlight__narrative">
          <p className="dashboard-pr-spotlight__narrative-intro">
            Since your last Squat PR…
          </p>
          <ul className="dashboard-pr-spotlight__narrative-list">
            <li className="dashboard-pr-spotlight__narrative-item">
              <strong>4 weeks</strong> passed
            </li>
            <li className="dashboard-pr-spotlight__narrative-item">
              <strong>4</strong> Squat sessions
            </li>
          </ul>
        </div>
        <p className="dashboard-pr-spotlight__narrative-summary">
          It has been <strong>3 months</strong> since your first Squat attempt,
          over which time you have logged <strong>32</strong> Squat sessions.
        </p>
      </div>
    );
  }

  function renderPRsMock() {
    // Reuses the exact dashboard-pr-list markup from renderAllPRs so the
    // tutorial looks like a real PR row, just with fabricated values.
    return (
      <ul className="dashboard-pr-list">
        <li className="dashboard-pr-item">
          <div className="dashboard-pr-item__top">
            <span className="dashboard-pr-item__exercise">Squat</span>
            <span className="dashboard-pr-item__date">12 May '26</span>
          </div>
          <span className="dashboard-pr-item__ago">2 days ago</span>
          <span className="dashboard-pr-item__detail">
            115kg <span className="dashboard-pr-item__arrow">→</span>{" "}
            <span className="dashboard-pr-item__new">122kg</span> e1RM (+6%)
          </span>
        </li>
        <li className="dashboard-pr-item">
          <div className="dashboard-pr-item__top">
            <span className="dashboard-pr-item__exercise">Pull-up</span>
            <span className="dashboard-pr-item__date">9 May '26</span>
          </div>
          <span className="dashboard-pr-item__ago">5 days ago</span>
          <span className="dashboard-pr-item__detail">
            10 reps <span className="dashboard-pr-item__arrow">→</span>{" "}
            <span className="dashboard-pr-item__new">12 reps</span> (+20%)
          </span>
        </li>
      </ul>
    );
  }

  function renderWeeksBreadcrumbMock() {
    // Reuses the real WeeksBreadcrumb component with fabricated week ratings:
    // three completed weeks with descending ratings, then the current week and
    // two un-started.
    const weeks: BreadcrumbWeek[] = [
      { weekInstanceId: "mock-1", emojiRating: 1, isCurrent: false },
      { weekInstanceId: "mock-2", emojiRating: 2, isCurrent: false },
      { weekInstanceId: "mock-3", emojiRating: 3, isCurrent: false },
      { weekInstanceId: "mock-4", emojiRating: null, isCurrent: true },
      { weekInstanceId: "mock-5", emojiRating: null, isCurrent: false },
      { weekInstanceId: "mock-6", emojiRating: null, isCurrent: false },
    ];
    return <WeeksBreadcrumb weeks={weeks} />;
  }

  function renderAllSeasonsMock() {
    // Reuses the real season-summary-seasons-list markup with three fabricated
    // seasons: most-recent in progress, two completed at A and B grades.
    type Row = {
      id: string;
      name: string;
      score: number | null;
      grade: "A" | "B" | "C" | "D" | null;
      duration: string | null;
      prs: number;
      dates: string | null;
      isCurrent: boolean;
    };
    const rows: Row[] = [
      { id: "m1", name: "Push / Pull / Legs · Spring '26", score: null, grade: null, duration: "in week 3 of 6", prs: 4, dates: "27 Apr 2026 – 8 Jun 2026", isCurrent: true },
      { id: "m2", name: "Push / Pull / Legs · Winter '26", score: 92, grade: "A", duration: "6 weeks", prs: 11, dates: "9 Feb 2026 – 22 Mar 2026", isCurrent: false },
      { id: "m3", name: "Upper / Lower · Autumn '25", score: 84, grade: "B", duration: "5 weeks", prs: 7, dates: "13 Oct 2025 – 16 Nov 2025", isCurrent: false },
    ];
    return (
      <section className="season-summary-section">
        <h2 className="season-summary-section-title">All seasons</h2>
        <ul className="season-summary-seasons-list">
          {rows.map((row) => {
            const color = row.grade ? gradeColor(row.grade) : null;
            return (
              <li
                key={row.id}
                className={`season-summary-season-row${row.isCurrent ? " season-summary-season-row--current" : ""}`}
              >
                <div className="season-summary-season-row__main">
                  <span className="season-summary-season-row__name">{row.name}</span>
                  <span className="season-summary-season-row__meta">
                    {row.score != null && (
                      <span className="season-summary-season-row__score">{row.score}</span>
                    )}
                    {row.grade && color && (
                      <span className={`season-summary-season-row__grade season-summary-season-row__grade--${color}`}>
                        {row.grade}
                      </span>
                    )}
                  </span>
                </div>
                <div className="season-summary-season-row__sub">
                  {row.duration && (
                    <span className="season-summary-season-row__duration">{row.duration}</span>
                  )}
                  <span className="season-summary-season-row__prs">{row.prs} PRs</span>
                  {row.dates && (
                    <span className="season-summary-season-row__date">{row.dates}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  function renderExerciseSummaryCardMock() {
    // Reuses the real ExerciseSummaryCard component with fabricated targets:
    // 80kg × 8 at 3 RIR, with the user's all-time PR a few months back.
    const historicalBestDate = new Date(Date.now() - 70 * 86400000).toISOString();
    return (
      <ExerciseSummaryCard
        targetRir={3}
        targetWeight={80}
        targetReps={8}
        targetEstimatedOneRepMax={101.3}
        topSetEstimatedOneRepMax={null}
        historicalBestEstimatedOneRepMax={110}
        historicalBestDate={historicalBestDate}
        recentMaxEstimatedOneRepMax={null}
        recentMaxDate={null}
      />
    );
  }

  function renderProgramMock() {
    // Reuses the real config-programs__list markup so the rows look exactly
    // like what users will see at Settings → Programs.
    return (
      <div className="config-programs__list">
        <div className="config-programs__row">
          <div className="config-programs__card config-programs__card--active">
            <span className="config-programs__card-body">
              <span className="config-programs__card-name">Push / Pull / Legs</span>
              <span className="config-programs__card-rir">RIR 4, 3, 2, 1, 0</span>
            </span>
            <span className="config-programs__card-right">
              <span className="config-programs__active-pill">Active</span>
              <span className="config-programs__chevron">›</span>
            </span>
          </div>
        </div>
        <div className="config-programs__row">
          <div className="config-programs__card">
            <span className="config-programs__card-body">
              <span className="config-programs__card-name">Upper / Lower 4×</span>
              <span className="config-programs__card-rir">RIR 3, 2, 1, 0</span>
            </span>
            <span className="config-programs__card-right">
              <span className="config-programs__chevron">›</span>
            </span>
          </div>
        </div>
        <div className="config-programs__row">
          <div className="config-programs__card">
            <span className="config-programs__card-body">
              <span className="config-programs__card-name">Full body 3×</span>
              <span className="config-programs__card-rir">RIR 4, 3, 2, 1, 0</span>
            </span>
            <span className="config-programs__card-right">
              <span className="config-programs__chevron">›</span>
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (isDesktop) {
    const appUrl = `${window.location.origin}${import.meta.env.BASE_URL}`;
    return (
      <main className="dashboard-page dashboard-page--desktop">
        <div className="dashboard-qr-full">
          <img className="dashboard-qr-full__img" src={`${import.meta.env.BASE_URL}qr.png`} alt="QR code to open app on mobile" />
          <p className="dashboard-qr-full__url">{appUrl}</p>
        </div>
      </main>
    );
  }

  // The intro loader releases the moment the first visual (up next) is ready,
  // so the page opens without waiting on the slower sections. From there each
  // section reveals in strict top-to-bottom order — a lower one that resolves
  // first is held until everything above it is in — and a single status row
  // beneath the last revealed section names whatever is loading next.
  const firstVisualReady = upNext.type !== "loading";
  const recentResolved =
    recentSession !== LOADING_CARD &&
    recentWeek !== LOADING_CARD &&
    recentSeason !== LOADING_CARD;

  // The ordered column of visuals. `free` entries (the year-in-review banner
  // and the backup nudge) never gate the order — they just appear at their
  // fixed spot once their own data resolves, as before.
  const panels: {
    id: string;
    ready?: boolean;
    free?: boolean;
    render: () => React.ReactNode;
    // Hold this block's entrance back a beat, so it rises just after the one above.
    revealDelayMs?: number;
    // Keep the block still and let its children cascade in individually.
    staggerContents?: boolean;
  }[] = [
    {
      id: "year-review",
      free: true,
      render: () =>
        yearReviewYear != null && (
          <section className="dashboard-section">
            <div
              className="dashboard-up-next dashboard-up-next--year-review dashboard-up-next--with-cta"
              role="button"
              tabIndex={0}
              onClick={() => navigate("/year-in-review")}
              onKeyDown={(e) => e.key === "Enter" && navigate("/year-in-review")}
            >
              <div className="dashboard-up-next__content">
                <span className="dashboard-up-next__pill dashboard-up-next__pill--year-review">
                  Limited time
                </span>
                <p className="dashboard-up-next__heading">
                  Your {yearReviewYear} Year in Review
                </p>
                <p className="dashboard-up-next__sub">
                  View the key metrics from this past year of training.
                </p>
              </div>
              <span className="dashboard-up-next__cta dashboard-up-next__cta--year-review">
                Open →
              </span>
            </div>
          </section>
        ),
    },
    {
      id: "up-next",
      ready: upNext.type !== "loading",
      render: () => <section className="dashboard-section">{renderUpNext()}</section>,
    },
    {
      id: "season-planned",
      ready: !timelineLoading,
      render: renderPlannedSchedule,
    },
    {
      id: "season-actual",
      ready: !recentDaysLoading,
      render: renderActualSchedule,
      // Rise just after the planned schedule above it, the way report sections
      // stagger in one after another.
      revealDelayMs: 150,
    },
    {
      id: "recent-activity",
      ready: recentResolved,
      render: () =>
        hasAnyRecent && (
          <section className="dashboard-section">
            <div className="dashboard-section-header" ref={recentTooltipRef}>
              <h2 className="dashboard-section-title">Recent activity</h2>
              <button
                className="dashboard-info-btn"
                aria-expanded={recentTooltipOpen}
                onClick={() => setRecentTooltipOpen((v) => !v)}
              >?</button>
              {recentTooltipOpen && (
                <div className="dashboard-info-tooltip">
                  Tap a session, week, or season icon to view its full summary.
                </div>
              )}
            </div>
            <div className="dashboard-recent-grid">
              {renderRecentCard(recentSession, "Session")}
              {renderRecentCard(recentWeek, "Week")}
              {renderRecentCard(recentSeason, "Season")}
            </div>
          </section>
        ),
    },
    {
      id: "backup",
      free: true,
      render: renderBackupNudge,
    },
    {
      id: "pr-spotlight",
      ready: prEvents !== null && spotlightHistories !== null,
      render: renderPRSpotlight,
    },
    {
      id: "pr-list",
      ready: prEvents !== null,
      render: renderAllPRs,
      // The block holds still; each PR row cascades in one after another.
      staggerContents: true,
    },
    {
      id: "achievements",
      ready: achievements !== null,
      render: renderAchievements,
    },
  ];

  // First panel that is neither ready nor free — the strict-order barrier.
  // Everything above it reveals; a single pulsing-ellipsis row sits below it.
  let blockIndex = panels.length;
  for (let i = 0; i < panels.length; i++) {
    if (!panels[i].free && !panels[i].ready) {
      blockIndex = i;
      break;
    }
  }
  const allRevealed = blockIndex === panels.length;

  return (
    <main className="dashboard-page">
      <TopBar title="Dashboard" />
      <section className="dashboard-shell">
        {!loaderDone ? (
          <PageLoader
            durationMs={3000}
            ready={firstVisualReady}
            onDone={() => setLoaderDone(true)}
          />
        ) : (
          <>
        {panels.slice(0, blockIndex).map((p) => (
          <Reveal key={p.id} delayMs={p.revealDelayMs} staggerContents={p.staggerContents}>
            {p.render()}
          </Reveal>
        ))}

        {!allRevealed && (
          <div className="dashboard-loading-status" role="status" aria-label="Loading">
            <span className="dashboard-loading-status__dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </div>
        )}

        {allRevealed && (
          <>
        <TutorialBlock
          id="schedule"
          title="Your season schedule"
          blurb="Once your program is running, this view shows every planned session, rest day, and how closely you're tracking the schedule. Green squares are sessions done, crosses are rest days, orange means overdue."
          unwrapped
        >
          {renderScheduleMock()}
        </TutorialBlock>

        <TutorialBlock
          id="reports"
          title="Session, week & season reports"
          blurb="Every session, week, and season gets a graded report card with consistency, volume and intensity scores so you can see, at a glance, how each block went."
          unwrapped
        >
          {renderReportMock()}
        </TutorialBlock>

        <TutorialBlock
          id="weeks_breadcrumb"
          title="Weeks this season"
          blurb="On any week summary you'll see a breadcrumb trail of every week in the season, each with the emoji rating it earned. It's an at-a-glance read of how the block is going."
          unwrapped
        >
          {renderWeeksBreadcrumbMock()}
        </TutorialBlock>

        <TutorialBlock
          id="metrics"
          title="How sessions are graded"
          blurb="Every report card is built from these three scores. They compare what your program prescribed with what you actually did."
        >
          {renderMetricsMock()}
        </TutorialBlock>

        <TutorialBlock
          id="exercise_graph"
          title="Exercise summaries"
          blurb="Tap any exercise on the exercises page to see its e1RM progress over time and spot trends across seasons."
          unwrapped
        >
          {renderGraphMock()}
        </TutorialBlock>

        <TutorialBlock
          id="exercise_summary_card"
          title="Targets on the exercise page"
          blurb="Every exercise screen during a session shows today's target weight and reps, the matching e1RM, and a dash that tracks how each set lands against your working range."
          unwrapped
        >
          {renderExerciseSummaryCardMock()}
        </TutorialBlock>

        <TutorialBlock
          id="achievements"
          title="Achievements collection"
          blurb="Every gold-grade session (🥇), perfect week (🤩) and A-grade season (A) earns a slot. Once you collect more than 25 of any kind they pile up into a ×N badge at the end."
          unwrapped
        >
          {renderAchievementsMock()}
        </TutorialBlock>

        <TutorialBlock
          id="pr_spotlight"
          title="Your most recent PR"
          blurb="When you set a new personal best, this card celebrates it: the e1RM jump from your previous record, a sparkline of your full history (with the run-up since the last PR in accent), and the volume of sets and sessions it took to get there."
          unwrapped
        >
          {renderPRSpotlightMock()}
        </TutorialBlock>

        <TutorialBlock
          id="recent_prs"
          title="Recent personal records"
          blurb="When you hit a new e1RM or rep record, it'll show up here with the improvement over your previous best so you can celebrate the wins."
        >
          {renderPRsMock()}
        </TutorialBlock>

        <TutorialBlock
          id="all_seasons"
          title="All seasons"
          blurb="At the bottom of any season summary you'll find a list of every season you've trained, each with its final grade, score, duration and PR count, so you can compare blocks side-by-side."
          unwrapped
        >
          {renderAllSeasonsMock()}
        </TutorialBlock>

        <TutorialBlock
          id="programs"
          title="Create your own program"
          blurb="Build a program from scratch in Settings → Programs. Define your week structure, sessions, muscle-group targets and exercises, then start a season to begin tracking."
          unwrapped
        >
          {renderProgramMock()}
        </TutorialBlock>
          </>
        )}
          </>
        )}
      </section>

      <BottomNav activeTab="home" />
    </main>
  );
}
