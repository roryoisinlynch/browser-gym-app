import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { SessionPR } from "../repositories/programRepository";
import {
  getWeekInstanceById,
  getWeekTemplateById,
  getSessionInstancesForWeekInstance,
  getSessionMetrics,
  getWeekInstancesForSeasonInstance,
  getWeekMetrics,
  getWeekPRs,
  getSeasonInstanceById,
  getSeasonTemplateById,
} from "../repositories/programRepository";
import type { SeasonInstance } from "../domain/models";
import {
  isHeuristicsEnabled,
  getQuestions,
  getEntriesForDateRange,
} from "../repositories/heuristicsRepository";
import { colorForHeuristicScore } from "../services/heuristicsScale";
import type { WeekMetrics } from "../services/weekMetrics";
import WeeklyBreadcrumb from "../components/WeeklyBreadcrumb";
import type { BreadcrumbSession } from "../components/WeeklyBreadcrumb";
import WeeksBreadcrumb from "../components/WeeksBreadcrumb";
import type { BreadcrumbWeek } from "../components/WeeksBreadcrumb";
import WeekGradeHero from "../components/WeekGradeHero";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import PageLoader from "../components/PageLoader";
import useInView from "../hooks/useInView";
import "../styles/summary.css";
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
  // Round, not floor: a span crossing a DST boundary is 23 or 25 hours short of
  // a whole number of days, and flooring that lost an entire day — which showed
  // up as heuristic coverage above 100%.
  return Math.round((e - s) / 86_400_000) + 1;
}

interface HeuristicSummaryRow {
  questionId: string;
  label: string;
  avg: number | null;
  givenCount: number;
  totalDays: number;
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

export default function WeekSummaryPage() {
  const { weekInstanceId } = useParams<{ weekInstanceId: string }>();
  const [weekEyebrow, setWeekEyebrow] = useState<string | null>(null);
  const [weekEndedEarly, setWeekEndedEarly] = useState(false);
  const [metrics, setMetrics] = useState<WeekMetrics | null>(null);
  const [sessionBreadcrumb, setSessionBreadcrumb] = useState<BreadcrumbSession[]>([]);
  const [weeksBreadcrumb, setWeeksBreadcrumb] = useState<BreadcrumbWeek[]>([]);
  const [prs, setPrs] = useState<SessionPR[]>([]);
  const [seasonInstance, setSeasonInstance] = useState<SeasonInstance | null>(null);
  const [heuristicSummary, setHeuristicSummary] = useState<HeuristicSummaryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loaderDone, setLoaderDone] = useState(false);
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

        if (!weekInstance) {
          setErrorMessage("Week not found.");
          setIsLoading(false);
          return;
        }

        const seasonInstanceForRir = await getSeasonInstanceById(weekInstance.seasonInstanceId);
        const [weekTemplate, sessions, seasonTemplateForRir] = await Promise.all([
          getWeekTemplateById(weekInstance.weekTemplateId),
          getSessionInstancesForWeekInstance(weekInstanceId),
          seasonInstanceForRir
            ? getSeasonTemplateById(seasonInstanceForRir.seasonTemplateId)
            : Promise.resolve(undefined),
        ]);

        // Frozen for completed weeks; recomputed from frozen session metrics
        // for the live week.
        setMetrics(await getWeekMetrics(weekInstance));
        setWeekEndedEarly(weekInstance.endedEarly === true);
        setPrs(weekPRs);

