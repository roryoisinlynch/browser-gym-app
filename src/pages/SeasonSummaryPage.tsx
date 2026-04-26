import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { SessionInstanceView, SessionPR } from "../repositories/programRepository";
import {
  computeSeasonConsistencyForSeason,
  getSeasonInstanceById,
  getAllSeasonInstances,
  getWeekInstancesForSeasonInstance,
  getSessionInstancesForWeekInstance,
  getSessionInstanceView,
  getWeekTemplateItemsForWeekTemplate,
  getWeekInstanceItemsForWeekInstance,
  getSeasonPRs,
  getSeasonTemplateById,
} from "../repositories/programRepository";
import type { SessionInstance } from "../domain/models";
import { computeWeekMetrics } from "../services/weekMetrics";
import {
  computeSeasonMetrics,
  gradeColor,
} from "../services/seasonMetrics";
import type { SeasonMetrics, SeasonGrade } from "../services/seasonMetrics";
import type { SeasonInstance } from "../domain/models";
import WeeksBreadcrumb from "../components/WeeksBreadcrumb";
import type { BreadcrumbWeek } from "../components/WeeksBreadcrumb";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import "./SeasonSummaryPage.css";

type DaySquareStatus = "green" | "amber" | "late" | "overdue" | "grey" | "rest-past" | "rest-future";
interface DaySquare { type: "session" | "rest"; scheduledDate: string; status: DaySquareStatus; }

function localDateIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function toLocalMidnight(iso: string): Date {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function buildSeasonNarrative(metrics: SeasonMetrics): string {
  const { volumeScore, intensityScore, totalSkippedSessions } = metrics;

  const volStatus = volumeScore >= 100 ? "green" : volumeScore >= 90 ? "amber" : "red";
  const intStatus = intensityScore >= 100 ? "green" : intensityScore >= 90 ? "amber" : "red";

  const volPhrase =
    volStatus === "green" ? "logged enough sets to meet your volume targets"
    : volStatus === "amber" ? "almost logged enough sets to meet your volume targets"
    : "didn't log enough sets to meet your volume targets";

  const intPhrase =
    intStatus === "green" ? "lifted enough weight to hit your intensity targets"
    : intStatus === "amber" ? "almost lifted enough weight to hit your intensity targets"
    : "didn't lift enough weight to hit your intensity targets";

  const conPhrase = totalSkippedSessions === 0
    ? "stayed consistent with your schedule"
    : "did not stay consistent with your schedule";

  const items = [
    { positive: volStatus !== "red", phrase: volPhrase },
    { positive: intStatus !== "red", phrase: intPhrase },
    { positive: totalSkippedSessions === 0, phrase: conPhrase },
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

export default function SeasonSummaryPage() {
  const { seasonInstanceId } = useParams<{ seasonInstanceId: string }>();
  const [seasonName, setSeasonName] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<SeasonMetrics | null>(null);
  const [prs, setPrs] = useState<SessionPR[]>([]);
  const [seasonRows, setSeasonRows] = useState<SeasonRow[]>([]);
  const [weeksBreadcrumb, setWeeksBreadcrumb] = useState<BreadcrumbWeek[]>([]);
  const [seasonDaySquares, setSeasonDaySquares] = useState<DaySquare[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
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
        setLoadProgress(10);

        if (!seasonInstance) {
          setErrorMessage("Season not found.");
          setIsLoading(false);
          return;
        }

        const [seasonTemplate, weeks] = await Promise.all([
          getSeasonTemplateById(seasonInstance.seasonTemplateId),
          getWeekInstancesForSeasonInstance(seasonInstanceId),
        ]);
        setLoadProgress(20);

        const completedWeeks = weeks.filter(w => w.status === "completed");

        // Collect sessions per week (reused for both metrics and day squares)
        const sessionsByWeek = new Map<string, SessionInstance[]>();
        let weekLength = 0;

        const weekMetricsList = await Promise.all(
          completedWeeks.map(async (w) => {
            const [sessions, templateItems] = await Promise.all([
              getSessionInstancesForWeekInstance(w.id),
              getWeekTemplateItemsForWeekTemplate(w.weekTemplateId),
            ]);
            sessionsByWeek.set(w.id, sessions);
            if (weekLength === 0) weekLength = templateItems.length;
            const completedSessions = sessions.filter(s => s.status === "completed");
            const sessionViews: SessionInstanceView[] = (
              await Promise.all(completedSessions.map(s => getSessionInstanceView(s.id)))
            ).filter((sv): sv is SessionInstanceView => sv != null);
            return computeWeekMetrics(w, templateItems, sessionViews);
          })
        );
        setLoadProgress(50);

        const consistencyOverride = await computeSeasonConsistencyForSeason(seasonInstance);
        const computed = computeSeasonMetrics(seasonInstance, weekMetricsList, consistencyOverride);
        setMetrics(computed);
        setSeasonName(seasonTemplate?.name ?? "Season summary");
        setPrs(seasonPRs);

        // Compute season-level day squares
        if (seasonInstance.startedAt && weekLength > 0) {
          const today = localDateIso();
          const seasonStartMs = toLocalMidnight(seasonInstance.startedAt).getTime();
          const sortedWeeks = [...weeks].sort((a, b) => a.order - b.order);

          // Populate session info from every week, not just completed ones —
          // otherwise sessions in not-yet-completed weeks fall through the
          // day-square classifier and get marked "upcoming" even when their
          // scheduled date is already past.
          const sessionInfoMap = new Map<string, { date: string; status: string; completedAt: string | null }>();
          for (const w of sortedWeeks) {
            const cached = sessionsByWeek.get(w.id);
            const sessionsForWeek = cached ?? (await getSessionInstancesForWeekInstance(w.id));
            for (const s of sessionsForWeek) {
              sessionInfoMap.set(s.id, { date: s.date, status: s.status, completedAt: s.completedAt ?? null });
            }
          }

          const weekInstanceItemsPerWeek = await Promise.all(
            sortedWeeks.map(w => getWeekInstanceItemsForWeekInstance(w.id))
          );
          const squares: DaySquare[] = [];
          for (let wi = 0; wi < sortedWeeks.length; wi++) {
            const items = weekInstanceItemsPerWeek[wi].sort((a, b) => a.order - b.order);
            for (const item of items) {
              const dayIndex = wi * weekLength + (item.order - 1);
              const scheduledDate = localDateIso(new Date(seasonStartMs + dayIndex * 86400000));
              if (item.type === "rest") {
                squares.push({ type: "rest", scheduledDate, status: scheduledDate < today ? "rest-past" : "rest-future" });
                continue;
              }
              if (!item.sessionInstanceId) {
                squares.push({ type: "session", scheduledDate, status: scheduledDate < today ? "overdue" : "grey" });
                continue;
              }
              const session = sessionInfoMap.get(item.sessionInstanceId);
              if (!session) { squares.push({ type: "session", scheduledDate, status: "grey" }); continue; }
              if (session.status !== "completed") {
                squares.push({ type: "session", scheduledDate, status: scheduledDate < today ? "overdue" : "grey" });
                continue;
              }
              const completedDate = session.completedAt ? localDateIso(toLocalMidnight(session.completedAt)) : scheduledDate;
              const status: DaySquareStatus = completedDate < scheduledDate ? "amber" : completedDate > scheduledDate ? "late" : "green";
              squares.push({ type: "session", scheduledDate, status });
            }
          }
          setSeasonDaySquares(squares);
        }
        setLoadProgress(65);

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

              const sWeeks = await getWeekInstancesForSeasonInstance(s.id);
              const sCompletedWeeks = sWeeks.filter(w => w.status === "completed");
              const sWeekMetrics = await Promise.all(
                sCompletedWeeks.map(async (w) => {
                  const [wSessions, wItems] = await Promise.all([
                    getSessionInstancesForWeekInstance(w.id),
                    getWeekTemplateItemsForWeekTemplate(w.weekTemplateId),
                  ]);
                  const wViews: SessionInstanceView[] = (
                    await Promise.all(
                      wSessions.filter(s => s.status === "completed").map(s => getSessionInstanceView(s.id))
                    )
                  ).filter((sv): sv is SessionInstanceView => sv != null);
                  return computeWeekMetrics(w, wItems, wViews);
                })
              );
              const sConsistency = await computeSeasonConsistencyForSeason(s);
              const sMetrics = isCurrent ? computed : computeSeasonMetrics(s, sWeekMetrics, sConsistency);
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
        setLoadProgress(85);

        // Weeks this season breadcrumb — all weeks with their emoji rating.
        const wbItems: BreadcrumbWeek[] = await Promise.all(
          weeks.map(async (w): Promise<BreadcrumbWeek> => {
            const endedEarly = w.endedEarly === true;
            if (w.status !== "completed") return { weekInstanceId: w.id, emojiRating: null, isCurrent: false, endedEarly };
            const idx = completedWeeks.indexOf(w);
            if (idx !== -1 && weekMetricsList[idx]) {
              return { weekInstanceId: w.id, emojiRating: weekMetricsList[idx].emojiRating, isCurrent: false, endedEarly };
            }
            return { weekInstanceId: w.id, emojiRating: null, isCurrent: false, endedEarly };
          })
        );
        setWeeksBreadcrumb(wbItems);
        setLoadProgress(100);
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
        <section className="season-summary-shell">
          <p className="season-summary-error">{errorMessage ?? "Something went wrong."}</p>
        </section>
        <BottomNav activeTab="session" />
      </main>
    );
  }

  return (
    <main className="season-summary-page">
      <TopBar title="Season summary" backTo="/" backLabel="Dashboard" />

      <section className="season-summary-shell">
        {isLoading ? (
          <>
            <div className="page-spinner" />
            <div className="page-load-bar">
              <div className="page-load-bar__fill" style={{ width: `${loadProgress}%` }} />
            </div>
          </>
        ) : (() => {
          const { totalSets, totalSessions, totalWeeks, durationLabel, volumeScore, intensityScore, consistencyScore, seasonScore, grade, endedEarly } = metrics!;
          const color = gradeColor(grade);
          return (<>
        {/* ── Season name ── */}
        <header className="season-summary-header">
          <h1 className="season-summary-title">{seasonName}</h1>
          {endedEarly && (
            <p className="season-summary-eyebrow season-summary-eyebrow--ended-early">
              Ended early
            </p>
          )}
        </header>

        {/* ── Descriptive stats ── */}
        <div className="season-summary-stats-rows">
          <div className="season-summary-stats-row">
            {durationLabel && (
              <>
                <div className="season-summary-stat">
                  <span className="season-summary-stat__value">{durationLabel}</span>
                  <span className="season-summary-stat__label">Duration</span>
                </div>
                <div className="season-summary-stat-divider" />
              </>
            )}
            <div className="season-summary-stat">
              <span className="season-summary-stat__value">{totalWeeks}</span>
              <span className="season-summary-stat__label">Weeks</span>
            </div>
            <div className="season-summary-stat-divider" />
            <div className="season-summary-stat">
              <span className="season-summary-stat__value">{totalSessions}</span>
              <span className="season-summary-stat__label">Sessions</span>
            </div>
          </div>
          <div className="season-summary-stats-row">
            <div className="season-summary-stat">
              <span className="season-summary-stat__value">{totalSets}</span>
              <span className="season-summary-stat__label">Total sets</span>
            </div>
            <div className="season-summary-stat-divider" />
            <div className="season-summary-stat">
              <span className="season-summary-stat__value">{prs.length}</span>
              <span className="season-summary-stat__label">Total PRs</span>
            </div>
          </div>
        </div>

        {/* ── Results ── */}
        <section className="season-summary-section">
          <h2 className="season-summary-section-title">Results</h2>

          <p className="season-summary-narrative">{buildSeasonNarrative(metrics!)}</p>

          <div className="season-summary-score-block">
            {/* Left: grade badge + season score */}
            <div className="season-summary-score-primary">
              <span className={`season-summary-grade season-summary-grade--${color}`}>
                {grade}
              </span>
              <div className="season-summary-score-center">
                <span className="season-summary-score-total">{seasonScore}</span>
                <span className="season-summary-score-label">Season score</span>
              </div>
            </div>

            <div className="season-summary-score-divider" />

            {/* Right: volume, intensity, consistency */}
            <div className="season-summary-score-secondary">
              <div className="season-summary-score-item">
                <span className="season-summary-score-item__pct">{volumeScore}%</span>
                <span className="season-summary-score-item__label">Volume</span>
              </div>
              <div className="season-summary-score-item">
                <span className="season-summary-score-item__pct">{intensityScore}%</span>
                <span className="season-summary-score-item__label">Intensity</span>
              </div>
              <div className="season-summary-score-item">
                <span className="season-summary-score-item__pct">{consistencyScore}%</span>
                <span className="season-summary-score-item__label">Consistency</span>
              </div>
            </div>
          </div>

          <p className="season-summary-score-footnote">
            Score = average of volume, intensity and consistency (each out of 100)
          </p>
        </section>

        {/* ── Weeks this season ── */}
        {/* ── Schedule day counts ── */}
        {seasonDaySquares.length > 0 && (() => {
          const countItems = [
            { label: "On time",   color: "#6bcb77", n: seasonDaySquares.filter(d => d.status === "green").length },
            { label: "Done early", color: "#f4a261", n: seasonDaySquares.filter(d => d.status === "amber").length },
            { label: "Done late", color: "#e76f51", n: seasonDaySquares.filter(d => d.status === "late").length },
            { label: "Missed",    color: "#9b2335", n: seasonDaySquares.filter(d => d.status === "overdue").length },
            { label: "Upcoming",  color: null,      n: seasonDaySquares.filter(d => d.status === "grey").length },
            { label: "Rest",      color: null,      n: seasonDaySquares.filter(d => d.type === "rest").length },
          ].filter(i => i.n > 0);
          if (countItems.length === 0) return null;
          const rows = countItems.length <= 3
            ? [countItems]
            : [countItems.slice(0, Math.ceil(countItems.length / 2)), countItems.slice(Math.ceil(countItems.length / 2))];
          return (
            <div className="season-summary-stats-rows">
              {rows.map((row, ri) => (
                <div key={ri} className="season-summary-stats-row">
                  {row.map((item, i) => (
                    <div key={item.label} style={{ display: "contents" }}>
                      {i > 0 && <div className="season-summary-stat-divider" />}
                      <div className="season-summary-stat">
                        <span className="season-summary-stat__value" style={item.color ? { color: item.color } : undefined}>{item.n}</span>
                        <span className="season-summary-stat__label">{item.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          );
        })()}

        {weeksBreadcrumb.length > 0 && (
          <section className="season-summary-section season-summary-section--breadcrumb">
            <WeeksBreadcrumb weeks={weeksBreadcrumb} />
          </section>
        )}

        {/* ── All seasons ── */}
        {seasonRows.length > 0 && (
          <section className="season-summary-section">
            <h2 className="season-summary-section-title">All seasons</h2>
            <ul className="season-summary-seasons-list">
              {seasonRows.map((row) => {
                const isCurrent = row.season.id === seasonInstanceId;
                const rowColor = row.grade ? gradeColor(row.grade) : null;
                const finishDate = row.completedAt
                  ? new Date(row.completedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                  : null;
                return (
                  <li key={row.season.id} className={`season-summary-season-row${isCurrent ? " season-summary-season-row--current" : ""}`}>
                    <div className="season-summary-season-row__main">
                      <span className="season-summary-season-row__name">
                        {row.programName
                          ? `${row.programName} · ${row.season.name}`
                          : row.season.name}
                      </span>
                      <span className="season-summary-season-row__meta">
                        {row.grade && rowColor && (
                          <span className={`season-summary-season-row__grade season-summary-season-row__grade--${rowColor}`}>
                            {row.grade}
                          </span>
                        )}
                        {row.seasonScore != null && (
                          <span className="season-summary-season-row__score">{row.seasonScore}</span>
                        )}
                      </span>
                    </div>
                    <div className="season-summary-season-row__sub">
                      {row.durationLabel && (
                        <span className="season-summary-season-row__duration">{row.durationLabel}</span>
                      )}
                      <span className="season-summary-season-row__prs">{row.prCount} PR{row.prCount !== 1 ? "s" : ""}</span>
                      {finishDate && (
                        <span className="season-summary-season-row__date">{finishDate}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* ── Personal records ── */}
        {prs.length > 0 && (
          <section className="season-summary-section season-summary-section--pr">
            <h2 className="season-summary-section-title season-summary-section-title--accent">
              Personal records
            </h2>
            <ul className="season-summary-pr-list">
              {prs.map((pr) => (
                <li key={pr.exerciseName} className="season-summary-pr-item">
                  <span className="season-summary-pr-name">{pr.exerciseName}</span>
                  {pr.prType === "reps" ? (
                    <span className="season-summary-pr-detail">
                      {pr.previousReps != null && <>{pr.previousReps} reps <span className="season-summary-pr-arrow">→</span> </>}
                      <span className="season-summary-pr-new-value">{pr.newReps} reps</span>
                    </span>
                  ) : pr.previousE1RM != null && pr.newE1RM != null ? (
                    <span className="season-summary-pr-detail">
                      {Math.round(pr.previousE1RM * 100) / 100}kg{" "}
                      <span className="season-summary-pr-arrow">→</span>{" "}
                      <span className="season-summary-pr-new-value">{Math.round(pr.newE1RM * 100) / 100}kg</span>{" "}
                      e1RM
                      {<> (+{Math.round((pr.newE1RM / pr.previousE1RM - 1) * 100)}%)</>}
                      <>, up {Math.round((pr.newE1RM - pr.previousE1RM) * 100) / 100}kg</>
                    </span>
                  ) : pr.newE1RM != null ? (
                    <span className="season-summary-pr-detail">
                      <span className="season-summary-pr-new-value">{Math.round(pr.newE1RM * 100) / 100}kg</span>{" "}
                      e1RM
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        )}
        </>);
        })()}
      </section>

      <BottomNav activeTab="session" />
    </main>
  );
}
