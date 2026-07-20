import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { SessionPR } from "../repositories/programRepository";
import {
  getSeasonInstanceById,
  getAllSeasonInstances,
  getSeasonMetrics,
  getWeekInstancesForSeasonInstance,
  getWeekMetrics,
  getSessionInstancesForWeekInstance,
  getSeasonPRs,
  getSeasonTemplateById,
} from "../repositories/programRepository";
import { gradeColor } from "../services/seasonMetrics";
import type { SeasonMetrics, SeasonGrade } from "../services/seasonMetrics";
import type { SeasonInstance } from "../domain/models";
import {
  isHeuristicsEnabled,
  getQuestions,
  getEntriesForDateRange,
} from "../repositories/heuristicsRepository";
import { colorForHeuristicScore } from "../services/heuristicsScale";
import WeeksBreadcrumb from "../components/WeeksBreadcrumb";
import type { BreadcrumbWeek } from "../components/WeeksBreadcrumb";
import SeasonGradeHero from "../components/SeasonGradeHero";
import SeasonCalendar from "../components/SeasonCalendar";
import type { SeasonMonth } from "../components/SeasonCalendar";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import PageLoader from "../components/PageLoader";
import useInView from "../hooks/useInView";
import "./SeasonSummaryPage.css";

function localDateIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function toLocalMidnight(iso: string): Date {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function buildSeasonNarrative(metrics: SeasonMetrics): string {
  const { volumeScore, intensityScore, consistencyScore } = metrics;

  const volStatus = volumeScore >= 100 ? "green" : volumeScore >= 90 ? "amber" : "red";
  const intStatus = intensityScore >= 100 ? "green" : intensityScore >= 90 ? "amber" : "red";
  const conStatus = consistencyScore >= 100 ? "green" : consistencyScore >= 90 ? "amber" : "red";

  const volPhrase =
    volStatus === "green" ? "logged enough sets to meet your volume targets"
    : volStatus === "amber" ? "almost logged enough sets to meet your volume targets"
    : "didn't log enough sets to meet your volume targets";

  const intPhrase =
    intStatus === "green" ? "lifted enough weight to hit your intensity targets"
    : intStatus === "amber" ? "almost lifted enough weight to hit your intensity targets"
    : "didn't lift enough weight to hit your intensity targets";

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

interface SeasonRow {
  season: SeasonInstance;
  programName: string | null;
  grade: SeasonGrade | null;
  seasonScore: number | null;
  durationLabel: string | null;
  prCount: number;
  completedAt: string | null;
}

interface HeuristicSummaryRow {
  questionId: string;
  label: string;
  avg: number | null;
  givenCount: number;
  totalDays: number;
}

interface CalendarData {
  months: SeasonMonth[];
  trainedDays: Set<string>;
  startIso: string;
  endIso: string;
  todayIso: string | null;
}

function dayDiffInclusive(startIso: string, endIso: string): number {
  const s = new Date(startIso + "T00:00:00").getTime();
  const e = new Date(endIso + "T00:00:00").getTime();
  // Round, not floor: a span crossing a DST boundary is 23 or 25 hours short of
  // a whole number of days, and flooring that lost an entire day — which showed
  // up as heuristic coverage above 100%.
  return Math.round((e - s) / 86_400_000) + 1;
}

/** Every calendar month between two dates inclusive, even one grazed by a day. */
function monthsBetween(startIso: string, endIso: string): SeasonMonth[] {
  const start = toLocalMidnight(startIso);
  const end = toLocalMidnight(endIso);
  const months: SeasonMonth[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= last) {
    months.push({ year: cursor.getFullYear(), month: cursor.getMonth() });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
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
      className={`ss-section${inView ? " is-in" : ""}${className ? ` ${className}` : ""}`}
    >
      {title && <h2 className="ss-section__title ss-reveal">{title}</h2>}
      {children}
    </section>
  );
}

export default function SeasonSummaryPage() {
  const { seasonInstanceId } = useParams<{ seasonInstanceId: string }>();
  const [seasonName, setSeasonName] = useState<string | null>(null);
  const [seasonDates, setSeasonDates] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<SeasonMetrics | null>(null);
  const [prs, setPrs] = useState<SessionPR[]>([]);
  const [seasonRows, setSeasonRows] = useState<SeasonRow[]>([]);
  const [weeksBreadcrumb, setWeeksBreadcrumb] = useState<BreadcrumbWeek[]>([]);
  const [calendar, setCalendar] = useState<CalendarData | null>(null);
  const [heuristicSummary, setHeuristicSummary] = useState<HeuristicSummaryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loaderDone, setLoaderDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!seasonInstanceId) {
        setErrorMessage("No season provided.");
        setIsLoading(false);
        return;
      }

      try {
        const [seasonInstance, seasonPRs] = await Promise.all([
          getSeasonInstanceById(seasonInstanceId),
          getSeasonPRs(seasonInstanceId),
        ]);

        if (!seasonInstance) {
          setErrorMessage("Season not found.");
          setIsLoading(false);
          return;
        }

        const [seasonTemplate, weeks] = await Promise.all([
          getSeasonTemplateById(seasonInstance.seasonTemplateId),
          getWeekInstancesForSeasonInstance(seasonInstanceId),
        ]);

        const computed = await getSeasonMetrics(seasonInstance);
        setMetrics(computed);
        setSeasonName(seasonTemplate?.name ?? "Season summary");
        setPrs(seasonPRs);

        const seasonEnded = seasonInstance.status !== "in_progress";

        if (seasonInstance.startedAt) {
          const startIso = localDateIso(toLocalMidnight(seasonInstance.startedAt));
          const endIso =
            seasonEnded && seasonInstance.completedAt
              ? localDateIso(toLocalMidnight(seasonInstance.completedAt))
              : localDateIso();
          setSeasonDates(
            startIso === endIso
              ? fmtDate(seasonInstance.startedAt)
              : `${fmtDate(startIso)} – ${fmtDate(endIso)}`
          );

          // ── Calendar ──────────────────────────────────────────────────────
          // Squares land on the day a session actually settled, not the day the
          // template planned it for, so drift shows up honestly. Weeks that
          // aren't completed still contribute — their sessions happened too.
          // Only completed sessions mark a day: the calendar answers "when did
          // I train", and the grade already accounts for what was skipped.
          const sessionsPerWeek = await Promise.all(
            weeks.map((w) => getSessionInstancesForWeekInstance(w.id))
          );
          const trainedDays = new Set<string>();
          for (const sessions of sessionsPerWeek) {
            for (const s of sessions) {
              if (s.status !== "completed") continue;
              trainedDays.add(localDateIso(toLocalMidnight(s.completedAt ?? s.date)));
            }
          }

          setCalendar({
            months: monthsBetween(startIso, endIso),
            trainedDays,
            startIso,
            endIso,
            todayIso: seasonEnded ? null : localDateIso(),
          });
        }

        // ── Heuristics summary ───────────────────────────────────────────
        if (await isHeuristicsEnabled() && seasonInstance.startedAt) {
          const questions = await getQuestions();
          if (questions.length > 0) {
            const startIso = localDateIso(toLocalMidnight(seasonInstance.startedAt));
            const endSourceIso =
              seasonEnded && seasonInstance.completedAt
                ? seasonInstance.completedAt
                : new Date().toISOString();
            const endIso = localDateIso(toLocalMidnight(endSourceIso));
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

        // All ended seasons across all programs (completed or stopped early),
        // ordered for display. Not filtered by template ID — seasons from
        // deleted or different programs are still part of the user's training
        // history and should be visible.
        const allSeasons = await getAllSeasonInstances();
        const endedSeasons = allSeasons.filter(
          s => (s.status === "completed" || s.status === "cancelled") && s.completedAt != null
        );

        const rows: SeasonRow[] = (await Promise.all(
          endedSeasons.map(async (s): Promise<SeasonRow | null> => {
            const isCurrent = s.id === seasonInstanceId;
            let grade: SeasonGrade | null = null;
            let seasonScore: number | null = null;
            let durationLabel: string | null = null;
            let prCount = 0;
            let programName: string | null = null;

            try {
              const tmpl = await getSeasonTemplateById(s.seasonTemplateId);
              programName = tmpl?.name ?? null;

              const sMetrics = isCurrent ? computed : await getSeasonMetrics(s);
              grade = sMetrics.grade;
              seasonScore = sMetrics.seasonScore;
              durationLabel = sMetrics.durationLabel;

              const sPRs = await getSeasonPRs(s.id);
              prCount = sPRs.length;
            } catch {
              // leave grade/prCount as defaults
            }

            return {
              season: s,
              programName,
              grade,
              seasonScore,
              durationLabel,
              prCount,
              completedAt: s.completedAt ?? null,
            };
          })
        )).filter((r): r is SeasonRow => r !== null)
          .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));

        setSeasonRows(rows);

        // Weeks this season breadcrumb — all weeks with their emoji rating.
        const wbItems: BreadcrumbWeek[] = await Promise.all(
          weeks.map(async (w): Promise<BreadcrumbWeek> => {
            const endedEarly = w.endedEarly === true;
            if (w.status !== "completed") return { weekInstanceId: w.id, emojiRating: null, isCurrent: false, endedEarly };
            const wm = await getWeekMetrics(w);
            return { weekInstanceId: w.id, emojiRating: wm.emojiRating, isCurrent: false, endedEarly };
          })
        );
        setWeeksBreadcrumb(wbItems);
      } catch (err) {
        console.error("Failed to load season summary:", err);
        setErrorMessage("Could not load season summary.");
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [seasonInstanceId]);

  if (!isLoading && (errorMessage || !metrics)) {
    return (
      <main className="season-summary-page">
        <TopBar title="Season summary" backTo="/" backLabel="Dashboard" />
        <section className="ss-shell">
          <p className="ss-error">{errorMessage ?? "Something went wrong."}</p>
        </section>
        <BottomNav activeTab="session" />
      </main>
    );
  }

  return (
    <main className="season-summary-page">
      <TopBar title="Season summary" backTo="/" backLabel="Dashboard" />

      <section className="ss-shell">
        {!loaderDone ? (
          <PageLoader
            label="Building your season summary…"
            durationMs={5000}
            ready={!isLoading}
            onDone={() => setLoaderDone(true)}
          />
        ) : (() => {
          const { volumeScore, intensityScore, consistencyScore, grade, endedEarly } = metrics!;
          return (<>
            {/* ── Header ── */}
            <header className="ss-header">
              <h1 className="ss-title">{seasonName}</h1>
              {seasonDates && <p className="ss-dates">{seasonDates}</p>}
            </header>

            {/* ── Grade, then the three scores behind it ── */}
            <SeasonGradeHero
              grade={grade}
              volumeScore={volumeScore}
              intensityScore={intensityScore}
              consistencyScore={consistencyScore}
              endedEarly={endedEarly}
            />

            {/* ── Narrative ── */}
            <RevealSection className="ss-section--narrative">
              <p className="ss-narrative ss-reveal">{buildSeasonNarrative(metrics!)}</p>
            </RevealSection>

            {/* ── Weeks breadcrumb ── */}
            {weeksBreadcrumb.length > 0 && (
              <RevealSection title="Week by week" className="ss-breadcrumb">
                <div className="ss-reveal">
                  <WeeksBreadcrumb weeks={weeksBreadcrumb} showLabel={false} />
                </div>
              </RevealSection>
            )}

            {/* ── Calendar ── */}
            {calendar && calendar.months.length > 0 && (
              <RevealSection title="The season, day by day">
                <SeasonCalendar
                  months={calendar.months}
                  trainedDays={calendar.trainedDays}
                  seasonStartIso={calendar.startIso}
                  seasonEndIso={calendar.endIso}
                  todayIso={calendar.todayIso}
                />
              </RevealSection>
            )}

            {/* ── Personal records ── */}
            {prs.length > 0 && (
              <RevealSection title={`Personal records · ${prs.length}`}>
                <ul className="ss-list">
                  {prs.map((pr, i) => {
                    const gainPct =
                      pr.prType !== "reps" && pr.previousE1RM != null && pr.newE1RM != null
                        ? Math.round((pr.newE1RM / pr.previousE1RM - 1) * 100)
                        : null;
                    return (
                      <li
                        key={pr.exerciseName}
                        className="ss-row ss-reveal"
                        style={{ "--i": i } as React.CSSProperties}
                      >
                        <div className="ss-row__head">
                          <span className="ss-row__name">{pr.exerciseName}</span>
                          {gainPct != null && (
                            <span className="ss-chip">+{gainPct}%</span>
                          )}
                        </div>
                        {pr.prType === "reps" ? (
                          <span className="ss-row__detail">
                            {pr.previousReps != null && <>{pr.previousReps} reps <span className="ss-arrow">→</span> </>}
                            <span className="ss-row__value">{pr.newReps} reps</span>
                          </span>
                        ) : pr.previousE1RM != null && pr.newE1RM != null ? (
                          <span className="ss-row__detail">
                            {Math.round(pr.previousE1RM * 100) / 100}kg{" "}
                            <span className="ss-arrow">→</span>{" "}
                            <span className="ss-row__value">{Math.round(pr.newE1RM * 100) / 100}kg</span>{" "}
                            e1RM, up {Math.round((pr.newE1RM - pr.previousE1RM) * 100) / 100}kg
                          </span>
                        ) : pr.newE1RM != null ? (
                          <span className="ss-row__detail">
                            <span className="ss-row__value">{Math.round(pr.newE1RM * 100) / 100}kg</span>{" "}
                            e1RM
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </RevealSection>
            )}

            {/* ── Heuristics ── */}
            {heuristicSummary.length > 0 && (
              <RevealSection title="Heuristics">
                <ul className="ss-list ss-list--flush">
                  {heuristicSummary.map((row, i) => {
                    // Colour and bar both read the rounded mean, not the raw
                    // one. The ramp is continuous, so three rows all labelled
                    // "3.7" were being tinted three imperceptibly different
                    // greens — variation the number itself can't explain.
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
                        className="ss-hs-row ss-reveal"
                        style={{ "--i": i } as React.CSSProperties}
                      >
                        <div className="ss-hs-row__head">
                          <span className="ss-hs-row__label">{row.label}</span>
                          <span className="ss-hs-row__value" style={valueColor ? { color: valueColor } : undefined}>
                            {avg != null ? avg.toFixed(1) : "—"}
                          </span>
                        </div>
                        <div className="ss-hs-bar">
                          {avgPct != null && (
                            <div
                              className="ss-hs-bar__fill"
                              style={{ width: `${avgPct}%`, background: valueColor }}
                            />
                          )}
                        </div>
                        <div className="ss-hs-row__coverage">{coveragePct}% coverage</div>
                      </li>
                    );
                  })}
                </ul>
              </RevealSection>
            )}

            {/* ── All seasons ── */}
            {seasonRows.length > 0 && (
              <RevealSection title="All seasons">
                <ul className="ss-list ss-list--plain">
                  {seasonRows.map((row, i) => {
                    const isCurrent = row.season.id === seasonInstanceId;
                    const rowColor = row.grade ? gradeColor(row.grade) : null;
                    const startDate = row.season.startedAt ? fmtDate(row.season.startedAt) : null;
                    const finishDate = row.completedAt ? fmtDate(row.completedAt) : null;
                    const dateRange = startDate && finishDate
                      ? `${startDate} – ${finishDate}`
                      : startDate ?? finishDate ?? null;
                    return (
                      <li
                        key={row.season.id}
                        className={`ss-row ss-row--plain ss-reveal${isCurrent ? " ss-row--current" : ""}`}
                        style={{ "--i": i } as React.CSSProperties}
                      >
                        <div className="ss-row__head">
                          <span className="ss-row__name">
                            {row.programName
                              ? `${row.programName} · ${row.season.name}`
                              : row.season.name}
                          </span>
                          <span className="ss-row__meta">
                            {row.seasonScore != null && (
                              <span className="ss-row__score">{row.seasonScore}</span>
                            )}
                            {row.grade && rowColor && (
                              <span className={`ss-row__grade ss-row__grade--${rowColor}`}>
                                {row.grade}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="ss-row__sub">
                          {row.durationLabel && <span>{row.durationLabel}</span>}
                          <span>{row.prCount} PR{row.prCount !== 1 ? "s" : ""}</span>
                          {dateRange && <span>{dateRange}</span>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </RevealSection>
            )}
          </>);
        })()}
      </section>

      <BottomNav activeTab="session" />
    </main>
  );
}
