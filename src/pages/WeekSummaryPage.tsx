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
import { computeSessionMetrics } from "../services/sessionMetrics";
import { computeWeekMetrics, emojiForRating } from "../services/weekMetrics";
import { type MovementTone, PALETTE, buildGroupToneMap } from "../services/movementTones";
import type { WeekMetrics } from "../services/weekMetrics";
import WeeklyBreadcrumb from "../components/WeeklyBreadcrumb";
import type { BreadcrumbSession } from "../components/WeeklyBreadcrumb";
import WeeksBreadcrumb from "../components/WeeksBreadcrumb";
import type { BreadcrumbWeek } from "../components/WeeksBreadcrumb";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import "./WeekSummaryPage.css";

function buildWeekNarrative(metrics: WeekMetrics): string {
  const { volumeScore, intensityScore, skippedSessions } = metrics;

  const volStatus = volumeScore >= 100 ? "green" : volumeScore >= 90 ? "amber" : "red";
  const intStatus = intensityScore >= 100 ? "green" : intensityScore >= 90 ? "amber" : "red";

  const volPhrase =
    volStatus === "green" ? "logged enough sets to meet your volume target"
    : volStatus === "amber" ? "almost logged enough sets to meet your volume target"
    : "didn't log enough sets to meet your volume target";

  const intPhrase =
    intStatus === "green" ? "lifted enough weight to hit your intensity target"
    : intStatus === "amber" ? "almost lifted enough weight to hit your intensity target"
    : "didn't lift enough weight to hit your intensity target";

  const conPhrase = skippedSessions === 0
    ? "stayed consistent with your schedule"
    : "did not stay consistent with your schedule";

  const items = [
    { positive: volStatus !== "red", phrase: volPhrase },
    { positive: intStatus !== "red", phrase: intPhrase },
    { positive: skippedSessions === 0, phrase: conPhrase },
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

type DaySquareStatus = "green" | "amber" | "late" | "overdue" | "grey" | "rest-past" | "rest-future";
interface DaySquare { type: "session" | "rest"; scheduledDate: string; status: DaySquareStatus; }

function localDateIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toLocalMidnight(iso: string): Date {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export default function WeekSummaryPage() {
  const { weekInstanceId } = useParams<{ weekInstanceId: string }>();
  const [weekName, setWeekName] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ReturnType<typeof computeWeekMetrics> | null>(null);
  const [sessionBreadcrumb, setSessionBreadcrumb] = useState<BreadcrumbSession[]>([]);
  const [weeksBreadcrumb, setWeeksBreadcrumb] = useState<BreadcrumbWeek[]>([]);
  const [prs, setPrs] = useState<SessionPR[]>([]);
  const [weekTemplateDays, setWeekTemplateDays] = useState<WeekTemplateItem[]>([]);
  const [weekInstanceItems, setWeekInstanceItems] = useState<WeekInstanceItem[]>([]);
  const [, setCompletedSessionIds] = useState<Set<string>>(new Set());
  const [seasonInstance, setSeasonInstance] = useState<SeasonInstance | null>(null);
  const [movementTypeSummary, setMovementTypeSummary] = useState<Array<{ name: string; count: number; tone: MovementTone }>>([]);
  const [weekStartIso, setWeekStartIso] = useState<string | null>(null);
  const [sessionInfoMap, setSessionInfoMap] = useState<Map<string, { date: string; status: string; completedAt: string | null }>>(new Map());
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

        // Load session views for all completed sessions.
        const completedSessions = sessions.filter((s) => s.status === "completed");
        const sessionViews: SessionInstanceView[] = (
          await Promise.all(
            completedSessions.map((s) => getSessionInstanceView(s.id))
          )
        ).filter((sv): sv is SessionInstanceView => sv != null);
        setLoadProgress(55);

        setMetrics(computeWeekMetrics(weekInstance, templateItems, sessionViews));

        const allExercises = sessionViews.flatMap((sv) =>
          sv.muscleGroups.flatMap((g) =>
            g.exercises.filter((e) => e.workingSetCount > 0)
          )
        );
        const toneMap = buildGroupToneMap(allExercises);
        const countMap = new Map<string, number>();
        for (const ex of allExercises) {
          countMap.set(ex.movementType.name, (countMap.get(ex.movementType.name) ?? 0) + 1);
        }
        setMovementTypeSummary(
          [...countMap.entries()]
            .map(([name, count]) => ({ name, count, tone: toneMap.get(name) ?? PALETTE[0] }))
            .sort((a, b) => b.count - a.count)
        );
        const weekRir =
          seasonTemplateForRir?.rirSequence?.[weekInstance.order - 1] ??
          weekTemplate?.targetRir;
        setWeekName(
          weekRir != null
            ? `Week ${weekInstance.order}, ${weekRir} RIR`
            : `Week ${weekInstance.order}`
        );
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

        // Weeks this season breadcrumb.
        const allWeeks = await getWeekInstancesForSeasonInstance(
          weekInstance.seasonInstanceId
        );

        const weekBreadcrumbItems: BreadcrumbWeek[] = await Promise.all(
          allWeeks.map(async (w): Promise<BreadcrumbWeek> => {
            const isCurrent = w.id === weekInstanceId;
            if (isCurrent) {
              return { weekInstanceId: w.id, emojiRating: metrics ? metrics.emojiRating : null, isCurrent: true };
            }
            if (w.status !== "completed") {
              return { weekInstanceId: w.id, emojiRating: null, isCurrent: false };
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
              return { weekInstanceId: w.id, emojiRating: wMetrics.emojiRating, isCurrent: false };
            } catch {
              return { weekInstanceId: w.id, emojiRating: null, isCurrent: false };
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
      if (session.status !== "completed") {
        return { type: "session", scheduledDate, status: scheduledDate < today ? "overdue" : "grey" };
      }
      const completedDate = session.completedAt ? localDateIso(toLocalMidnight(session.completedAt)) : scheduledDate;
      const status: DaySquareStatus = completedDate < scheduledDate ? "amber" : completedDate > scheduledDate ? "late" : "green";
      return { type: "session", scheduledDate, status };
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
            { label: "On time",   color: "#6bcb77", n: weekDaySquares.filter(d => d.status === "green").length },
            { label: "Done early", color: "#f4a261", n: weekDaySquares.filter(d => d.status === "amber").length },
            { label: "Done late", color: "#e76f51", n: weekDaySquares.filter(d => d.status === "late").length },
            { label: "Missed",    color: "#9b2335", n: weekDaySquares.filter(d => d.status === "overdue").length },
            { label: "Upcoming",  color: null,      n: weekDaySquares.filter(d => d.status === "grey").length },
            { label: "Rest",      color: null,      n: weekDaySquares.filter(d => d.type === "rest").length },
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

        {/* ── Movement type breakdown ── */}
        {movementTypeSummary.length > 0 && (
          <section className="week-summary-section">
            <h2 className="week-summary-section-title">Movement breakdown</h2>
            <div className="week-mt-pills">
              {movementTypeSummary.map(({ name, count, tone }) => (
                <span
                  key={name}
                  className="week-mt-pill"
                  style={{ backgroundColor: tone.bg, color: tone.text, borderColor: tone.border }}
                >
                  {name}
                  <span className="week-mt-pill__count">{count}</span>
                </span>
              ))}
            </div>
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
