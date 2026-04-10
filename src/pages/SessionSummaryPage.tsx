import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { SessionInstanceView, SessionPR } from "../repositories/programRepository";
import {
  getSessionInstanceView,
  getSessionInstancesForWeekInstance,
  getSessionPRs,
} from "../repositories/programRepository";
import {
  computeSessionMetrics,
  formatDuration,
} from "../services/sessionMetrics";
import TrafficLight from "../components/TrafficLight";
import WeeklyBreadcrumb from "../components/WeeklyBreadcrumb";
import type { BreadcrumbSession } from "../components/WeeklyBreadcrumb";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import "./SessionSummaryPage.css";


function buildNarrative(metrics: ReturnType<typeof computeSessionMetrics>): string | null {
  const { workingSetsTarget, intensityTarget, volumeScore, intensityScore } = metrics;

  if (workingSetsTarget === 0) return null;

  const volumeStatus = volumeScore >= 100 ? "green" : volumeScore >= 90 ? "amber" : "red";
  const volumePhrase =
    volumeStatus === "green"
      ? "logged enough sets to meet your volume target"
      : volumeStatus === "amber"
        ? "almost logged enough sets to meet your volume target"
        : "didn't log enough sets to meet your volume target";

  if (intensityTarget === 0) {
    return `You ${volumePhrase}.`;
  }

  const intensityStatus = intensityScore >= 100 ? "green" : intensityScore >= 90 ? "amber" : "red";
  const intensityPhrase =
    intensityStatus === "green"
      ? "lifted enough weight to hit your intensity target"
      : intensityStatus === "amber"
        ? "almost lifted enough weight to hit your intensity target"
        : "didn't lift enough weight to hit your intensity target";

  // Both failed: restructure to avoid repeating "didn't"
  if (volumeStatus === "red" && intensityStatus === "red") {
    return "You didn't log enough sets to meet your volume target, or lift enough weight to hit your intensity target.";
  }

  // Both positive (green or amber) → "and"; one positive one negative → "but"
  const volumePositive = volumeStatus !== "red";
  const intensityPositive = intensityStatus !== "red";
  const conjunction = volumePositive === intensityPositive ? "and" : "but";

  return `You ${volumePhrase}, ${conjunction} you ${intensityPhrase}.`;
}

