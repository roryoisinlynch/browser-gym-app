import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SeasonInstance, SessionInstance, WeekInstance } from "../domain/models";
import type { PREvent, SessionInstanceView, WeekInstanceItemView } from "../repositories/programRepository";
import {
  computeSeasonConsistencyForSeason,
  getActiveSeasonInstance,
  getAllTimePREvents,
  getCanonicalWeekTemplateForSeason,
  getLastCompletedSessionInstance,
  getLastCompletedWeekInstance,
  getLastEndedSeasonInstance,
  getSeasonCalendarWeeks,
  getSessionInstanceById,
  getSessionInstanceView,
  getSessionInstancesForWeekInstance,
  getWeekInstanceItemsForCurrentWeek,
  getWeekInstanceItemsForWeekInstance,
  getWeekInstancesForSeasonInstance,
  getWeekTemplateItemsForWeekTemplate,
} from "../repositories/programRepository";
import { getAll, getById, STORE_NAMES } from "../db/db";
import {
  isHeuristicsEnabled,
  getHeuristicsPromptResponse,
  setHeuristicsPromptResponse,
  setHeuristicsEnabled,
  seedDefaultQuestions,
  getPendingHeuristicDates,
} from "../repositories/heuristicsRepository";
import ExerciseInsights from "../components/ExerciseInsights";
import Medal from "../components/Medal";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import { computeSessionMetrics } from "../services/sessionMetrics";
import { computeWeekMetrics, emojiForRating } from "../services/weekMetrics";
import { computeSeasonMetrics, gradeColor } from "../services/seasonMetrics";
import "./DashboardPage.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type UpNextState =
  | { type: "loading" }
  | { type: "no_program" }
  | { type: "active_session"; sessionId: string; sessionName: string }
  | { type: "overdue_session"; sessionId: string; sessionName: string; date: string; daysOverdue: number }
  | { type: "today_session"; sessionId: string; sessionName: string }
  | { type: "rest_day"; nextSessionName: string | null; nextDate: string | null; daysUntil: number | null }
  | { type: "upcoming"; sessionId: string; sessionName: string; date: string; daysUntil: number }
  | { type: "week_complete" };

type DaySquareStatus = "green" | "overdue" | "grey" | "rest-past" | "rest-future";

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

type RecentDayStatus = "green" | "grey" | "rest-past" | "rest-behind";

interface RecentDayCell {
  dateIso: string;
  status: RecentDayStatus;
  isToday: boolean;
}

interface RecentDayRow {
  headerLetters: string[]; // weekday letters for each cell in this row
  cells: (RecentDayCell | null)[]; // null = future placeholder in current row
  done: number;     // sessions completed within this row's calendar window
  expected: number; // template-projected sessions within this row's window
  delta: number;    // running season delta (done - expected) at row end
}

interface RecentDaysData {
  cols: number; // training-week length (columns per row)
  rows: RecentDayRow[];
}

interface RecentCard {
  id: string;
  name: string;
  grade: string | null;
  gradeKind?: "emoji" | "letter";
  gradeColor: "green" | "amber" | "red" | "grey" | null;
  ragStatus?: "green" | "amber" | "red";
  link: string;
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

function computeUpNext(
  activeSeason: SeasonInstance | null | undefined,
  weekItems: WeekInstanceItemView[]
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

  // Surface the oldest incomplete session regardless of whether it's past/today/future
  const oldest = sessionItems
    .filter((item) => item.sessionInstance?.status !== "completed")
    .sort((a, b) => a.weekInstanceItem.order - b.weekInstanceItem.order)[0];

  if (!oldest) {
    // All sessions done for this week
    return { type: "week_complete" };
  }

  const oldestDate = itemDate(oldest);

  if (oldestDate < today) {
    return {
      type: "overdue_session",
      sessionId: oldest.sessionInstance!.id,
      sessionName: oldest.sessionTemplate?.name ?? "Session",
      date: oldestDate,
      daysOverdue: daysBetween(oldestDate, today),
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

        if (session.status !== "completed") {
          weekSquares.push({ type: "session", scheduledDate, status: scheduledDate < today ? "overdue" : "grey" });
          continue;
        }

        weekSquares.push({ type: "session", scheduledDate, status: "green" });
      }

      dayOffset += weekItems.length;
    } else {
      // Future week not yet generated — project from the current template.
      for (const item of templateItems) {
        const scheduledDate = localDateIso(
          new Date(seasonStartMs + (dayOffset + item.order - 1) * 86400000)
        );
        if (item.type === "rest") {
          weekSquares.push({ type: "rest", scheduledDate, status: "rest-future" });
        } else {
          weekSquares.push({ type: "session", scheduledDate, status: "grey" });
        }
      }

      dayOffset += templateItems.length;
    }

    weeks.push(weekSquares);
  }

