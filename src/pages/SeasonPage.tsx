import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import StartSeasonModal from "../components/StartSeasonModal";
import WeekCard, { type WeekCardState } from "../components/WeekCard";
import TopBar from "../components/TopBar";
import type { SeasonTemplate, WeekInstance } from "../domain/models";
import {
  getActiveSeasonInstance,
  getCanonicalWeekTemplateForSeason,
  getLastCompletedSeasonInstance,
  getSeasonTemplates,
  getWeekInstancesForSeasonInstance,
  getWeekTemplateItemsForWeekTemplate,
  startSeasonFromTemplate,
  getAllSessionTemplates,
} from "../repositories/programRepository";
import "./SeasonPage.css";

function getWeekState(
  status: "not_started" | "in_progress" | "completed",
  hasSeenNext: boolean
): WeekCardState {
  if (status === "completed") return "completed";
  if (!hasSeenNext) return "next";
  return "upcoming";
}

interface WeekRow {
  weekInstance: WeekInstance;
  name: string;
}

interface WeekDayItem {
  type: "session" | "rest";
  name: string;
}

interface ProgramCardData {
  template: SeasonTemplate;
  weekItems: WeekDayItem[];
  isLastUsed: boolean;
}

export default function SeasonPage() {
  const navigate = useNavigate();
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [programCards, setProgramCards] = useState<ProgramCardData[]>([]);
  const [seasonLabel, setSeasonLabel] = useState<string>("Season");
  const [totalWeeks, setTotalWeeks] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingStartTemplateId, setPendingStartTemplateId] = useState<string | null>(null);

  const loadSeasonPage = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [activeSeasonInstance, templates, allSessionTemplates, lastCompleted] =
        await Promise.all([
          getActiveSeasonInstance(),
          getSeasonTemplates(),
          getAllSessionTemplates(),
          getLastCompletedSeasonInstance(),
        ]);

      if (!activeSeasonInstance) {
        const sessionsBySeasonId = new Map<string, typeof allSessionTemplates>();
        for (const st of allSessionTemplates) {
          const bucket = sessionsBySeasonId.get(st.seasonTemplateId) ?? [];
          bucket.push(st);
          sessionsBySeasonId.set(st.seasonTemplateId, bucket);
        }

        const weekItemSets = await Promise.all(
          templates.map(async (template) => {
            const canonicalWeek = await getCanonicalWeekTemplateForSeason(template.id);
            if (!canonicalWeek) return [] as WeekDayItem[];
            const items = await getWeekTemplateItemsForWeekTemplate(canonicalWeek.id);
            const sessionMap = new Map(
              (sessionsBySeasonId.get(template.id) ?? []).map((s) => [s.id, s.name])
            );
            return items.map((item): WeekDayItem => ({
              type: item.type,
              name:
                item.type === "session"
                  ? (sessionMap.get(item.sessionTemplateId ?? "") ?? "Session")
                  : (item.label ?? "Rest"),
            }));
          })
        );

        const cards: ProgramCardData[] = templates.map((template, idx) => ({
          template,
          weekItems: weekItemSets[idx],
          isLastUsed: lastCompleted?.seasonTemplateId === template.id,
        }));

        setProgramCards(cards);
        setWeeks([]);
        setIsLoading(false);
        return;
      }

      const seasonTemplate = templates.find(
        (t) => t.id === activeSeasonInstance.seasonTemplateId
      );
      const rirSequence = seasonTemplate?.rirSequence ?? null;

      const weekInstances = await getWeekInstancesForSeasonInstance(
        activeSeasonInstance.id
      );

      const weekRows = weekInstances.map((wi) => {
        const rir = rirSequence?.[wi.order - 1];
        const name =
          rir != null ? `Week ${wi.order} — ${rir} RIR` : `Week ${wi.order}`;
        return { weekInstance: wi, name };
      });

      setWeeks(weekRows);
      setTotalWeeks(weekInstances.length);
      setSeasonLabel(activeSeasonInstance.name);
    } catch (error) {
      console.error(error);
      setErrorMessage("Could not load the current season.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSeasonPage();
  }, [loadSeasonPage]);

  async function handleConfirmStart(startedAt: string) {
    if (!pendingStartTemplateId) return;
    setPendingStartTemplateId(null);
    try {
      await startSeasonFromTemplate(pendingStartTemplateId, startedAt);
      await loadSeasonPage();
    } catch (error) {
      console.error(error);
      setErrorMessage("Could not start program.");
    }
  }

  const weekStates = useMemo<WeekCardState[]>(() => {
    let hasSeenNext = false;

    return weeks.map(({ weekInstance }) => {
      const state = getWeekState(weekInstance.status, hasSeenNext);
      if (state === "next") hasSeenNext = true;
      return state;
    });
  }, [weeks]);

  const headerLabel = useMemo(() => {
    if (totalWeeks == null) return seasonLabel;
    return `${seasonLabel} — ${totalWeeks} weeks`;
  }, [seasonLabel, totalWeeks]);

  if (isLoading) {
    return (
      <main className="season-page">
        <TopBar title="Season" />
        <section className="season-shell">
          <p>Loading season...</p>
        </section>
        <BottomNav activeTab="session" />
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="season-page">
        <TopBar title="Season" />
        <section className="season-shell">
          <p>{errorMessage}</p>
        </section>
        <BottomNav activeTab="session" />
      </main>
    );
  }

  const pendingTemplate = pendingStartTemplateId
    ? programCards.find((c) => c.template.id === pendingStartTemplateId)?.template
    : null;

  if (weeks.length === 0) {
    return (
      <>
        {pendingTemplate && (
          <StartSeasonModal
            programName={pendingTemplate.name}
            onConfirm={handleConfirmStart}
            onCancel={() => setPendingStartTemplateId(null)}
          />
        )}
        <main className="season-page">
          <TopBar title="Season" />
          <section className="season-shell">
            <header className="season-page__header">
              <h1 className="season-page__title">No active program</h1>
              <p className="season-page__subtitle">
                Start a program to begin tracking your sessions.
              </p>
            </header>
            {programCards.length > 0 && (
              <section className="season-page__content">
                <div className="season-page__list">
                  {programCards.map(({ template, weekItems, isLastUsed }) => {
                    const totalDays = template.plannedWeekCount * 7;
                    const trainingDays = weekItems.filter((i) => i.type === "session").length;
                    const restDays = weekItems.filter((i) => i.type === "rest").length;
                    const weekCount = template.plannedWeekCount;

                    return (
                      <article key={template.id} className="program-card">
                        <div className="program-card__header">
                          <h2 className="program-card__name">{template.name}</h2>
                          <button
                            type="button"
                            className="program-card__edit-btn"
                            onClick={() => navigate(`/config/programs/${template.id}`)}
                            aria-label={`Edit ${template.name}`}
                          >
                            Edit
                          </button>
                        </div>
                        <p className="program-card__meta">
                          {weekCount} {weekCount === 1 ? "training week" : "training weeks"}, 7 days each ({totalDays} days total)
                        </p>
                        {trainingDays > 0 && restDays > 0 && (
                          <p className="program-card__meta">
                            {restDays} {restDays === 1 ? "rest day" : "rest days"} for every {trainingDays} training {trainingDays === 1 ? "day" : "days"}
                          </p>
                        )}
                        {template.rirSequence && template.rirSequence.length > 0 && (
                          <p className="program-card__meta">
                            RIR {template.rirSequence.join(", ")}
                          </p>
                        )}
                        {weekItems.length > 0 && (
                          <details className="program-card__schedule">
                            <summary className="program-card__schedule-summary">
                              Weekly schedule
                            </summary>
                            <ol className="program-card__schedule-list">
                              {weekItems.map((item, i) => (
                                <li
                                  key={i}
                                  className={`program-card__schedule-day program-card__schedule-day--${item.type}`}
                                >
                                  <span className="program-card__schedule-day-num">Day {i + 1}</span>
                                  <span className="program-card__schedule-day-name">{item.name}</span>
                                </li>
                              ))}
                            </ol>
                          </details>
                        )}
                        <div className="program-card__footer">
                          <span className="program-card__last-used-slot">
                            {isLastUsed && (
                              <span className="program-card__last-used">
                                Previously used
                              </span>
                            )}
                          </span>
                          <button
                            type="button"
                            className="day-pill day-pill--start program-card__start-btn"
                            onClick={() => setPendingStartTemplateId(template.id)}
                          >
                            Start →
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
            <div className="season-page__new-program">
              <button
                type="button"
                className="season-page__new-program-btn"
                onClick={() => navigate("/config/programs")}
              >
                + New Program
              </button>
            </div>
          </section>
          <BottomNav activeTab="session" />
        </main>
      </>
    );
  }

  return (
    <main className="season-page">
      <TopBar title="Season" />

      <section className="season-shell">
        <header className="season-page__header">
          <h1 className="season-page__title">{headerLabel}</h1>
        </header>

        <section className="season-page__content">
          <div className="season-page__list">
            {weeks.map(({ weekInstance, name }, i) => (
              <WeekCard
                key={weekInstance.id}
                week={{
                  id: weekInstance.id,
                  name,
                  order: i + 1,
                }}
                state={weekStates[i]}
              />
            ))}
          </div>
        </section>
      </section>

      <BottomNav activeTab="session" />
    </main>
  );
}
