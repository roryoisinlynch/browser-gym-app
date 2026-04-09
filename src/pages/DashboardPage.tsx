import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SeasonInstance, SessionInstance, WeekInstance } from "../domain/models";
import type { PREvent, SessionInstanceView, WeekInstanceItemView } from "../repositories/programRepository";
import {
  getActiveSeasonInstance,
  getAllTimePREvents,
  getCanonicalWeekTemplateForSeason,
  getLastCompletedSeasonInstance,
  getLastCompletedSessionInstance,
  getLastCompletedWeekInstance,
  getSessionInstanceById,
  getSessionInstanceView,
  getSessionInstancesForWeekInstance,
  getWeekInstanceItemsForCurrentWeek,
  getWeekInstanceItemsForWeekInstance,
  getWeekInstancesForSeasonInstance,
  getWeekTemplateItemsForWeekTemplate,
} from "../repositories/programRepository";
import ExerciseInsights from "../components/ExerciseInsights";
import TrafficLight from "../components/TrafficLight";
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
  | { type: "today_session"; sessionId: string; sessionName: string }
  | { type: "rest_day"; nextSessionName: string | null; nextDate: string | null; daysUntil: number | null }
  | { type: "upcoming"; sessionId: string; sessionName: string; date: string; daysUntil: number }
  | { type: "week_complete" };

type DaySquareStatus = "green" | "amber" | "red" | "grey" | "rest-past" | "rest-future";

interface DaySquare {
  type: "session" | "rest";
  scheduledDate: string;
  status: DaySquareStatus;
}

interface SeasonTimelineData {
  startDate: string;
  endDate: string;
  totalWeeks: number;
  days: DaySquare[];
  currentWeekOrder: number;
  expectedWeekOrder: number;
}

interface RecentCard {
  id: string;
  name: string;
  grade: string | null;
  gradeColor: "green" | "amber" | "red" | null;
  ragStatus?: "green" | "amber" | "red";
  link: string;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function localDateIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso.split("T")[0] + "T00:00:00").getTime();
  const b = new Date(toIso.split("T")[0] + "T00:00:00").getTime();
  return Math.round((b - a) / 86400000);
}

function friendlyDate(iso: string): string {
  const d = new Date(iso.split("T")[0] + "T00:00:00");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const ord = (n: number) => {
    const v = n % 100;
    return n + (["th", "st", "nd", "rd"][(v - 20) % 10] || ["th", "st", "nd", "rd"][v] || "th");
  };
  return `${days[d.getDay()]} ${ord(d.getDate())} ${months[d.getMonth()]}`;
}

function shortDate(iso: string): string {
  const d = new Date(iso.split("T")[0] + "T00:00:00");
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
    new Date(anchor.sessionInstance!.date.split("T")[0] + "T00:00:00").getTime() -
    (anchor.weekInstanceItem.order - 1) * 86400000;

  const itemDate = (item: WeekInstanceItemView) =>
    localDateIso(new Date(weekStartMs + (item.weekInstanceItem.order - 1) * 86400000));

  const todayItem = weekItems.find((item) => itemDate(item) === today);

  if (todayItem) {
    if (todayItem.weekInstanceItem.type === "rest") {
      const next = weekItems
        .filter(
          (item) =>
            item.weekInstanceItem.type === "session" &&
            item.sessionInstance?.status !== "completed" &&
            itemDate(item) > today
        )
        .sort((a, b) => a.weekInstanceItem.order - b.weekInstanceItem.order)[0];
      return {
        type: "rest_day",
        nextSessionName: next?.sessionTemplate?.name ?? null,
        nextDate: next ? itemDate(next) : null,
        daysUntil: next ? daysBetween(today, itemDate(next)) : null,
      };
    }

    if (todayItem.sessionInstance?.status === "completed") {
      const next = weekItems
        .filter(
          (item) =>
            item.weekInstanceItem.type === "session" &&
            item.sessionInstance?.status !== "completed" &&
            itemDate(item) > today
        )
        .sort((a, b) => a.weekInstanceItem.order - b.weekInstanceItem.order)[0];
      if (next?.sessionInstance && next.sessionTemplate) {
        return {
          type: "upcoming",
          sessionId: next.sessionInstance.id,
          sessionName: next.sessionTemplate.name,
          date: itemDate(next),
          daysUntil: daysBetween(today, itemDate(next)),
        };
      }
      return { type: "week_complete" };
    }

    return {
      type: "today_session",
      sessionId: todayItem.sessionInstance?.id ?? "",
      sessionName: todayItem.sessionTemplate?.name ?? "Session",
    };
  }

  // Today is not in this week — find next upcoming session
  const nextUpcoming = weekItems
    .filter(
      (item) =>
        item.weekInstanceItem.type === "session" &&
        item.sessionInstance?.status !== "completed" &&
        itemDate(item) > today
    )
    .sort((a, b) => a.weekInstanceItem.order - b.weekInstanceItem.order)[0];

  if (nextUpcoming?.sessionInstance && nextUpcoming.sessionTemplate) {
    return {
      type: "upcoming",
      sessionId: nextUpcoming.sessionInstance.id,
      sessionName: nextUpcoming.sessionTemplate.name,
      date: itemDate(nextUpcoming),
      daysUntil: daysBetween(today, itemDate(nextUpcoming)),
    };
  }

  return { type: "week_complete" };
}