  const lastWeekSquares = weeks[weeks.length - 1] ?? [];
  const endDate = lastWeekSquares[lastWeekSquares.length - 1]?.scheduledDate ?? seasonStartIso;

  // Schedule status compares actual session completions to template-expected
  // sessions through today, so intra-week lag is reflected. A session done early
  // counts as completed even if its scheduled date is still in the future.
  let sessionsCompleted = 0;
  let sessionsExpected = 0;
  for (const weekSquares of weeks) {
    for (const sq of weekSquares) {
      if (sq.type !== "session") continue;
      if (sq.scheduledDate <= today) sessionsExpected++;
      if (sq.status === "green") {
        sessionsCompleted++;
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
  let dayOffset = 0;

  for (const calWeek of calendarWeeks) {
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
  }

  // Index completed sessions by their actual completion date.
  const completedByDate = new Map<string, Slot>();
  const completedDates: string[] = [];
  for (const slot of slots) {
    if (
      slot.type === "session" &&
      slot.sessionInstance?.status === "completed" &&
      slot.sessionInstance.completedAt
    ) {
      const completedDate = localDateIso(toLocalMidnight(slot.sessionInstance.completedAt));
      completedByDate.set(completedDate, slot);
      completedDates.push(completedDate);
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

  function buildCell(dateMs: number, isToday: boolean): RecentDayCell {
    const dateIso = localDateIso(new Date(dateMs));
    if (completedByDate.has(dateIso)) {
      return { dateIso, status: "green", isToday };
    }

    // No completion on this calendar day. A rest is "on schedule" only when the
    // user has completed at least as many sessions as the template projected by
    // this date — independent of whether the template called for rest or session
    // at this specific position.
    const actualThrough = countLessOrEqual(completedDates, dateIso);

    if (isToday) {
      // Today is still in progress: never render as rest-behind, because the
      // user could still salvage the day by training. If they're caught up
      // including today's slot, show as on-schedule rest; otherwise grey
      // (upcoming gym day, which behind users will see until they train).
      const expectedThrough = countLessOrEqual(sessionOriginalDates, dateIso);
      if (actualThrough >= expectedThrough) return { dateIso, status: "rest-past", isToday };
      return { dateIso, status: "grey", isToday };
    }

    const expectedThrough = countLessOrEqual(sessionOriginalDates, dateIso);
    if (actualThrough < expectedThrough) return { dateIso, status: "rest-behind", isToday };
    return { dateIso, status: "rest-past", isToday };
  }

  // Columns per row = training-week length, so the grid mirrors the program's
  // configured rhythm. With non-7 weeks the weekday alignment shifts each row,
  // so headers are computed per-row from the actual calendar dates.
  const allLetters = ["S", "M", "T", "W", "T", "F", "S"];
  const cols = templateItems.length;

  const totalRows = Math.floor(daysSinceStart / cols) + 1;
  const rows: RecentDayRow[] = [];
  let prevDoneCum = 0;
  let prevExpectedCum = 0;
  for (let r = 0; r < totalRows; r++) {
    const cells: (RecentDayCell | null)[] = [];
    const headerLetters: string[] = [];
    for (let c = 0; c < cols; c++) {
      const dayIndex = r * cols + c;
      const dms = seasonStartMs + dayIndex * 86400000;
      headerLetters.push(allLetters[new Date(dms).getDay()]);
      if (dayIndex > daysSinceStart) {
        cells.push(null);
      } else {
        cells.push(buildCell(dms, dayIndex === daysSinceStart));
      }
    }
    // Cap the row's effective end at today for the in-progress (last) row so
    // expected/delta don't yet include sessions scheduled later this week.
    const isLastRow = r === totalRows - 1;
    const lastDayIndex = isLastRow ? daysSinceStart : (r + 1) * cols - 1;
    const lastDayIso = localDateIso(new Date(seasonStartMs + lastDayIndex * 86400000));
    const doneCum = countLessOrEqual(completedDates, lastDayIso);
    const expectedCum = countLessOrEqual(sessionOriginalDates, lastDayIso);
    const done = doneCum - prevDoneCum;
    const expected = expectedCum - prevExpectedCum;
    const delta = doneCum - expectedCum;
    prevDoneCum = doneCum;
    prevExpectedCum = expectedCum;
    rows.push({ cells, headerLetters, done, expected, delta });
  }

  return { cols, rows };
}

async function buildSessionCard(session: SessionInstance): Promise<RecentCard | null> {
  try {
    const view = await getSessionInstanceView(session.id);
    if (!view) return null;
    const m = computeSessionMetrics(view);
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
    const [templateItems, sessions] = await Promise.all([
      getWeekTemplateItemsForWeekTemplate(week.weekTemplateId),
      getSessionInstancesForWeekInstance(week.id),
    ]);
    const completed = sessions.filter((s) => s.status === "completed");
    const views: SessionInstanceView[] = (
      await Promise.all(completed.map((s) => getSessionInstanceView(s.id)))
    ).filter((v): v is SessionInstanceView => v != null);
    const wm = computeWeekMetrics(week, templateItems, views);
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
    const weeks = await getWeekInstancesForSeasonInstance(season.id);
    const completedWeeks = weeks.filter((w) => w.status === "completed");
    const weekMetrics = await Promise.all(
      completedWeeks.map(async (w) => {
        const [sessions, items] = await Promise.all([
          getSessionInstancesForWeekInstance(w.id),
          getWeekTemplateItemsForWeekTemplate(w.weekTemplateId),
        ]);
        const views: SessionInstanceView[] = (
          await Promise.all(
            sessions.filter((s) => s.status === "completed").map((s) => getSessionInstanceView(s.id))
          )
        ).filter((v): v is SessionInstanceView => v != null);
        return computeWeekMetrics(w, items, views);
      })
    );
    const consistencyOverride = await computeSeasonConsistencyForSeason(season);
    const sm = computeSeasonMetrics(season, weekMetrics, consistencyOverride);
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

// ─── Component ────────────────────────────────────────────────────────────────

const LOADING_CARD = Symbol("loading");

export default function DashboardPage() {
  const navigate = useNavigate();
  const cancelled = useRef(false);

  const [isDesktop] = useState(() => window.innerWidth >= 1024);
  const [upNext, setUpNext] = useState<UpNextState>({ type: "loading" });
  const [seasonTimeline, setSeasonTimeline] = useState<SeasonTimelineData | null>(null);
  const [isPreviousSeason, setIsPreviousSeason] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [recentDays, setRecentDays] = useState<RecentDaysData | null>(null);
  const [recentSession, setRecentSession] = useState<RecentCard | null | typeof LOADING_CARD>(LOADING_CARD);
  const [recentWeek, setRecentWeek] = useState<RecentCard | null | typeof LOADING_CARD>(LOADING_CARD);
  const [recentSeason, setRecentSeason] = useState<RecentCard | null | typeof LOADING_CARD>(LOADING_CARD);
  const [prEvents, setPrEvents] = useState<PREvent[] | null>(null);
  const [recentTooltipOpen, setRecentTooltipOpen] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<string | null | "loading">("loading");
  const [showHeuristicsOptIn, setShowHeuristicsOptIn] = useState(false);
  const [heuristicsOptInDeferred, setHeuristicsOptInDeferred] = useState(false);
  const [pendingHeuristicDays, setPendingHeuristicDays] = useState(0);
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

  useEffect(() => {
    cancelled.current = false;

    async function loadBase() {
      const [activeSeason, weekItems] = await Promise.all([
        getActiveSeasonInstance(),
        getWeekInstanceItemsForCurrentWeek(),
      ]);
      if (cancelled.current) return;

      setUpNext(computeUpNext(activeSeason, weekItems));

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
          if (!cancelled.current) setRecentDays(data);
        });
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

      const [sessionCard, weekCard, seasonCard] = await Promise.all([
        lastSession ? buildSessionCard(lastSession) : null,
        lastWeek ? buildWeekCard(lastWeek) : null,
        lastSeason ? buildSeasonCard(lastSeason) : null,
      ]);
      if (cancelled.current) return;

      setRecentSession(sessionCard);
      setRecentWeek(weekCard);
      setRecentSeason(seasonCard);
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
  }, []);

  useEffect(() => {
    async function loadHeuristics() {
      const [enabled, promptResponse] = await Promise.all([
        isHeuristicsEnabled(),
        getHeuristicsPromptResponse(),
      ]);

      if (enabled) {
        const pending = await getPendingHeuristicDates(3);
        setPendingHeuristicDays(pending.length);
      } else if (!promptResponse) {
        // Show opt-in only if user hasn't responded AND has completed >= 2 sessions
        const sessions = await getAll<SessionInstance>(STORE_NAMES.sessionInstances);
        const completedCount = sessions.filter((s) => s.status === "completed").length;
        if (completedCount >= 2) {
          setShowHeuristicsOptIn(true);
        }
      }
    }
    loadHeuristics();
  }, []);

  // ─── Heuristics opt-in ────────────────────────────────────────────────────

  async function handleOptInChoice(enable: boolean) {
    if (enable) {
      await setHeuristicsPromptResponse("yes");
      await setHeuristicsEnabled(true);
      await seedDefaultQuestions();
      const pending = await getPendingHeuristicDates(3);
      setPendingHeuristicDays(pending.length);
    }
    setHeuristicsOptInDeferred(true);
  }

  async function handleOptInDismiss() {
    if (!heuristicsOptInDeferred) return;
    // Only persist the prompt response on final dismiss — if they enabled,
    // the response was already saved in handleOptInChoice.
    const alreadyResponded = await getHeuristicsPromptResponse();
    if (!alreadyResponded) await setHeuristicsPromptResponse("later");
    setShowHeuristicsOptIn(false);
  }

  function renderHeuristicsOptIn() {
    if (!showHeuristicsOptIn) return null;

    if (heuristicsOptInDeferred) {
      return (
        <div className="dashboard-heuristics-optin">
          <p className="dashboard-heuristics-optin__desc">
            OK! You can change your mind at any time by toggling heuristics in the Settings menu.
          </p>
          <div className="dashboard-heuristics-optin__actions">
            <button
              type="button"
              className="dashboard-heuristics-optin__btn"
              onClick={handleOptInDismiss}
            >
              OK
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="dashboard-heuristics-optin">
        <p className="dashboard-heuristics-optin__heading">Enable heuristics tracking?</p>
        <p className="dashboard-heuristics-optin__desc">
          Heuristics don't affect your training program or any other feature. You can toggle this
          any time in Settings.
        </p>
        <details className="dashboard-heuristics-optin__details">
          <summary className="dashboard-heuristics-optin__summary">What are heuristics?</summary>
          <p className="dashboard-heuristics-optin__details-text">
            A way to track subjective, anecdotal scores on training-adjacent variables — things like sleep
            quality, nutrition, hydration, stress, and anything else you choose. You define your own questions
            and rate them on a simple 1–5 scale whenever it suits you.
          </p>
        </details>
        <details className="dashboard-heuristics-optin__details">
          <summary className="dashboard-heuristics-optin__summary">What's the benefit?</summary>
          <p className="dashboard-heuristics-optin__details-text">
            At the end of a training block, you can review your heuristics alongside your training analytics
            to add another dimension to your results. See how factors like sleep consistency or creatine intake
            may have contributed to the strength gains you did (or didn't) make over the period.
          </p>
        </details>
        <div className="dashboard-heuristics-optin__actions">
          <button
            type="button"
            className="dashboard-heuristics-optin__btn"
            onClick={() => handleOptInChoice(true)}
          >
            Try it now
          </button>
          <button
            type="button"
            className="dashboard-heuristics-optin__btn"
            onClick={() => handleOptInChoice(false)}
          >
            Decide later
          </button>
        </div>
      </div>
    );
  }

  const showHeuristicsUpNext = pendingHeuristicDays > 0 &&
    (upNext.type === "rest_day" || upNext.type === "upcoming" || upNext.type === "week_complete");

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

  function renderTimeline() {
    if (timelineLoading) {
      return (
        <section className="dashboard-section">
          <h2 className="dashboard-section-title">Season progress</h2>
          <div className="dashboard-spinner" />
        </section>
      );
    }
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

        {recentDays && (
          <div className="dashboard-timeline-recent">
            <div className="dashboard-timeline-recent__label">Schedule (actual)</div>
            <div
              className="dashboard-timeline-recent__grid"
              style={{ ["--cols" as string]: recentDays.cols }}
            >
              {recentDays.rows.map((row, ri) => {
                const deltaLabel = row.delta > 0
                  ? `Total: +${row.delta}`
                  : row.delta < 0
                    ? `Total: ${row.delta}`
                    : "Total: 0";
                const deltaModifier = row.delta > 0 ? "ahead" : row.delta < 0 ? "behind" : "ok";
                return (
                  <div key={ri} className="dashboard-timeline-recent__row-block">
                    <div className="dashboard-timeline-recent__row-main">
                      <div className="dashboard-timeline-recent__row-headers">
                        {row.headerLetters.map((letter, i) => (
                          <span key={i} className="dashboard-timeline-recent__header-cell">{letter}</span>
                        ))}
                      </div>
                      <div className="dashboard-timeline-recent__row">
                        {row.cells.map((cell, ci) => (
                          <div key={ci} className="dashboard-timeline-recent__slot">
                            {cell && (
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
                        ))}
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
        )}
      </section>
    );
  }

  // ─── Recent summaries ─────────────────────────────────────────────────────

  function renderRecentCard(card: RecentCard | null | typeof LOADING_CARD, label: string) {
    const isLoading = card === LOADING_CARD;
    const data = isLoading ? null : card;
    if (!isLoading && !data) return null;
    return (
      <div
        className={`dashboard-recent-card${data ? " dashboard-recent-card--link" : ""}`}
        aria-label={label}
        role={data ? "button" : undefined}
        tabIndex={data ? 0 : undefined}
        onClick={() => data && navigate(data.link)}
        onKeyDown={(e) => e.key === "Enter" && data && navigate(data.link)}
      >
        <div className="dashboard-recent-card__icon">
          {isLoading ? (
            <div className="dashboard-spinner" />
          ) : data!.ragStatus ? (
            <Medal status={data!.ragStatus} size="lg" />
          ) : data!.grade ? (
            <span
              className={[
                "dashboard-recent-card__grade",
                data!.gradeKind ? `dashboard-recent-card__grade--${data!.gradeKind}` : "",
                data!.gradeColor ? `dashboard-recent-card__grade--${data!.gradeColor}` : "",
              ].filter(Boolean).join(" ")}
            >
              {data!.grade}
            </span>
          ) : null}
        </div>
        {!isLoading && (
          <span className="dashboard-recent-card__name">{data!.name}</span>
        )}
      </div>
    );
  }

  const hasAnyRecent =
    recentSession !== null || recentWeek !== null || recentSeason !== null;

  // ─── PR Spotlight ─────────────────────────────────────────────────────────

  const spotlight = prEvents?.[0] ?? null;

  function renderPRSpotlight() {
    if (prEvents === null) {
      return (
        <section className="dashboard-section">
          <h2 className="dashboard-section-title">Most recent PR</h2>
          <div className="dashboard-spinner" />
        </section>
      );
    }
    if (!spotlight) return null;
    const daysSincePrev =
      spotlight.previousDate
        ? daysBetween(spotlight.previousDate, spotlight.date)
        : null;
    const pctImprovement =
      spotlight.prType === "e1rm" && spotlight.newE1RM && spotlight.previousE1RM
        ? Math.round(((spotlight.newE1RM - spotlight.previousE1RM) / spotlight.previousE1RM) * 100)
        : spotlight.prType === "reps" && spotlight.newReps && spotlight.previousReps
        ? Math.round(((spotlight.newReps - spotlight.previousReps) / spotlight.previousReps) * 100)
        : null;

    return (
      <section className="dashboard-section">
        <h2 className="dashboard-section-title">Most recent PR</h2>
        <div className="dashboard-pr-spotlight">
          <p className="dashboard-pr-spotlight__exercise">{spotlight.exerciseName}</p>
          <div className="dashboard-pr-spotlight__values">
            {spotlight.prType === "e1rm" ? (
              <>
                {spotlight.previousE1RM != null && (
                  <span className="dashboard-pr-spotlight__prev">
                    {Math.round(spotlight.previousE1RM * 10) / 10}kg e1RM
                  </span>
                )}
                {spotlight.previousE1RM != null && <span className="dashboard-pr-spotlight__arrow">→</span>}
                <span className="dashboard-pr-spotlight__new">
                  {spotlight.newE1RM != null ? `${Math.round(spotlight.newE1RM * 10) / 10}kg e1RM` : "—"}
                </span>
              </>
            ) : (
              <>
                {spotlight.previousReps != null && (
                  <span className="dashboard-pr-spotlight__prev">{spotlight.previousReps} reps</span>
                )}
                {spotlight.previousReps != null && <span className="dashboard-pr-spotlight__arrow">→</span>}
                <span className="dashboard-pr-spotlight__new">{spotlight.newReps} reps</span>
              </>
            )}
            {pctImprovement != null && (
              <span className="dashboard-pr-spotlight__pct">+{pctImprovement}%</span>
            )}
          </div>
          <div className="dashboard-pr-spotlight__meta">
            <span>{shortDate(spotlight.date)}</span>
            {daysSincePrev != null && (
              <span>{daysSincePrev} days after previous PR</span>
            )}
          </div>
          {spotlight.previousDate && (
            <div className="dashboard-pr-spotlight__chart">
              <ExerciseInsights
                exerciseTemplateId={spotlight.exerciseName}
                exerciseName={spotlight.exerciseName}
                currentExerciseInstanceId=""
                isBodyweight={spotlight.isBodyweight}
                fromDate={spotlight.previousDate.split("T")[0]}
                minSessions={5}
              />
            </div>
          )}
        </div>
      </section>
    );
  }

  // ─── All PRs ──────────────────────────────────────────────────────────────

  function renderAllPRs() {
    if (prEvents === null) {
      return (
        <section className="dashboard-section">
          <h2 className="dashboard-section-title">Personal records</h2>
          <div className="dashboard-spinner" />
        </section>
      );
    }
    if (prEvents.length === 0) return null;
    return (
      <section className="dashboard-section">
        <h2 className="dashboard-section-title">Personal records</h2>
        <ul className="dashboard-pr-list">
          {prEvents.slice(0, 15).map((pr, i) => {
            const daysAgo = daysBetween(pr.date, localDateIso());
            const agoLabel = daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : `${daysAgo} days ago`;
            return (
            <li key={i} className="dashboard-pr-item">
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
    if (lastBackupAt === "loading") return null;
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

  return (
    <main className="dashboard-page">
      <TopBar title="Dashboard" />
      <section className="dashboard-shell">
        <section className="dashboard-section">
          {renderUpNext()}
        </section>

        {renderHeuristicsOptIn()}

        {renderTimeline()}

        {hasAnyRecent && (
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
        )}

        {renderBackupNudge()}

        {renderPRSpotlight()}

        {renderAllPRs()}
      </section>

      <BottomNav activeTab="home" />
    </main>
  );
}