export default function SessionSummaryPage() {
  const { sessionInstanceId } = useParams<{ sessionInstanceId: string }>();
  const navigate = useNavigate();

  const [sessionView, setSessionView] = useState<SessionInstanceView | null>(null);
  const [breadcrumbSessions, setBreadcrumbSessions] = useState<BreadcrumbSession[]>([]);
  const [prs, setPrs] = useState<SessionPR[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!sessionInstanceId) {
        setErrorMessage("No session provided.");
        setIsLoading(false);
        return;
      }

      try {
        const view = await getSessionInstanceView(sessionInstanceId);
        setLoadProgress(30);

        if (!view) {
          setErrorMessage("Session not found.");
          setIsLoading(false);
          return;
        }

        setSessionView(view);

        // Load all sessions in the same week for the breadcrumb.
        const weekSessions = await getSessionInstancesForWeekInstance(
          view.weekInstance.id
        );
        setLoadProgress(55);

        // Compute scores for completed sessions in parallel.
        const breadcrumbItems = await Promise.all(
          weekSessions.map(async (session): Promise<BreadcrumbSession> => {
            const isCurrent = session.id === sessionInstanceId;

            if (session.status !== "completed") {
              return { sessionInstanceId: session.id, ragStatus: null, isCurrent };
            }

            try {
              const sv = isCurrent ? view : await getSessionInstanceView(session.id);
              if (!sv) {
                return { sessionInstanceId: session.id, ragStatus: null, isCurrent };
              }
              const metrics = computeSessionMetrics(sv);
              return {
                sessionInstanceId: session.id,
                ragStatus: metrics.ragStatus,
                isCurrent,
              };
            } catch {
              return { sessionInstanceId: session.id, ragStatus: null, isCurrent };
            }
          })
        );
        setLoadProgress(80);

        setBreadcrumbSessions(breadcrumbItems);
        setPrs(await getSessionPRs(sessionInstanceId));
        setLoadProgress(100);
      } catch (error) {
        console.error("Failed to load session summary:", error);
        setErrorMessage("Could not load session summary.");
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [sessionInstanceId]);

  const metrics = useMemo(
    () => (sessionView ? computeSessionMetrics(sessionView) : null),
    [sessionView]
  );

  if (!isLoading && (errorMessage || !sessionView || !metrics)) {
    return (
      <main className="summary-page">
        <TopBar title="Session summary" backTo="/" backLabel="Dashboard" />
        <section className="summary-shell">
          <p className="summary-error">{errorMessage ?? "Something went wrong."}</p>
        </section>
        <BottomNav activeTab="session" />
      </main>
    );
  }


  return (
    <main className="summary-page">
      <TopBar
        title="Session summary"
        backTo="/"
        backLabel="Dashboard"
      />

      <section className="summary-shell">
        {isLoading ? (
          <>
            <div className="page-spinner" />
            <div className="page-load-bar">
              <div className="page-load-bar__fill" style={{ width: `${loadProgress}%` }} />
            </div>
          </>
        ) : (() => {
          const sv = sessionView!;
          const m = metrics!;
          const { ragStatus, sessionScore, volumeScore, intensityScore, durationSeconds, totalSets } = m;
          const narrative = buildNarrative(m);
          return (<>
        {/* ── Session name ── */}
        <header className="summary-header">
          <h1 className="summary-title">{sv.sessionTemplate.name}</h1>
        </header>

        {/* ── Descriptive stats ── */}
        <div className="summary-stats-row">
          <div className="summary-stat">
            <span className="summary-stat__value">
              {durationSeconds != null
                ? formatDuration(durationSeconds)
                : "—"}
            </span>
            <span className="summary-stat__label">Duration</span>
          </div>
          <div className="summary-stat-divider" />
          <div className="summary-stat">
            <span className="summary-stat__value">{totalSets}</span>
            <span className="summary-stat__label">Total sets</span>
          </div>
        </div>

        {/* ── Results ── */}
        <section className="summary-section">
          <h2 className="summary-section-title">Results</h2>

          {narrative && (
            <p className="summary-narrative">{narrative}</p>
          )}

          <div className="summary-score-block">
            {/* Left: traffic lights + score + label */}
            <div className="summary-score-primary">
              <TrafficLight status={ragStatus} size="lg" showAll />
              <div className="summary-score-center">
                <span className="summary-score-item__pct summary-score-item__pct--total">
                  {sessionScore}
                </span>
                <span className="summary-score-rag-label">Session score</span>
              </div>
            </div>

            <div className="summary-score-divider" />

            {/* Right: volume + intensity */}
            <div className={`summary-score-secondary${volumeScore >= 100 && intensityScore >= 100 ? " summary-score-secondary--stacked" : ""}`}>
              <div className="summary-score-item">
                <span className="summary-score-item__pct">{volumeScore}%</span>
                <span className="summary-score-item__label">Volume</span>
              </div>
              <div className="summary-score-item">
                <span className="summary-score-item__pct">{intensityScore}%</span>
                <span className="summary-score-item__label">Intensity</span>
              </div>
            </div>
          </div>

          <p className="summary-score-footnote">
            Score = average of volume and intensity (each out of 100)
          </p>
        </section>

        {/* ── Weekly breadcrumb ── */}
        {breadcrumbSessions.length > 1 && (
          <section className="summary-section summary-section--breadcrumb">
            <WeeklyBreadcrumb sessions={breadcrumbSessions} />
          </section>
        )}

        {/* ── Personal records ── */}
        {prs.length > 0 && (
          <section className="summary-section summary-section--pr">
            <h2 className="summary-section-title summary-section-title--accent">Personal records</h2>
            <ul className="summary-pr-list">
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
                  <li key={pr.exerciseName} className="summary-pr-item">
                    <span className="summary-pr-name">{pr.exerciseName}</span>
                    {pr.prType === "reps" ? (
                      <span className="summary-pr-detail">
                        {pr.previousReps != null && <>{pr.previousReps} reps <span className="summary-pr-arrow">→</span> </>}
                        <span className="summary-pr-new-value">{pr.newReps} reps</span>
                        {daysSince != null && <> from {daysSince}d ago</>}
                      </span>
                    ) : pr.previousE1RM != null && pr.newE1RM != null ? (
                      <span className="summary-pr-detail">
                        {Math.round(pr.previousE1RM * 100) / 100}kg{" "}
                        <span className="summary-pr-arrow">→</span>{" "}
                        <span className="summary-pr-new-value">{Math.round(pr.newE1RM * 100) / 100}kg</span> e1RM
                        {<> (+{Math.round((pr.newE1RM / pr.previousE1RM - 1) * 100)}%)</>}
                        <>, up {Math.round((pr.newE1RM - pr.previousE1RM) * 100) / 100}kg
                        {daysSince != null && <> from {daysSince}d ago</>}
                        </>
                      </span>
                    ) : pr.newE1RM != null ? (
                      <span className="summary-pr-detail">
                        <span className="summary-pr-new-value">{Math.round(pr.newE1RM * 100) / 100}kg</span> e1RM
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* ── Week summary CTA (shown when this was the last session in the week) ── */}
        {sv.weekInstance.status === "completed" && (
          <button
            className="summary-week-cta"
            onClick={() => navigate(`/week/${sv.weekInstance.id}/summary`)}
          >
            View week summary →
          </button>
        )}
        </>);
        })()}
      </section>

      <BottomNav activeTab="session" />
    </main>
  );
}
