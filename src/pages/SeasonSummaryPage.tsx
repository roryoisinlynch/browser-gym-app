import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { SessionInstanceView, SessionPR } from "../repositories/programRepository";
import {
  getSeasonInstanceById,
  getAllSeasonInstances,
  getWeekInstancesForSeasonInstance,
  getSessionInstancesForWeekInstance,
  getSessionInstanceView,
  getWeekTemplateItemsForWeekTemplate,
  getSeasonPRs,
  getSeasonTemplateById,
} from "../repositories/programRepository";
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
  grade: SeasonGrade | null;
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
  const [isLoading, setIsLoading] = useState(true);
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

        const completedWeeks = weeks.filter(w => w.status === "completed");

        const weekMetricsList = await Promise.all(
          completedWeeks.map(async (w) => {
            const [sessions, templateItems] = await Promise.all([
              getSessionInstancesForWeekInstance(w.id),
              getWeekTemplateItemsForWeekTemplate(w.weekTemplateId),
            ]);
            const completedSessions = sessions.filter(s => s.status === "completed");
            const sessionViews: SessionInstanceView[] = (
              await Promise.all(completedSessions.map(s => getSessionInstanceView(s.id)))
            ).filter((sv): sv is SessionInstanceView => sv != null);
            return computeWeekMetrics(w, templateItems, sessionViews);
          })
        );

        const computed = computeSeasonMetrics(seasonInstance, weekMetricsList);
        setMetrics(computed);
        setSeasonName(seasonTemplate?.name ?? "Season summary");
        setPrs(seasonPRs);

        // Past seasons list (same template, completed, ordered oldest→newest).
        const allSeasons = await getAllSeasonInstances();
        const sameTemplate = allSeasons.filter(
          s => s.seasonTemplateId === seasonInstance.seasonTemplateId && s.status === "completed"
        );

        const rows: SeasonRow[] = await Promise.all(
          sameTemplate.map(async (s): Promise<SeasonRow> => {
            const isCurrent = s.id === seasonInstanceId;
            let grade: SeasonGrade | null = null;
            let prCount = 0;

            try {
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
              const sMetrics = isCurrent ? computed : computeSeasonMetrics(s, sWeekMetrics);
              grade = sMetrics.grade;

              const sPRs = await getSeasonPRs(s.id);
              prCount = sPRs.length;
            } catch {
              // leave as null
            }

            return {
              season: s,
              grade,
              prCount,
              completedAt: s.completedAt ?? null,
            };
          })
        );

        setSeasonRows(rows);

        // Weeks this season breadcrumb — all weeks with their emoji rating.
        const wbItems: BreadcrumbWeek[] = await Promise.all(
          weeks.map(async (w): Promise<BreadcrumbWeek> => {
            if (w.status !== "completed") return { weekInstanceId: w.id, emojiRating: null, isCurrent: false };
            const idx = completedWeeks.indexOf(w);
            if (idx !== -1 && weekMetricsList[idx]) {
              return { weekInstanceId: w.id, emojiRating: weekMetricsList[idx].emojiRating, isCurrent: false };
            }
            return { weekInstanceId: w.id, emojiRating: null, isCurrent: false };
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

  if (isLoading) {
    return (
      <main className="season-summary-page">
        <TopBar title="Season summary" backTo="/season" backLabel="Back to season" />
        <section className="season-summary-shell">
          <p className="season-summary-loading">Loading summary...</p>
        </section>
        <BottomNav activeTab="session" />
      </main>
    );
  }

  if (errorMessage || !metrics) {
    return (
      <main className="season-summary-page">
        <TopBar title="Season summary" backTo="/season" backLabel="Back to season" />
        <section className="season-summary-shell">
          <p className="season-summary-error">{errorMessage ?? "Something went wrong."}</p>
        </section>
        <BottomNav activeTab="session" />
      </main>
    );
  }

  const { totalSets, totalSessions, totalWeeks, durationLabel, volumeScore, intensityScore, consistencyScore, seasonScore, grade } = metrics;
  const color = gradeColor(grade);

  return (
    <main className="season-summary-page">
      <TopBar title="Season summary" backTo="/season" backLabel="Back to season" />

      <section className="season-summary-shell">
        {/* ── Season name ── */}
        <header className="season-summary-header">
          <h1 className="season-summary-title">{seasonName}</h1>
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

          <p className="season-summary-narrative">{buildSeasonNarrative(metrics)}</p>

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
            Score = average of volume, intensity and consistency across all weeks
          </p>
        </section>

        {/* ── Weeks this season ── */}
        {weeksBreadcrumb.length > 0 && (
          <section className="season-summary-section season-summary-section--breadcrumb">
            <WeeksBreadcrumb weeks={weeksBreadcrumb} />
          </section>
        )}

        {/* ── All seasons ── */}
        {seasonRows.length > 1 && (
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
                    <span className="season-summary-season-row__name">{row.season.name}</span>
                    <span className="season-summary-season-row__meta">
                      {row.grade && rowColor && (
                        <span className={`season-summary-season-row__grade season-summary-season-row__grade--${rowColor}`}>
                          {row.grade}
                        </span>
                      )}
                      <span className="season-summary-season-row__prs">{row.prCount} PR{row.prCount !== 1 ? "s" : ""}</span>
                      {finishDate && (
                        <span className="season-summary-season-row__date">{finishDate}</span>
                      )}
                    </span>
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
              {prs.map((pr) => {
                const pctGain =
                  pr.previousE1RM != null
                    ? Math.round((pr.newE1RM / pr.previousE1RM - 1) * 100)
                    : null;
                const kgGain =
                  pr.previousE1RM != null
                    ? Math.round((pr.newE1RM - pr.previousE1RM) * 100) / 100
                    : null;
                return (
                  <li key={pr.exerciseName} className="season-summary-pr-item">
                    <span className="season-summary-pr-name">{pr.exerciseName}</span>
                    {pr.previousE1RM != null ? (
                      <span className="season-summary-pr-detail">
                        {Math.round(pr.previousE1RM * 100) / 100}kg{" "}
                        <span className="season-summary-pr-arrow">→</span>{" "}
                        <span className="season-summary-pr-new-value">
                          {Math.round(pr.newE1RM * 100) / 100}kg
                        </span>{" "}
                        e1RM
                        {pctGain != null && <> (+{pctGain}%)</>}
                        {kgGain != null && <>, up {kgGain}kg</>}
                      </span>
                    ) : (
                      <span className="season-summary-pr-detail">
                        <span className="season-summary-pr-new-value">
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
