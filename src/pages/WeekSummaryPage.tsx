import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
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
} from "../repositories/programRepository";
import type { WeekTemplateItem, WeekInstanceItem } from "../domain/models";
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

  const conPhrase =
    skippedSessions === 0 ? "didn't skip any days"
    : skippedSessions === 1 ? "skipped 1 day"
    : `skipped ${skippedSessions} days`;

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

export default function WeekSummaryPage() {
  const { weekInstanceId } = useParams<{ weekInstanceId: string }>();
  const [weekName, setWeekName] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ReturnType<typeof computeWeekMetrics> | null>(null);
  const [sessionBreadcrumb, setSessionBreadcrumb] = useState<BreadcrumbSession[]>([]);
  const [weeksBreadcrumb, setWeeksBreadcrumb] = useState<BreadcrumbWeek[]>([]);
  const [prs, setPrs] = useState<SessionPR[]>([]);
  const [weekTemplateDays, setWeekTemplateDays] = useState<WeekTemplateItem[]>([]);
  const [weekInstanceItems, setWeekInstanceItems] = useState<WeekInstanceItem[]>([]);
  const [completedSessionIds, setCompletedSessionIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

        if (!weekInstance) {
          setErrorMessage("Week not found.");
          setIsLoading(false);
          return;
        }

        const [weekTemplate, sessions, wii] = await Promise.all([
          getWeekTemplateById(weekInstance.weekTemplateId),
          getSessionInstancesForWeekInstance(weekInstanceId),
          getWeekInstanceItemsForWeekInstance(weekInstanceId),
        ]);

        const templateItems = await getWeekTemplateItemsForWeekTemplate(
          weekInstance.weekTemplateId
        );

        // Load session views for all completed sessions.
        const completedSessions = sessions.filter((s) => s.status === "completed");
        const sessionViews: SessionInstanceView[] = (
          await Promise.all(
            completedSessions.map((s) => getSessionInstanceView(s.id))
          )
        ).filter((sv): sv is SessionInstanceView => sv != null);

        setMetrics(computeWeekMetrics(weekInstance, templateItems, sessionViews));
        setWeekName(weekTemplate?.name ?? "Week summary");
        setPrs(weekPRs);
        setWeekTemplateDays(templateItems);
        setWeekInstanceItems(wii);
        setCompletedSessionIds(new Set(sessions.filter(s => s.status === "completed").map(s => s.id)));

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

  if (isLoading) {
    return (
      <main className="week-summary-page">
        <TopBar title="Week summary" backTo="/week" backLabel="Back to week" />
        <section className="week-summary-shell">
          <p className="week-summary-loading">Loading summary...</p>
        </section>
        <BottomNav activeTab="session" />
      </main>
    );
  }

  if (errorMessage || !metrics) {
    return (
      <main className="week-summary-page">
        <TopBar title="Week summary" backTo="/week" backLabel="Back to week" />
        <section className="week-summary-shell">
          <p className="week-summary-error">{errorMessage ?? "Something went wrong."}</p>
        </section>
        <BottomNav activeTab="session" />
      </main>
    );
  }

  const { totalSets, totalSessions, durationLabel, volumeScore, intensityScore, consistencyScore, weekScore, emojiRating } = metrics;

  // Build lookup maps for the consistency visual.
  const wiiByTemplateItemId = new Map(weekInstanceItems.map(i => [i.weekTemplateItemId, i]));

  return (
    <main className="week-summary-page">
      <TopBar
        title="Week summary"
        backTo="/week"
        backLabel="Back to week"
      />

      <section className="week-summary-shell">
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

          <p className="week-summary-narrative">{buildWeekNarrative(metrics)}</p>

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

        {/* ── Consistency visual ── */}
        {weekTemplateDays.length > 0 && (
          <section className="week-summary-section">
            <h2 className="week-summary-section-title">Schedule</h2>
            <div className="consistency-visual">
              <div className="consistency-row">
                <span className="consistency-row__label">Planned</span>
                <div className="consistency-circles">
                  {weekTemplateDays.map((item) => (
                    <div
                      key={item.id}
                      className={`consistency-circle ${item.type === "session" ? "consistency-circle--gym" : "consistency-circle--rest"}`}
                    />
                  ))}
                </div>
              </div>
              <div className="consistency-row">
                <span className="consistency-row__label">Actual</span>
                <div className="consistency-circles">
                  {weekTemplateDays.map((item) => {
                    if (item.type === "rest") {
                      return <div key={item.id} className="consistency-circle consistency-circle--rest" />;
                    }
                    const wii = wiiByTemplateItemId.get(item.id);
                    const sessionId = wii?.sessionInstanceId;
                    // A session is completed if its instance exists and has completed status.
                    // We rely on the breadcrumb sessions list to check status.
                    const completed = sessionId != null && completedSessionIds.has(sessionId);
                    return (
                      <div
                        key={item.id}
                        className={`consistency-circle ${completed ? "consistency-circle--gym" : "consistency-circle--missed"}`}
                      >
                        {!completed && <span className="consistency-circle__x">×</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        )}

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
                      const todayLocal = new Date(
                        today.getFullYear(),
                        today.getMonth(),
                        today.getDate()
                      ).getTime();
                      return Math.round((todayLocal - prevLocal) / 86400000);
                    })()
                  : null;
                const pctGain =
                  pr.previousE1RM != null
                    ? Math.round((pr.newE1RM / pr.previousE1RM - 1) * 100)
                    : null;
                const kgGain =
                  pr.previousE1RM != null
                    ? Math.round((pr.newE1RM - pr.previousE1RM) * 100) / 100
                    : null;
                return (
                  <li key={pr.exerciseName} className="week-summary-pr-item">
                    <span className="week-summary-pr-name">{pr.exerciseName}</span>
                    {pr.previousE1RM != null ? (
                      <span className="week-summary-pr-detail">
                        {Math.round(pr.previousE1RM * 100) / 100}kg{" "}
                        <span className="week-summary-pr-arrow">→</span>{" "}
                        <span className="week-summary-pr-new-value">
                          {Math.round(pr.newE1RM * 100) / 100}kg
                        </span>{" "}
                        e1RM
                        {pctGain != null && <> (+{pctGain}%)</>}
                        {kgGain != null && (
                          <>
                            , up {kgGain}kg
                            {daysSince != null && <> from {daysSince}d ago</>}
                          </>
                        )}
                      </span>
                    ) : (
                      <span className="week-summary-pr-detail">
                        <span className="week-summary-pr-new-value">
                          {Math.round(pr.newE1RM * 100) / 100}kg
                        </span>{" "}
                        e1RM
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

      </section>

      <BottomNav activeTab="session" />
    </main>
  );
}