        if (weekInstance.status === "completed") {
          const si = await getSeasonInstanceById(weekInstance.seasonInstanceId);
          if (si?.status === "completed") setSeasonInstance(si);
        }

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
              const m = await getSessionMetrics(session);
              if (!m) return { sessionInstanceId: session.id, ragStatus: null, isCurrent: false };
              return { sessionInstanceId: session.id, ragStatus: m.ragStatus, isCurrent: false };
            } catch {
              return { sessionInstanceId: session.id, ragStatus: null, isCurrent: false };
            }
          })
        );
        setSessionBreadcrumb(breadcrumbSessions);

        // Weeks this season breadcrumb — show all expected weeks, not just generated ones.
        // Uses rirSequence.length as the authoritative total so future weeks appear as
        // empty dots even before they are generated by the lazy week creation logic.
        const allWeeks = await getWeekInstancesForSeasonInstance(
          weekInstance.seasonInstanceId
        );
        const totalWeeks = seasonTemplateForRir?.rirSequence?.length ?? allWeeks.length;
        const weekByOrder = new Map(allWeeks.map((w) => [w.order, w]));

        // Needs the season's position and the week count, so it can only be
        // built once the season's weeks are known. Any part that can't be
        // resolved drops out rather than showing a placeholder.
        const weekRir =
          seasonTemplateForRir?.rirSequence?.[weekInstance.order - 1] ??
          weekTemplate?.targetRir;
        setWeekEyebrow(
          [
            seasonInstanceForRir ? `Season ${seasonInstanceForRir.order}` : null,
            `Week ${weekInstance.order} of ${totalWeeks}`,
            weekRir != null ? `${weekRir} RIR` : null,
          ]
            .filter(Boolean)
            .join(" · ")
        );

        // The heuristics window spans this week's real calendar days. Boundary
        // rule: a week runs from the prior week's end to the next week's start
        // of activity, so a gap before week N+1's first session belongs to
        // week N. Falls back to startedAt / season end / today when nothing has
        // been logged yet.
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

        // ── Heuristics summary ───────────────────────────────────────────
        // Mirrors the SeasonSummaryPage logic, just scoped to this week's
        // [actualStart, endBoundary] range. End is capped at today so the bar
        // doesn't extend into days the user couldn't have logged yet.
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
                let sum = 0;
                for (const e of qEntries) {
                  if (e.value != null && !datesAnswered.has(e.date)) {
                    datesAnswered.add(e.date);
                    sum += e.value;
                  }
                }
                const givenCount = datesAnswered.size;
                // Mean of answered values only; coverage is reported alongside
                // it so a mean over a third of the days can't pass for a mean
                // over nearly all of them.
                return {
                  questionId: q.id,
                  label: q.label,
                  avg: givenCount > 0 ? sum / givenCount : null,
                  givenCount,
                  totalDays,
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
              return { weekInstanceId: w.id, emojiRating: null, isCurrent: true, endedEarly };
            }
            if (w.status !== "completed") {
              return { weekInstanceId: w.id, emojiRating: null, isCurrent: false, endedEarly };
            }
            try {
              const wMetrics = await getWeekMetrics(w);
              return { weekInstanceId: w.id, emojiRating: wMetrics.emojiRating, isCurrent: false, endedEarly };
            } catch {
              return { weekInstanceId: w.id, emojiRating: null, isCurrent: false, endedEarly };
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
  }, [weekInstanceId]);

  // Patch the current week into weeksBreadcrumb once metrics are ready.
  const weeksBreadcrumbWithCurrent = useMemo<BreadcrumbWeek[]>(() => {
    if (!metrics) return weeksBreadcrumb;
    return weeksBreadcrumb.map((w) =>
      w.isCurrent ? { ...w, emojiRating: metrics.emojiRating } : w
    );
  }, [weeksBreadcrumb, metrics]);

  if (!isLoading && (errorMessage || !metrics)) {
    return (
      <main className="summary-page">
        <TopBar title="Week summary" backTo="/" backLabel="Dashboard" />
        <section className="sum-shell">
          <p className="sum-error">{errorMessage ?? "Something went wrong."}</p>
        </section>
        <BottomNav activeTab="session" />
      </main>
    );
  }

  return (
    <main className="summary-page">
      <TopBar title="Week summary" backTo="/" backLabel="Dashboard" />

      <section className="sum-shell">
        {!loaderDone ? (
          <PageLoader
            label="Building your week summary…"
            durationMs={3000}
            ready={!isLoading}
            onDone={() => setLoaderDone(true)}
          />
        ) : (() => {
          const { volumeScore, intensityScore, consistencyScore, emojiRating } = metrics!;
          return (<>
            {/* ── Eyebrow ── */}
            {weekEyebrow && <p className="sum-eyebrow">{weekEyebrow}</p>}

            <WeekGradeHero
              emojiRating={emojiRating}
              volumeScore={volumeScore}
              intensityScore={intensityScore}
              consistencyScore={consistencyScore}
              endedEarly={weekEndedEarly}
            />

            {/* ── Sessions this week ── */}
            {sessionBreadcrumb.length > 0 && (
              <RevealSection className="sum-breadcrumb">
                <div className="sum-reveal">
                  <WeeklyBreadcrumb sessions={sessionBreadcrumb} />
                </div>
              </RevealSection>
            )}

            {/* ── Narrative ── */}
            <RevealSection>
              <p className="sum-narrative sum-reveal">{buildWeekNarrative(metrics!)}</p>
            </RevealSection>

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

            {/* ── Weeks this season ── */}
            {weeksBreadcrumbWithCurrent.length > 1 && (
              <RevealSection title="Weeks this season" className="sum-breadcrumb">
                <div className="sum-reveal">
                  <WeeksBreadcrumb weeks={weeksBreadcrumbWithCurrent} showLabel={false} />
                </div>
              </RevealSection>
            )}

            {/* ── Heuristics ── */}
            {heuristicSummary.length > 0 && (
              <RevealSection title="Heuristics">
                <ul className="sum-list sum-list--flush">
                  {heuristicSummary.map((row, i) => {
                    // Colour and bar both read the rounded mean, not the raw
                    // one, so two rows labelled the same are tinted the same.
                    const avg = row.avg != null ? Math.round(row.avg * 10) / 10 : null;
                    const avgPct = avg != null ? ((avg - 1) / 4) * 100 : null;
                    const coveragePct =
                      row.totalDays > 0
                        ? Math.round((row.givenCount / row.totalDays) * 100)
                        : 0;
                    const valueColor =
                      avg != null ? colorForHeuristicScore(avg) : undefined;
                    return (
                      <li
                        key={row.questionId}
                        className="sum-hs-row sum-reveal"
                        style={{ "--i": i } as React.CSSProperties}
                      >
                        <div className="sum-hs-row__head">
                          <span className="sum-hs-row__label">{row.label}</span>
                          <span className="sum-hs-row__value" style={valueColor ? { color: valueColor } : undefined}>
                            {avg != null ? avg.toFixed(1) : "—"}
                          </span>
                        </div>
                        <div className="sum-hs-bar">
                          {avgPct != null && (
                            <div
                              className="sum-hs-bar__fill"
                              style={{ width: `${avgPct}%`, background: valueColor }}
                            />
                          )}
                        </div>
                        <div className="sum-hs-row__coverage">{coveragePct}% coverage</div>
                      </li>
                    );
                  })}
                </ul>
              </RevealSection>
            )}

            {/* ── Season summary CTA ── */}
            {seasonInstance && (
              <RevealSection>
                <button
                  className="week-summary-season-cta sum-reveal"
                  onClick={() => navigate(`/season/${seasonInstance.id}/summary`)}
                >
                  View season summary →
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
