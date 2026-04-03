import { useCallback, useEffect, useMemo, useState } from "react";
import BottomNav from "../components/BottomNav";
import DayCard, { type DayState } from "../components/DayCard";
import ProgressTrack from "../components/ProgressTrack";
import TopBar from "../components/TopBar";
import type { SeasonTemplate } from "../domain/models";
import type { WeekInstanceItemView } from "../repositories/programRepository";
import {
  getSeasonTemplates,
  getWeekInstanceItemsForCurrentWeek,
  getWeekTemplates,
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
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadWeekPage = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [weekItems, weeks, templates] = await Promise.all([
        getWeekInstanceItemsForCurrentWeek(),
        getWeekTemplates(),
        getSeasonTemplates(),
      ]);

      setItems(weekItems);
      setTotalWeeks(weeks.length);
      setSeasonTemplates(templates);
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

  const completedCount = useMemo(() => {
    return sessionItems.filter(
      ({ sessionInstance }) => sessionInstance?.status === "completed"
    ).length;
  }, [sessionItems]);

  const weekLabel = useMemo(() => {
    if (items.length === 0 || totalWeeks == null) return "Week";

    const weekNumber = items[0].weekInstance.order;
    return `Week ${weekNumber} of ${totalWeeks}`;
  }, [items, totalWeeks]);

  if (isLoading) {
    return (
      <main className="week-page">
        <TopBar title="Week" />
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
        <TopBar title="Week" />
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
        <TopBar title="Week" />
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
      <TopBar title="Week" />

      <section className="week-shell">
        <header className="week-page__header">
          <h1 className="week-page__title">{weekLabel}</h1>
          <p className="week-page__subtitle">
            {completedCount} / {sessionItems.length} sessions completed
          </p>

          <ProgressTrack
            states={dayStates}
            ariaLabel={`Week progress: ${completedCount} of ${sessionItems.length} sessions completed`}
          />
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