// ─── Async loaders ────────────────────────────────────────────────────────────

async function loadTimeline(
  season: SeasonInstance
): Promise<SeasonTimelineData | null> {
  const [weekInstances, canonicalWeek] = await Promise.all([
    getWeekInstancesForSeasonInstance(season.id),
    getCanonicalWeekTemplateForSeason(season.seasonTemplateId),
  ]);
  if (!canonicalWeek || weekInstances.length === 0) return null;

  const templateItems = await getWeekTemplateItemsForWeekTemplate(canonicalWeek.id);
  const weekLength = templateItems.length;
  if (weekLength === 0) return null;
  if (!season.startedAt) return null;

  const totalWeeks = weekInstances.length;
  const seasonStartIso = season.startedAt.split("T")[0];
  const seasonStartMs = new Date(seasonStartIso + "T00:00:00").getTime();
  const endMs = seasonStartMs + totalWeeks * weekLength * 86400000;
  const endDate = localDateIso(new Date(endMs));

  const today = localDateIso();
  const daysElapsed = Math.max(0, daysBetween(seasonStartIso, today));
  const expectedWeekOrder = Math.min(Math.floor(daysElapsed / weekLength) + 1, totalWeeks);

  const inProgressWeek = weekInstances.find((w) => w.status === "in_progress");
  const completedCount = weekInstances.filter((w) => w.status === "completed").length;
  const currentWeekOrder = inProgressWeek?.order ?? Math.min(completedCount + 1, totalWeeks);

  // Load week instance items for every week in parallel
  const sortedWeeks = [...weekInstances].sort((a, b) => a.order - b.order);
  const weekItemsPerWeek = await Promise.all(
    sortedWeeks.map((w) => getWeekInstanceItemsForWeekInstance(w.id))
  );

  // Build per-day squares
  const days: DaySquare[] = [];
  for (let wi = 0; wi < sortedWeeks.length; wi++) {
    const weekItems = weekItemsPerWeek[wi].sort((a, b) => a.order - b.order);
    for (const item of weekItems) {
      const dayIndex = wi * weekLength + (item.order - 1);
      const scheduledDate = localDateIso(new Date(seasonStartMs + dayIndex * 86400000));

      if (item.type === "rest") {
        days.push({
          type: "rest",
          scheduledDate,
          status: scheduledDate < today ? "rest-past" : "rest-future",
        });
        continue;
      }

      // Session day — resolve status
      if (!item.sessionInstanceId) {
        days.push({ type: "session", scheduledDate, status: scheduledDate <= today ? "red" : "grey" });
        continue;
      }
      const session = await getSessionInstanceById(item.sessionInstanceId);
      if (!session) {
        days.push({ type: "session", scheduledDate, status: "grey" });
        continue;
      }

      if (session.status !== "completed") {
        days.push({ type: "session", scheduledDate, status: scheduledDate <= today ? "red" : "grey" });
        continue;
      }

      const completedDate = session.completedAt
        ? session.completedAt.split("T")[0]
        : scheduledDate;
      let status: DaySquareStatus;
      if (completedDate < scheduledDate) status = "amber";
      else if (completedDate > scheduledDate) status = "red";
      else status = "green";
      days.push({ type: "session", scheduledDate, status });
    }
  }

  return {
    startDate: seasonStartIso,
    endDate,
    totalWeeks,
    days,
    currentWeekOrder,
    expectedWeekOrder,
  };
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
    const scoreColor: "green" | "amber" | "red" =
      wm.weekScore >= 96 ? "green" : wm.weekScore >= 88 ? "amber" : "red";
    return {
      id: week.id,
      name: `Week ${week.order}`,
      grade: emojiForRating(wm.emojiRating),
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
    const sm = computeSeasonMetrics(season, weekMetrics);
    return {
      id: season.id,
      name: season.name,
      grade: sm.grade,
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

  const [upNext, setUpNext] = useState<UpNextState>({ type: "loading" });
  const [seasonTimeline, setSeasonTimeline] = useState<SeasonTimelineData | null>(null);
  const [recentSession, setRecentSession] = useState<RecentCard | null | typeof LOADING_CARD>(LOADING_CARD);
  const [recentWeek, setRecentWeek] = useState<RecentCard | null | typeof LOADING_CARD>(LOADING_CARD);
  const [recentSeason, setRecentSeason] = useState<RecentCard | null | typeof LOADING_CARD>(LOADING_CARD);
  const [prEvents, setPrEvents] = useState<PREvent[] | null>(null);

  useEffect(() => {
    cancelled.current = false;

    async function loadBase() {
      const [activeSeason, weekItems] = await Promise.all([
        getActiveSeasonInstance(),
        getWeekInstanceItemsForCurrentWeek(),
      ]);
      if (cancelled.current) return;

      setUpNext(computeUpNext(activeSeason, weekItems));

      if (activeSeason) {
        loadTimeline(activeSeason).then((tl) => {
          if (!cancelled.current) setSeasonTimeline(tl);
        });
      }

      loadSecondary();
    }

    async function loadSecondary() {
      const [lastSession, lastWeek, lastSeason, prList] = await Promise.all([
        getLastCompletedSessionInstance(),
        getLastCompletedWeekInstance(),
        getLastCompletedSeasonInstance(),
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
            className="dashboard-up-next dashboard-up-next--active"
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/session/${upNext.sessionId}`)}
            onKeyDown={(e) => e.key === "Enter" && navigate(`/session/${upNext.sessionId}`)}
          >
            <span className="dashboard-up-next__pill dashboard-up-next__pill--active">Session active</span>
            <p className="dashboard-up-next__heading">{upNext.sessionName}</p>
            <span className="dashboard-up-next__caret">→</span>
          </div>
        );

      case "today_session":
        return (
          <div
            className="dashboard-up-next dashboard-up-next--today"
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/session/${upNext.sessionId}`)}
            onKeyDown={(e) => e.key === "Enter" && navigate(`/session/${upNext.sessionId}`)}
          >
            <span className="dashboard-up-next__pill dashboard-up-next__pill--today">Today</span>
            <p className="dashboard-up-next__heading">{upNext.sessionName}</p>
            <span className="dashboard-up-next__caret">→</span>
          </div>
        );

      case "rest_day":
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
        return (
          <div
            className="dashboard-up-next dashboard-up-next--upcoming"
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/session/${upNext.sessionId}`)}
            onKeyDown={(e) => e.key === "Enter" && navigate(`/session/${upNext.sessionId}`)}
          >
            <span className="dashboard-up-next__pill">
              {upNext.daysUntil === 0 ? "Today" : upNext.daysUntil === 1 ? "Tomorrow" : `In ${upNext.daysUntil} days`}
            </span>
            <p className="dashboard-up-next__heading">{upNext.sessionName}</p>
            <p className="dashboard-up-next__sub">{friendlyDate(upNext.date)}</p>
            <span className="dashboard-up-next__caret">→</span>
          </div>
        );

      case "week_complete":
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
    if (!seasonTimeline) return null;
    const { startDate, endDate, days, currentWeekOrder, expectedWeekOrder, totalWeeks } = seasonTimeline;
    const isAhead = currentWeekOrder > expectedWeekOrder;
    const isBehind = currentWeekOrder < expectedWeekOrder;

    return (
      <section className="dashboard-section">
        <h2 className="dashboard-section-title">Season progress</h2>
        <div className="dashboard-timeline">
          <div className="dashboard-timeline__days">
            {days.map((day, i) => (
              <div
                key={i}
                className={`dashboard-timeline__day dashboard-timeline__day--${day.status}`}
                title={day.scheduledDate}
              />
            ))}
          </div>
          <div className="dashboard-timeline__legend">
            <span className="dashboard-timeline__legend-item dashboard-timeline__legend-item--green" />
            <span className="dashboard-timeline__legend-label">On time</span>
            <span className="dashboard-timeline__legend-item dashboard-timeline__legend-item--amber" />
            <span className="dashboard-timeline__legend-label">Early</span>
            <span className="dashboard-timeline__legend-item dashboard-timeline__legend-item--red" />
            <span className="dashboard-timeline__legend-label">Late / missed</span>
            <span className="dashboard-timeline__legend-item dashboard-timeline__legend-item--rest-past" />
            <span className="dashboard-timeline__legend-label">Rest</span>
          </div>
          <div className="dashboard-timeline__meta">
            <span className="dashboard-timeline__date">{shortDate(startDate)}</span>
            <span className="dashboard-timeline__status">
              {isAhead && <span className="dashboard-timeline__status--ahead">Ahead of schedule</span>}
              {isBehind && <span className="dashboard-timeline__status--behind">Behind schedule</span>}
              {!isAhead && !isBehind && <span className="dashboard-timeline__status--ok">On schedule</span>}
              {" · "}Week {currentWeekOrder} of {totalWeeks}
            </span>
            <span className="dashboard-timeline__date">{shortDate(endDate)}</span>
          </div>
        </div>
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
        role={data ? "button" : undefined}
        tabIndex={data ? 0 : undefined}
        onClick={() => data && navigate(data.link)}
        onKeyDown={(e) => e.key === "Enter" && data && navigate(data.link)}
      >
        <span className="dashboard-recent-card__label">{label}</span>
        {isLoading ? (
          <span className="dashboard-recent-card__name dashboard-recent-card__name--loading">—</span>
        ) : (
          <>
            <span className="dashboard-recent-card__name">{data!.name}</span>
            {data!.ragStatus ? (
              <TrafficLight status={data!.ragStatus} size="sm" />
            ) : data!.grade ? (
              <span
                className={`dashboard-recent-card__grade${data!.gradeColor ? ` dashboard-recent-card__grade--${data!.gradeColor}` : ""}`}
              >
                {data!.grade}
              </span>
            ) : null}
          </>
        )}
      </div>
    );
  }

  const hasAnyRecent =
    recentSession !== null || recentWeek !== null || recentSeason !== null;

  // ─── PR Spotlight ─────────────────────────────────────────────────────────

  const spotlight = prEvents?.[0] ?? null;

  function renderPRSpotlight() {
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
    if (!prEvents || prEvents.length === 0) return null;
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

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <main className="dashboard-page">
      <TopBar title="Dashboard" />
      <section className="dashboard-shell">
        <header className="dashboard-header">
          <p className="dashboard-eyebrow">Overview</p>
          <h1 className="dashboard-title">Dashboard</h1>
        </header>

        {renderUpNext()}

        {renderTimeline()}

        {hasAnyRecent && (
          <section className="dashboard-section">
            <h2 className="dashboard-section-title">Recent</h2>
            <div className="dashboard-recent-grid">
              {renderRecentCard(recentSession, "Session")}
              {renderRecentCard(recentWeek, "Week")}
              {renderRecentCard(recentSeason, "Season")}
            </div>
          </section>
        )}

        {renderPRSpotlight()}

        {renderAllPRs()}
      </section>

      <BottomNav activeTab="home" />
    </main>
  );
}
