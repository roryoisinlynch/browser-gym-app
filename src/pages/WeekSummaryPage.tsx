import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { SessionInstanceView, SessionPR } from "../repositories/programRepository";
import {
  getWeekInstanceById,
  getWeekTemplateById,
  getWeekTemplateItemsForWeekTemplate,
  getSessionInstancesForWeekInstance,
  getSessionInstanceView,
  getWeekInstancesForSeasonInstance,
  getWeekPRs,
  getWeekInstanceItemsForWeekInstance,
  getSeasonInstanceById,
  getSeasonTemplateById,
} from "../repositories/programRepository";
import type { SeasonInstance } from "../domain/models";
import type { WeekTemplateItem, WeekInstanceItem } from "../domain/models";
import {
  isHeuristicsEnabled,
  getQuestions,
  getEntriesForDateRange,
} from "../repositories/heuristicsRepository";
import { colorForHeuristicScore, percentileOrNull } from "../services/heuristicsScale";
import { computeSessionMetrics } from "../services/sessionMetrics";
import { computeWeekMetrics, emojiForRating } from "../services/weekMetrics";
import type { WeekMetrics } from "../services/weekMetrics";
import WeeklyBreadcrumb from "../components/WeeklyBreadcrumb";
import type { BreadcrumbSession } from "../components/WeeklyBreadcrumb";
import WeeksBreadcrumb from "../components/WeeksBreadcrumb";
import type { BreadcrumbWeek } from "../components/WeeksBreadcrumb";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import "./WeekSummaryPage.css";

function buildWeekNarrative(metrics: WeekMetrics): string {
  const { volumeScore, intensityScore, consistencyScore } = metrics;

  const volStatus = volumeScore >= 100 ? "green" : volumeScore >= 90 ? "amber" : "red";
  const intStatus = intensityScore >= 100 ? "green" : intensityScore >= 90 ? "amber" : "red";
  const conStatus = consistencyScore >= 100 ? "green" : consistencyScore >= 90 ? "amber" : "red";

  const volPhrase =
    volStatus === "green" ? "logged enough sets to meet your volume target"
    : volStatus === "amber" ? "almost logged enough sets to meet your volume target"
    : "didn't log enough sets to meet your volume target";

  const intPhrase =
    intStatus === "green" ? "lifted enough weight to hit your intensity target"
    : intStatus === "amber" ? "almost lifted enough weight to hit your intensity target"
    : "didn't lift enough weight to hit your intensity target";

  const conPhrase =
    conStatus === "green" ? "stayed consistent with your schedule"
    : conStatus === "amber" ? "almost stayed consistent with your schedule"
    : "didn't stay consistent with your schedule";

  const items = [
    { positive: volStatus !== "red", phrase: volPhrase },
    { positive: intStatus !== "red", phrase: intPhrase },
    { positive: conStatus !== "red", phrase: conPhrase },
  ];

  const positives = items.filter(i => i.positive).map(i => i.phrase);
  const negatives = items.filter(i => !i.positive).map(i => i.phrase);

  function join(phrases: string[]): string {
    if (phrases.length === 1) return phrases[0];
    if (phrases.length === 2) return `${phrases[0]} and ${phrases[1]}`;
    return `${phrases[0]}, ${phrases[1]}, and ${phrases[2]}`;
  }

  if (negatives.length === 0) return `You ${join(positives)}.`;
  if (positives.length === 0) return `You ${join(negatives)}.`;
  return `You ${join(positives)}, but you ${join(negatives)}.`;
}

type DaySquareStatus = "green" | "overdue" | "skipped" | "grey" | "rest-past" | "rest-future";
interface DaySquare { type: "session" | "rest"; scheduledDate: string; status: DaySquareStatus; }

function localDateIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toLocalMidnight(iso: string): Date {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayDiffInclusive(startIso: string, endIso: string): number {
  const s = new Date(startIso + "T00:00:00").getTime();
  const e = new Date(endIso + "T00:00:00").getTime();
  return Math.floor((e - s) / 86_400_000) + 1;
}

interface HeuristicSummaryRow {
  questionId: string;
  label: string;
  avg: number | null;
  givenCount: number;
  missingDays: number;
  totalDays: number;
  /** Q1/Q3 of the user's actual answers in this window; null when n < 2. */
  q1: number | null;
  q3: number | null;
}

export default function WeekSummaryPage() {
  const { weekInstanceId } = useParams<{ weekInstanceId: string }>();
  const [weekName, setWeekName] = useState<string | null>(null);
  const [weekEndedEarly, setWeekEndedEarly] = useState(false);
  const [metrics, setMetrics] = useState<ReturnType<typeof computeWeekMetrics> | null>(null);
  const [sessionBreadcrumb, setSessionBreadcrumb] = useState<BreadcrumbSession[]>([]);
  const [weeksBreadcrumb, setWeeksBreadcrumb] = useState<BreadcrumbWeek[]>([]);
  const [prs, setPrs] = useState<SessionPR[]>([]);
  const [weekTemplateDays, setWeekTemplateDays] = useState<WeekTemplateItem[]>([]);
  const [weekInstanceItems, setWeekInstanceItems] = useState<WeekInstanceItem[]>([]);
  const [, setCompletedSessionIds] = useState<Set<string>>(new Set());
  const [seasonInstance, setSeasonInstance] = useState<SeasonInstance | null>(null);
  const [weekStartIso, setWeekStartIso] = useState<string | null>(null);
  const [extraRestDays, setExtraRestDays] = useState<number>(0);
  const [sessionInfoMap, setSessionInfoMap] = useState<Map<string, { date: string; status: string; completedAt: string | null }>>(new Map());
  const [heuristicSummary, setHeuristicSummary] = useState<HeuristicSummaryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      if (!weekInstanceId) {
        setErrorMessage("No week provided.");
        setIsLoading(false);
        return;
      }

      try {
        const [weekInstance, weekPRs] = await Promise.all([
          getWeekInstanceById(weekInstanceId),
          getWeekPRs(weekInstanceId),
        ]);
        setLoadProgress(15);

        if (!weekInstance) {
          setErrorMessage("Week not found.");
          setIsLoading(false);
          return;
        }

        const seasonInstanceForRir = await getSeasonInstanceById(weekInstance.seasonInstanceId);
        const [weekTemplate, sessions, wii, seasonTemplateForRir] = await Promise.all([
          getWeekTemplateById(weekInstance.weekTemplateId),
          getSessionInstancesForWeekInstance(weekInstanceId),
          getWeekInstanceItemsForWeekInstance(weekInstanceId),
          seasonInstanceForRir
            ? getSeasonTemplateById(seasonInstanceForRir.seasonTemplateId)
            : Promise.resolve(undefined),
        ]);
        setLoadProgress(30);

        const templateItems = await getWeekTemplateItemsForWeekTemplate(
          weekInstance.weekTemplateId
        );
        setLoadProgress(40);

        // Load views for settled sessions only — those drive week metrics.
        const sessionViews: SessionInstanceView[] = (
          await Promise.all(
            sessions
              .filter(
                (s) => s.status === "completed" || s.status === "skipped"
              )
              .map((s) => getSessionInstanceView(s.id))
          )
        ).filter((sv): sv is SessionInstanceView => sv != null);
        setLoadProgress(55);

        setMetrics(computeWeekMetrics(weekInstance, templateItems, sessionViews));

        const weekRir =
          seasonTemplateForRir?.rirSequence?.[weekInstance.order - 1] ??
          weekTemplate?.targetRir;
        setWeekName(
          weekRir != null
            ? `Week ${weekInstance.order}, ${weekRir} RIR`
            : `Week ${weekInstance.order}`
        );
        setWeekEndedEarly(weekInstance.endedEarly === true);
        setPrs(weekPRs);
        setWeekTemplateDays(templateItems);
        setWeekInstanceItems(wii);
        setCompletedSessionIds(new Set(sessions.filter(s => s.status === "completed").map(s => s.id)));

        // Build session info map for day-square timeline
        setSessionInfoMap(new Map(sessions.map(s => [s.id, { date: s.date, status: s.status, completedAt: s.completedAt ?? null }])));

        // Derive week start date from any session's scheduled date minus its wii order offset
        for (const item of wii) {
          if (item.sessionInstanceId) {
            const session = sessions.find(s => s.id === item.sessionInstanceId);
            if (session) {
              const startMs = toLocalMidnight(session.date).getTime() - (item.order - 1) * 86400000;
              setWeekStartIso(localDateIso(new Date(startMs)));
              break;
            }
          }
        }

        if (weekInstance.status === "completed") {
          const si = await getSeasonInstanceById(weekInstance.seasonInstanceId);
          if (si?.status === "completed") setSeasonInstance(si);
        }
        setLoadProgress(65);

        // Sessions this week breadcrumb — show all sessions with their RAG status.
        const breadcrumbSessions: BreadcrumbSession[] = await Promise.all(
          sessions.map(async (session): Promise<BreadcrumbSession> => {
            if (session.status === "skipped") {
              return { sessionInstanceId: session.id, ragStatus: "skipped", isCurrent: false };
            }
            if (session.status !== "completed") {
              return { sessionInstanceId: session.id, ragStatus: null, isCurrent: false };
            }
            try {
              const sv = sessionViews.find((v) => v.sessionInstance.id === session.id)
                ?? await getSessionInstanceView(session.id);
              if (!sv) return { sessionInstanceId: session.id, ragStatus: null, isCurrent: false };
              const m = computeSessionMetrics(sv);
              return { sessionInstanceId: session.id, ragStatus: m.ragStatus, isCurrent: false };
            } catch {
              return { sessionInstanceId: session.id, ragStatus: null, isCurrent: false };
            }
          })
        );
        setSessionBreadcrumb(breadcrumbSessions);
        setLoadProgress(80);

        // Weeks this season breadcrumb — show all expected weeks, not just generated ones.
        // Uses rirSequence.length as the authoritative total so future weeks appear as
        // empty dots even before they are generated by the lazy week creation logic.
        const allWeeks = await getWeekInstancesForSeasonInstance(
          weekInstance.seasonInstanceId
        );
        const totalWeeks = seasonTemplateForRir?.rirSequence?.length ?? allWeeks.length;
        const weekByOrder = new Map(allWeeks.map((w) => [w.order, w]));

        // Extra rest = calendar days this week owns minus its template length.
        // Boundary rule: a week spans from the prior week's end-boundary to the
        // next week's start of activity. The "earliest completed session of
        // week N+1" defines the boundary so a gap before week N+1's first
        // session belongs to week N. Falls back to startedAt / season end /
        // today when nothing has been logged yet.
        const nextWeek = weekByOrder.get(weekInstance.order + 1);
        let endBoundaryIso: string | null = null;
        if (nextWeek) {
          const nextSessions = await getSessionInstancesForWeekInstance(nextWeek.id);
          const earliestCompletedNext = nextSessions
            .filter((s) => s.status === "completed" && s.completedAt)
            .map((s) => s.completedAt!)
            .sort((a, b) => a.localeCompare(b))[0];
          endBoundaryIso = earliestCompletedNext ?? nextWeek.startedAt ?? null;
        }
        if (!endBoundaryIso) {
          const si = await getSeasonInstanceById(weekInstance.seasonInstanceId);
          endBoundaryIso = si?.completedAt ?? new Date().toISOString();
        }
        // Week N's actual start = boundary from week N-1. Week 1 starts at the
        // season start; week N>=2 starts at its own earliest completed session,
        // falling back to its startedAt (which is when week N-1 completed).
        let actualStartIso: string | null = null;
        if (weekInstance.order === 1) {
          actualStartIso = weekInstance.startedAt ?? null;
        } else {
          const earliestCompletedHere = sessions
            .filter((s) => s.status === "completed" && s.completedAt)
            .map((s) => s.completedAt!)
            .sort((a, b) => a.localeCompare(b))[0];
          actualStartIso = earliestCompletedHere ?? weekInstance.startedAt ?? null;
        }
        if (actualStartIso) {
          const startMs = toLocalMidnight(actualStartIso).getTime();
          const endMs = toLocalMidnight(endBoundaryIso).getTime();
          const dayDiff = Math.max(0, Math.round((endMs - startMs) / 86_400_000));
          setExtraRestDays(Math.max(0, dayDiff - templateItems.length));
        }

        // ── Heuristics summary ───────────────────────────────────────────
        // Mirrors the SeasonSummaryPage logic, just scoped to this week's
        // [actualStart, endBoundary] range. End is capped at today so the
        // pin/bar don't extend into days the user couldn't have logged yet
        // (in-progress weeks whose endBoundary defaults to today already
        // respect this; the cap is defensive for any future boundary case).
        if (actualStartIso && (await isHeuristicsEnabled())) {
          const questions = await getQuestions();
          if (questions.length > 0) {
            const todayIso = localDateIso();
            const startIso = localDateIso(toLocalMidnight(actualStartIso));
            const rawEndIso = localDateIso(toLocalMidnight(endBoundaryIso));
            const endIso = rawEndIso > todayIso ? todayIso : rawEndIso;
            const totalDays = Math.max(0, dayDiffInclusive(startIso, endIso));

            if (totalDays > 0) {
              const entries = await getEntriesForDateRange(startIso, endIso);
              const byQuestion = new Map<string, typeof entries>();
              for (const e of entries) {
                const list = byQuestion.get(e.questionId) ?? [];
                list.push(e);
                byQuestion.set(e.questionId, list);
              }

              const summary: HeuristicSummaryRow[] = questions.map((q) => {
                const qEntries = byQuestion.get(q.id) ?? [];
                const datesAnswered = new Set<string>();
                const values: number[] = [];
                let sum = 0;
                for (const e of qEntries) {
                  if (e.value != null && !datesAnswered.has(e.date)) {
                    datesAnswered.add(e.date);
                    sum += e.value;
                    values.push(e.value);
                  }
                }
                const givenCount = datesAnswered.size;
                const missingDays = Math.max(0, totalDays - givenCount);
                // Simple mean of answered values only — matches the season
                // page and keeps the pin in the same distribution as Q1/Q3.
                const avg = givenCount > 0 ? sum / givenCount : null;
                const sortedValues = [...values].sort((a, b) => a - b);
                const q1 = percentileOrNull(sortedValues, 0.25);
                const q3 = percentileOrNull(sortedValues, 0.75);
                return {
                  questionId: q.id,
                  label: q.label,
                  avg,
                  givenCount,
                  missingDays,
                  totalDays,
                  q1,
                  q3,
                };
              });
              // Drop questions the user never answered in this window — an
              // all-missing row carries no signal and just clutters the list.
              setHeuristicSummary(summary.filter((row) => row.givenCount > 0));
            }
          }
        }

        const weekBreadcrumbItems: BreadcrumbWeek[] = await Promise.all(
          Array.from({ length: totalWeeks }, async (_, i): Promise<BreadcrumbWeek> => {
            const order = i + 1;
            const w = weekByOrder.get(order);
            if (!w) {
              // Not yet generated — show as an empty future dot.
              return { weekInstanceId: `future-week-${order}`, emojiRating: null, isCurrent: false };
            }
            const endedEarly = w.endedEarly === true;
            const isCurrent = w.id === weekInstanceId;
            if (isCurrent) {
              return { weekInstanceId: w.id, emojiRating: metrics ? metrics.emojiRating : null, isCurrent: true, endedEarly };
            }
            if (w.status !== "completed") {
              return { weekInstanceId: w.id, emojiRating: null, isCurrent: false, endedEarly };
            }
            try {
              const wSessions = await getSessionInstancesForWeekInstance(w.id);
              const wItems = await getWeekTemplateItemsForWeekTemplate(w.weekTemplateId);
              const wViews: SessionInstanceView[] = (
                await Promise.all(
                  wSessions
                    .filter((s) => s.status === "completed")
                    .map((s) => getSessionInstanceView(s.id))
                )
              ).filter((sv): sv is SessionInstanceView => sv != null);
              const wMetrics = computeWeekMetrics(w, wItems, wViews);
              return { weekInstanceId: w.id, emojiRating: wMetrics.emojiRating, isCurrent: false, endedEarly };
            } catch {
              return { weekInstanceId: w.id, emojiRating: null, isCurrent: false, endedEarly };
            }
          })
        );
        setWeeksBreadcrumb(weekBreadcrumbItems);
        setLoadProgress(100);
      } catch (err) {
        console.error("Failed to load week summary:", err);
        setErrorMessage("Could not load week summary.");
      } finally {
        setIsLoading(false);
      }
    }

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekInstanceId]);

  // Patch the current week into weeksBreadcrumb once metrics are ready.
  const weeksBreadcrumbWithCurrent = useMemo<BreadcrumbWeek[]>(() => {
    if (!metrics) return weeksBreadcrumb;
    return weeksBreadcrumb.map((w) =>
      w.isCurrent ? { ...w, emojiRating: metrics.emojiRating } : w
    );
  }, [weeksBreadcrumb, metrics]);

  const weekDaySquares = useMemo<DaySquare[] | null>(() => {
    if (!weekStartIso || weekTemplateDays.length === 0) return null;
    const today = localDateIso();
    const weekStartMs = toLocalMidnight(weekStartIso).getTime();
    const sorted = [...weekTemplateDays].sort((a, b) => a.order - b.order);
    return sorted.map((templateItem, index): DaySquare => {
      const scheduledDate = localDateIso(new Date(weekStartMs + index * 86400000));
      if (templateItem.type === "rest") {
        return { type: "rest", scheduledDate, status: scheduledDate < today ? "rest-past" : "rest-future" };
      }
      const wiiItem = weekInstanceItems.find(i => i.weekTemplateItemId === templateItem.id);
      if (!wiiItem?.sessionInstanceId) {
        return { type: "session", scheduledDate, status: scheduledDate < today ? "overdue" : "grey" };
      }
      const session = sessionInfoMap.get(wiiItem.sessionInstanceId);
      if (!session) return { type: "session", scheduledDate, status: "grey" };
      if (session.status === "skipped") {
        return { type: "session", scheduledDate, status: "skipped" };
      }
      if (session.status !== "completed") {
        return { type: "session", scheduledDate, status: scheduledDate < today ? "overdue" : "grey" };
      }
      return { type: "session", scheduledDate, status: "green" };
    });
  }, [weekStartIso, weekTemplateDays, weekInstanceItems, sessionInfoMap]);

  if (!isLoading && (errorMessage || !metrics)) {
    return (
      <main className="week-summary-page">
        <TopBar title="Week summary" backTo="/" backLabel="Dashboard" />
        <section className="week-summary-shell">
          <p className="week-summary-error">{errorMessage ?? "Something went wrong."}</p>
        </section>
        <BottomNav activeTab="session" />
      </main>
    );
  }

  return (
    <main className="week-summary-page">
      <TopBar
        title="Week summary"
        backTo="/"
        backLabel="Dashboard"
      />

      <section className="week-summary-shell">
        {isLoading ? (
          <>
            <div className="page-spinner" />
            <div className="page-load-bar">
              <div className="page-load-bar__fill" style={{ width: `${loadProgress}%` }} />
            </div>
          </>
        ) : (() => {
          const { totalSets, totalSessions, durationLabel, volumeScore, intensityScore, consistencyScore, weekScore, emojiRating } = metrics!;
          return (<>
        {/* ── Week name ── */}
        <header className="week-summary-header">
          <h1 className="week-summary-title">{weekName}</h1>
          {weekEndedEarly && (
            <p className="week-summary-eyebrow week-summary-eyebrow--ended-early">
              Ended early
            </p>
          )}
        </header>

        {/* ── Descriptive stats ── */}
        <div className="week-summary-stats-row">
          {durationLabel && (
            <>
              <div className="week-summary-stat">
                <span className="week-summary-stat__value">{durationLabel}</span>
                <span className="week-summary-stat__label">Duration</span>
              </div>
              <div className="week-summary-stat-divider" />
            </>
          )}
          <div className="week-summary-stat">
            <span className="week-summary-stat__value">{totalSessions}</span>
            <span className="week-summary-stat__label">Sessions</span>
          </div>
          <div className="week-summary-stat-divider" />
          <div className="week-summary-stat">
            <span className="week-summary-stat__value">{totalSets}</span>
            <span className="week-summary-stat__label">Total sets</span>
          </div>
        </div>

        {/* ── Results ── */}
        <section className="week-summary-section">
          <h2 className="week-summary-section-title">Results</h2>

          <p className="week-summary-narrative">{buildWeekNarrative(metrics!)}</p>

          <div className="week-summary-score-block">
            {/* Left: big emoji + week score */}
            <div className="week-summary-score-primary">
              <span className="week-summary-emoji" aria-label={`Week score ${weekScore}`}>
                {emojiForRating(emojiRating)}
              </span>
              <div className="week-summary-score-center">
                <span className="week-summary-score-total">{weekScore}</span>
                <span className="week-summary-score-label">Week score</span>
              </div>
            </div>

            <div className="week-summary-score-divider" />

            {/* Right: volume, intensity, consistency */}
            <div className="week-summary-score-secondary">
              <div className="week-summary-score-item">
                <span className="week-summary-score-item__pct">{volumeScore}%</span>
                <span className="week-summary-score-item__label">Volume</span>
              </div>
              <div className="week-summary-score-item">
                <span className="week-summary-score-item__pct">{intensityScore}%</span>
                <span className="week-summary-score-item__label">Intensity</span>
              </div>
              <div className="week-summary-score-item">
                <span className="week-summary-score-item__pct">{consistencyScore}%</span>
                <span className="week-summary-score-item__label">Consistency</span>
              </div>
            </div>
          </div>

          <p className="week-summary-score-footnote">
            Score = average of volume, intensity and consistency (each out of 100)
          </p>
        </section>

        {/* ── Schedule counts ── */}
        {weekDaySquares && weekDaySquares.length > 0 && (() => {
          const countItems = [
            { label: "Done",      color: "#6bcb77", n: weekDaySquares.filter(d => d.status === "green").length },
            { label: "Skipped",   color: "#e63946", n: weekDaySquares.filter(d => d.status === "skipped").length },
            { label: "Missed",    color: "#f4a261", n: weekDaySquares.filter(d => d.status === "overdue").length },
            { label: "Upcoming",  color: null,      n: weekDaySquares.filter(d => d.status === "grey").length },
            { label: "Rest",      color: null,      n: weekDaySquares.filter(d => d.type === "rest").length },
            { label: "Extra rest", color: null,     n: extraRestDays },
          ].filter(i => i.n > 0);

          if (countItems.length === 0) return null;

          // Split into 1 or 2 rows: ≤3 items → one row; 4–6 → two balanced rows
          const rows: typeof countItems[] = countItems.length <= 3
            ? [countItems]
            : [countItems.slice(0, Math.ceil(countItems.length / 2)), countItems.slice(Math.ceil(countItems.length / 2))];

          return (
            <div className="week-summary-stats-rows">
              {rows.map((row, ri) => (
                <div key={ri} className="week-summary-stats-row">
                  {row.map((item, i) => (
                    <div key={item.label} style={{ display: "contents" }}>
                      {i > 0 && <div className="week-summary-stat-divider" />}
                      <div className="week-summary-stat">
                        <span
                          className="week-summary-stat__value"
                          style={item.color ? { color: item.color } : undefined}
                        >{item.n}</span>
                        <span className="week-summary-stat__label">{item.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          );
        })()}

        {/* ── Sessions this week ── */}
        {sessionBreadcrumb.length > 0 && (
          <section className="week-summary-section week-summary-section--breadcrumb">
            <WeeklyBreadcrumb sessions={sessionBreadcrumb} />
          </section>
        )}

        {/* ── Weeks this season ── */}
        {weeksBreadcrumbWithCurrent.length > 1 && (
          <section className="week-summary-section week-summary-section--breadcrumb">
            <WeeksBreadcrumb weeks={weeksBreadcrumbWithCurrent} />
          </section>
        )}

        {/* ── Heuristics ── */}
        {heuristicSummary.length > 0 && (
          <section className="week-summary-section">
            <h2 className="week-summary-section-title">Heuristics</h2>
            <ul className="hs-list">
              {heuristicSummary.map((row) => {
                const avgPct = row.avg != null ? ((row.avg - 1) / 4) * 100 : null;
                const coveragePct =
                  row.totalDays > 0
                    ? Math.round((row.givenCount / row.totalDays) * 100)
                    : 0;
                const valueColor =
                  row.avg != null ? colorForHeuristicScore(row.avg) : undefined;
                const barStyle =
                  row.q1 != null && row.q3 != null
                    ? (() => {
                        const lowPct = ((row.q1 - 1) / 4) * 100;
                        const highPct = ((row.q3 - 1) / 4) * 100;
                        // Fade radius is a fraction of the IQR width, so wider
                        // IQRs get softer transitions and narrow ones stay tight.
                        const fadePct = (highPct - lowPct) * 0.2;
                        return {
                          "--iqr-low": `${lowPct}%`,
                          "--iqr-high": `${highPct}%`,
                          "--iqr-fade": `${fadePct}%`,
                        } as React.CSSProperties;
                      })()
                    : undefined;
                return (
                  <li key={row.questionId} className="hs-row">
                    <div className="hs-row__head">
                      <span className="hs-row__label">{row.label}</span>
                      <span className="hs-row__value" style={valueColor ? { color: valueColor } : undefined}>
                        {row.avg != null ? row.avg.toFixed(1) : "—"}
                      </span>
                    </div>
                    <div className="hs-bar" style={barStyle}>
                      {avgPct != null && (
                        <div
                          className="hs-bar__pin"
                          style={{ left: `${avgPct}%` }}
                        />
                      )}
                    </div>
                    <div className="hs-row__coverage">
                      {coveragePct}% coverage, {row.missingDays} missed
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* ── Personal records ── */}
        {prs.length > 0 && (
          <section className="week-summary-section week-summary-section--pr">
            <h2 className="week-summary-section-title week-summary-section-title--accent">
              Personal records
            </h2>
            <ul className="week-summary-pr-list">
              {prs.map((pr) => {
                const daysSince = pr.previousDate
                  ? (() => {
                      const [y, m, d] = pr.previousDate.split("-").map(Number);
                      const prevLocal = new Date(y, m - 1, d).getTime();
                      const today = new Date();
                      const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
                      return Math.round((todayLocal - prevLocal) / 86400000);
                    })()
                  : null;
                return (
                  <li key={pr.exerciseName} className="week-summary-pr-item">
                    <span className="week-summary-pr-name">{pr.exerciseName}</span>
                    {pr.prType === "reps" ? (
                      <span className="week-summary-pr-detail">
                        {pr.previousReps != null && <>{pr.previousReps} reps <span className="week-summary-pr-arrow">→</span> </>}
                        <span className="week-summary-pr-new-value">{pr.newReps} reps</span>
                        {daysSince != null && <> from {daysSince}d ago</>}
                      </span>
                    ) : pr.previousE1RM != null && pr.newE1RM != null ? (
                      <span className="week-summary-pr-detail">
                        {Math.round(pr.previousE1RM * 100) / 100}kg{" "}
                        <span className="week-summary-pr-arrow">→</span>{" "}
                        <span className="week-summary-pr-new-value">{Math.round(pr.newE1RM * 100) / 100}kg</span>{" "}
                        e1RM
                        {<> (+{Math.round((pr.newE1RM / pr.previousE1RM - 1) * 100)}%)</>}
                        <>, up {Math.round((pr.newE1RM - pr.previousE1RM) * 100) / 100}kg
                        {daysSince != null && <> from {daysSince}d ago</>}
                        </>
                      </span>
                    ) : pr.newE1RM != null ? (
                      <span className="week-summary-pr-detail">
                        <span className="week-summary-pr-new-value">{Math.round(pr.newE1RM * 100) / 100}kg</span>{" "}
                        e1RM
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* ── Season summary CTA ── */}
        {seasonInstance && (
          <button
            className="week-summary-season-cta"
            onClick={() => navigate(`/season/${seasonInstance.id}/summary`)}
          >
            View season summary →
          </button>
        )}
        </>);
        })()}
      </section>

      <BottomNav activeTab="session" />
    </main>
  );
}
