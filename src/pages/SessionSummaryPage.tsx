import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { SessionInstanceView, SessionPR } from "../repositories/programRepository";
import {
  getSessionInstanceView,
  getSessionInstancesForWeekInstance,
  getSessionMetrics,
  getSessionPRs,
  getSessionDuration,
} from "../repositories/programRepository";
import {
  computeSessionMetrics,
  formatDuration,
} from "../services/sessionMetrics";
import SessionGradeHero from "../components/SessionGradeHero";
import WeeklyBreadcrumb from "../components/WeeklyBreadcrumb";
import type { BreadcrumbSession } from "../components/WeeklyBreadcrumb";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import PageLoader from "../components/PageLoader";
import useInView from "../hooks/useInView";
import "../styles/summary.css";

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

/** A page section that staggers its children in as it scrolls into view. */
function RevealSection({
  title,
  className,
  children,
}: {
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [ref, inView] = useInView<HTMLElement>();
  return (
    <section
      ref={ref}
      className={`sum-section${inView ? " is-in" : ""}${className ? ` ${className}` : ""}`}
    >
      {title && <h2 className="sum-section__title sum-reveal">{title}</h2>}
      {children}
    </section>
  );
}

export default function SessionSummaryPage() {
  const { sessionInstanceId } = useParams<{ sessionInstanceId: string }>();
  const navigate = useNavigate();

  const [sessionView, setSessionView] = useState<SessionInstanceView | null>(null);
  const [sessionDuration, setSessionDuration] = useState<number | null>(null);
  const [breadcrumbSessions, setBreadcrumbSessions] = useState<BreadcrumbSession[]>([]);
  const [prs, setPrs] = useState<SessionPR[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loaderDone, setLoaderDone] = useState(false);
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
        setSessionDuration(await getSessionDuration(view.sessionInstance));

        // Load all sessions in the same week for the breadcrumb.
        const weekSessions = await getSessionInstancesForWeekInstance(
          view.weekInstance.id
        );

        // Compute scores for completed sessions in parallel.
        const breadcrumbItems = await Promise.all(
          weekSessions.map(async (session): Promise<BreadcrumbSession> => {
            const isCurrent = session.id === sessionInstanceId;

            if (session.status === "skipped") {
              return { sessionInstanceId: session.id, ragStatus: "skipped", isCurrent };
            }

            if (session.status !== "completed") {
              return { sessionInstanceId: session.id, ragStatus: null, isCurrent };
            }

            try {
              // Reuse the already-built view for the current session; siblings
              // read their frozen metrics (or backfill) without rebuilding.
              const metrics = isCurrent
                ? (view.sessionInstance.frozenMetrics ?? computeSessionMetrics(view))
                : await getSessionMetrics(session);
              if (!metrics) {
                return { sessionInstanceId: session.id, ragStatus: null, isCurrent };
              }
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
        setPrs(await getSessionPRs(sessionInstanceId));
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
    () =>
      sessionView
        ? (sessionView.sessionInstance.frozenMetrics ?? computeSessionMetrics(sessionView))
        : null,
    [sessionView]
  );

  // One line at label size, the same collapse the week report uses. Any part
  // that can't be resolved drops out rather than showing a placeholder, and the
  // session's position goes with it when the week holds only one.
  const eyebrowParts = useMemo<React.ReactNode[]>(() => {
    if (!sessionView) return [];
    const position = breadcrumbSessions.findIndex((s) => s.isCurrent);
    return [
      `Week ${sessionView.weekInstance.order}`,
      position >= 0 && breadcrumbSessions.length > 1
        ? `Session ${position + 1} of ${breadcrumbSessions.length}`
        : null,
      `${sessionView.effectiveRir} RIR`,
      // Exempt from the line's uppercasing: "48m" would otherwise read "48M".
      sessionDuration != null ? (
        <span className="sum-eyebrow__lower">{formatDuration(sessionDuration)}</span>
      ) : null,
    ].filter(Boolean);
  }, [sessionView, breadcrumbSessions, sessionDuration]);

  if (!isLoading && (errorMessage || !sessionView || !metrics)) {
    return (
      <main className="summary-page">
        <TopBar title="Session summary" backTo="/" backLabel="Dashboard" />
        <section className="sum-shell">
          <p className="sum-error">{errorMessage ?? "Something went wrong."}</p>
        </section>
        <BottomNav activeTab="session" />
      </main>
    );
  }

  return (
    <main className="summary-page">
      <TopBar title="Session summary" backTo="/" backLabel="Dashboard" />

      <section className="sum-shell">
        {!loaderDone ? (
          <PageLoader
            label="Building your session summary…"
            durationMs={1000}
            ready={!isLoading}
            onDone={() => setLoaderDone(true)}
          />
        ) : (() => {
          const sv = sessionView!;
          const m = metrics!;
          const { ragStatus, volumeScore, intensityScore } = m;
          const isSkipped = sv.sessionInstance.status === "skipped";
          const narrative = isSkipped
            ? "You skipped this session, so it counts as zero volume and zero intensity."
            : buildNarrative(m);
          return (<>
            {/* ── Eyebrow ── */}
            {eyebrowParts.length > 0 && (
              <p className="sum-eyebrow">
                {eyebrowParts.map((part, i) => (
                  <Fragment key={i}>
                    {i > 0 && " · "}
                    {part}
                  </Fragment>
                ))}
              </p>
            )}

            <SessionGradeHero
              ragStatus={isSkipped ? "skipped" : ragStatus}
              volumeScore={volumeScore}
              intensityScore={intensityScore}
            />

            {/* ── Narrative ── */}
            {narrative && (
              <RevealSection>
                <p className="sum-narrative sum-reveal">{narrative}</p>
              </RevealSection>
            )}

            {/* ── Personal records ── */}
            {prs.length > 0 && (
              <RevealSection title={`Personal records · ${prs.length}`}>
                <ul className="sum-list">
                  {prs.map((pr, i) => {
                    const gainPct =
                      pr.prType !== "reps" && pr.previousE1RM != null && pr.newE1RM != null
                        ? Math.round((pr.newE1RM / pr.previousE1RM - 1) * 100)
                        : null;
                    return (
                      <li
                        key={pr.exerciseName}
                        className="sum-row sum-reveal"
                        style={{ "--i": i } as React.CSSProperties}
                      >
                        <div className="sum-row__head">
                          <span className="sum-row__name">{pr.exerciseName}</span>
                          {gainPct != null && (
                            <span className="sum-chip">+{gainPct}%</span>
                          )}
                        </div>
                        {pr.prType === "reps" ? (
                          <span className="sum-row__detail">
                            {pr.previousReps != null && <>{pr.previousReps} reps <span className="sum-arrow">→</span> </>}
                            <span className="sum-row__value">{pr.newReps} reps</span>
                          </span>
                        ) : pr.previousE1RM != null && pr.newE1RM != null ? (
                          <span className="sum-row__detail">
                            {Math.round(pr.previousE1RM * 100) / 100}kg{" "}
                            <span className="sum-arrow">→</span>{" "}
                            <span className="sum-row__value">{Math.round(pr.newE1RM * 100) / 100}kg</span>{" "}
                            e1RM, up {Math.round((pr.newE1RM - pr.previousE1RM) * 100) / 100}kg
                          </span>
                        ) : pr.newE1RM != null ? (
                          <span className="sum-row__detail">
                            <span className="sum-row__value">{Math.round(pr.newE1RM * 100) / 100}kg</span>{" "}
                            e1RM
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </RevealSection>
            )}

            {/* ── Sessions this week ──
                Unlike the week report's trail, this one keeps its current
                marker: locating yourself among the week's sessions is the whole
                reason it's here. */}
            {breadcrumbSessions.length > 1 && (
              <RevealSection title="Sessions this week" className="sum-breadcrumb">
                <div className="sum-reveal">
                  <WeeklyBreadcrumb sessions={breadcrumbSessions} />
                </div>
              </RevealSection>
            )}

            {/* ── Week summary CTA (shown when this was the last session in the week) ── */}
            {sv.weekInstance.status === "completed" && (
              <RevealSection>
                <button
                  className="sum-cta sum-reveal"
                  onClick={() => navigate(`/week/${sv.weekInstance.id}/summary`)}
                >
                  View week summary →
                </button>
              </RevealSection>
            )}
          </>);
        })()}
      </section>

      <BottomNav activeTab="session" />
    </main>
  );
}
