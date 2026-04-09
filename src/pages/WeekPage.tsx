import { useCallback, useEffect, useMemo, useState } from "react";
import BottomNav from "../components/BottomNav";
import DayCard, { type DayState } from "../components/DayCard";
import TopBar from "../components/TopBar";
import type { SeasonTemplate } from "../domain/models";
import type { WeekInstanceItemView } from "../repositories/programRepository";
import {
  getActiveSeasonInstance,
  getSeasonTemplates,
  getWeekInstanceItemsForCurrentWeek,
  getWeekInstancesForSeasonInstance,
  startSeasonFromTemplate,
} from "../repositories/programRepository";
import "./WeekPage.css";

function getDayState(
  status: "not_started" | "in_progress" | "completed",
  hasSeenNext: boolean
): DayState {
  if (status === "completed") return "completed";
  if (!hasSeenNext) return "next";
  return "upcoming";
}

export default function WeekPage() {
  const [items, setItems] = useState<WeekInstanceItemView[]>([]);
  const [seasonTemplates, setSeasonTemplates] = useState<SeasonTemplate[]>([]);
  const [totalWeeks, setTotalWeeks] = useState<number | null>(null);
  const [rirSequence, setRirSequence] = useState<number[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadWeekPage = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [weekItems, templates, activeSeasonInstance] = await Promise.all([
        getWeekInstanceItemsForCurrentWeek(),
        getSeasonTemplates(),
        getActiveSeasonInstance(),
      ]);

      setItems(weekItems);
      setSeasonTemplates(templates);

      if (weekItems.length > 0) {
        const seasonInstanceId = weekItems[0].weekInstance.seasonInstanceId;
        const allWeekInstances = await getWeekInstancesForSeasonInstance(seasonInstanceId);
        setTotalWeeks(allWeekInstances.length);
      }

      if (activeSeasonInstance) {
        const matchingTemplate = templates.find(
          (t) => t.id === activeSeasonInstance.seasonTemplateId
        );
        setRirSequence(matchingTemplate?.rirSequence ?? null);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage("Could not load the current week.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWeekPage();
  }, [loadWeekPage]);

  async function handleStartSeason(seasonTemplateId: string) {
    try {
      await startSeasonFromTemplate(seasonTemplateId);
      await loadWeekPage();
    } catch (error) {
      console.error(error);
      setErrorMessage("Could not start program.");
    }
  }

  const sessionItems = useMemo(
    () => items.filter((item) => item.weekInstanceItem.type === "session"),
    [items]
  );

  const dayStates = useMemo<DayState[]>(() => {
    let hasSeenNext = false;

    return sessionItems.map(({ sessionInstance }) => {
      const status = sessionInstance?.status ?? "not_started";
      const state = getDayState(status, hasSeenNext);

      if (state === "next") hasSeenNext = true;

      return state;
    });
  }, [sessionItems]);

  const currentRirIndex = useMemo(() => {
    if (items.length === 0) return -1;
    return items[0].weekInstance.order - 1;
  }, [items]);

  const weekLabel = useMemo(() => {
    if (items.length === 0 || totalWeeks == null) return "Week";

    const weekNumber = items[0].weekInstance.order;
    return `Week ${weekNumber} of ${totalWeeks}`;
  }, [items, totalWeeks]);

  if (isLoading) {
    return (
      <main className="week-page">
        <TopBar title="Week" backTo="/season" backLabel="Season" />
        <section className="week-shell">
          <p>Loading week...</p>
        </section>
        <BottomNav activeTab="session" />
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="week-page">
        <TopBar title="Week" backTo="/season" backLabel="Season" />
        <section className="week-shell">
          <p>{errorMessage}</p>
        </section>
        <BottomNav activeTab="session" />
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="week-page">
        <TopBar title="Week" backTo="/season" backLabel="Season" />
        <section className="week-shell">
          <header className="week-page__header">
            <h1 className="week-page__title">No active program</h1>
            <p className="week-page__subtitle">
              Start a program to begin tracking your sessions.
            </p>
          </header>
          {seasonTemplates.length > 0 && (
            <section className="week-page__content">
              <div className="week-page__list">
                {seasonTemplates.map((template) => (
                  <button
                    key={template.id}
                    className="week-start-card"
                    onClick={() => handleStartSeason(template.id)}
                  >
                    <span className="day-card__text">
                      <span className="day-card__title">{template.name}</span>
                      {template.description && (
                        <span className="day-card__subtitle">
                          {template.description}
                        </span>
                      )}
                    </span>
                    <span className="day-card__action">
                      <span className="day-pill day-pill--start">Start →</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </section>
        <BottomNav activeTab="session" />
      </main>
    );
  }

  let sessionIndex = 0;

  return (
    <main className="week-page">
      <TopBar title="Week" backTo="/season" backLabel="Season" />

      <section className="week-shell">
        <header className="week-page__header">
          <h1 className="week-page__title">{weekLabel}</h1>

          {rirSequence && rirSequence.length > 0 && (
            <div className="week-page__rir-track" aria-label="RIR progression">
              {rirSequence.map((rir, i) => (
                <div
                  key={i}
                  className={`week-page__rir-step${i === currentRirIndex ? " week-page__rir-step--current" : ""}`}
                >
                  <span className="week-page__rir-pip" />
                  <span className="week-page__rir-value">{rir}</span>
                </div>
              ))}
            </div>
          )}
        </header>

        <section className="week-page__content">
          <div className="week-page__list">
            {items.map((item) => {
              if (item.weekInstanceItem.type === "rest") {
                return (
                  <div
                    key={item.weekInstanceItem.id}
                    className="week-rest-divider"
                  >
                    {item.weekInstanceItem.label ?? "Rest Day"}
                  </div>
                );
              }

              const state = dayStates[sessionIndex];
              const index = sessionIndex;
              sessionIndex += 1;

              if (!item.sessionInstance || !item.sessionTemplate) {
                return null;
              }

              return (
                <DayCard
                  key={item.sessionInstance.id}
                  day={{
                    id: item.sessionInstance.id,
                    name: item.sessionTemplate.name,
                    order: index + 1,
                  }}
                  state={state}
                  scheduledDate={item.sessionInstance.date}
                  completedAt={item.sessionInstance.completedAt}
                />
              );
            })}
          </div>
        </section>
      </section>

      <BottomNav activeTab="session" />
    </main>
  );
}