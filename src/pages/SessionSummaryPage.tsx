import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { SessionInstanceView } from "../repositories/programRepository";
import {
  getSessionInstanceView,
  getSessionInstancesForWeekInstance,
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

function MetricBar({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="summary-metric-bar">
      <div className="summary-metric-bar__row">
        <span className="summary-metric-bar__label">{label}</span>
        <span className="summary-metric-bar__value">
          {value} / {total}
          <span className="summary-metric-bar__pct"> — {pct}%</span>
        </span>
      </div>
      <div className="summary-metric-bar__track">
        <span
          className="summary-metric-bar__fill"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function SessionSummaryPage() {
  const { sessionInstanceId } = useParams<{ sessionInstanceId: string }>();
  const navigate = useNavigate();

  const [sessionView, setSessionView] = useState<SessionInstanceView | null>(null);
  const [breadcrumbSessions, setBreadcrumbSessions] = useState<BreadcrumbSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

        setBreadcrumbSessions(breadcrumbItems);
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

  if (isLoading) {
    return (
      <main className="summary-page">
        <TopBar title="Session summary" backTo="/week" backLabel="Back to week" />
        <section className="summary-shell">
          <p className="summary-loading">Loading summary...</p>
        </section>
        <BottomNav activeTab="session" />
      </main>
    );
  }

  if (errorMessage || !sessionView || !metrics) {
    return (
      <main className="summary-page">
        <TopBar title="Session summary" backTo="/week" backLabel="Back to week" />
        <section className="summary-shell">
          <p className="summary-error">{errorMessage ?? "Something went wrong."}</p>
        </section>
        <BottomNav activeTab="session" />
      </main>
    );
  }

  const { ragStatus, sessionScore, volumeScore, intensityScore } = metrics;

  return (
    <main className="summary-page">
      <TopBar
        title="Session summary"
        backTo={`/session/${sessionInstanceId}`}
        backLabel="Back to session"
      />

      <section className="summary-shell">
        {/* ── Session name ── */}
        <header className="summary-header">
          <h1 className="summary-title">{sessionView.sessionTemplate.name}</h1>
        </header>

        {/* ── Descriptive stats ── */}
        <div className="summary-stats-row">
          <div className="summary-stat">
            <span className="summary-stat__value">
              {metrics.durationSeconds != null
                ? formatDuration(metrics.durationSeconds)
                : "—"}
            </span>
            <span className="summary-stat__label">Duration</span>
          </div>
          <div className="summary-stat-divider" />
          <div className="summary-stat">
            <span className="summary-stat__value">{metrics.totalSets}</span>
            <span className="summary-stat__label">Total sets</span>
          </div>
        </div>

        {/* ── Results ── */}
        <section className="summary-section">
          <h2 className="summary-section-title">Results</h2>

          <div className="summary-metrics">
            <MetricBar
              label="Volume"
              value={metrics.workingSetsCompleted}
              total={metrics.workingSetsTarget}
            />
            <MetricBar
              label="Intensity"
              value={metrics.setsMetIntensity}
              total={metrics.intensityTarget}
            />
          </div>

          <div className="summary-score-block">
            <div className="summary-score-scores">
              <div className="summary-score-item">
                <span className="summary-score-item__pct">{volumeScore}%</span>
                <span className="summary-score-item__label">Volume</span>
              </div>
              <div className="summary-score-item summary-score-item--total">
                <div className="summary-score-item__rag">
                  <TrafficLight status={ragStatus} size="lg" />
                </div>
                <span className="summary-score-item__pct summary-score-item__pct--total">
                  {sessionScore}
                </span>
                <span className="summary-score-item__label">Score</span>
              </div>
              <div className="summary-score-item">
                <span className="summary-score-item__pct">{intensityScore}%</span>
                <span className="summary-score-item__label">Intensity</span>
              </div>
            </div>

            <p className="summary-score-footnote">
              Score = average of volume and intensity (each out of 100)
            </p>
          </div>
        </section>

        {/* ── Weekly breadcrumb ── */}
        {breadcrumbSessions.length > 1 && (
          <section className="summary-section summary-section--breadcrumb">
            <WeeklyBreadcrumb sessions={breadcrumbSessions} />
          </section>
        )}

        {/* ── Actions ── */}
        <div className="summary-actions">
          <button
            type="button"
            className="summary-action-button summary-action-button--primary"
            onClick={() => navigate("/week")}
          >
            Back to week
          </button>
        </div>
      </section>

      <BottomNav activeTab="session" />
    </main>
  );
}
