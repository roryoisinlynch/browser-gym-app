import { useEffect, useMemo, useState } from "react";
import BottomNav from "../components/BottomNav";
import DayCard, { type DayState } from "../components/DayCard";
import ProgressTrack from "../components/ProgressTrack";
import TopBar from "../components/TopBar";
import type { SessionInstanceListItem } from "../repositories/programRepository";
import {
  getSessionInstanceListItemsForCurrentWeek,
  getWeekTemplates,
} from "../repositories/programRepository";
import "./WeekPage.css";

function getDayState(
  status: "not_started" | "in_progress" | "completed",
  hasSeenNext: boolean
): DayState {
  if (status === "completed") {
    return "completed";
  }

  if (!hasSeenNext) {
    return "next";
  }

  return "upcoming";
}

export default function WeekPage() {
  const [items, setItems] = useState<SessionInstanceListItem[]>([]);
  const [totalWeeks, setTotalWeeks] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadWeekPage() {
      try {
        setErrorMessage(null);

        const [nextItems, weekTemplates] = await Promise.all([
          getSessionInstanceListItemsForCurrentWeek(),
          getWeekTemplates(),
        ]);

        setItems(nextItems);
        setTotalWeeks(weekTemplates.length);
      } catch (error) {
        console.error("Failed to load current week:", error);
        setErrorMessage("Could not load the current week.");
      } finally {
        setIsLoading(false);
      }
    }

    loadWeekPage();
  }, []);

  const dayStates = useMemo<DayState[]>(() => {
    let hasSeenNext = false;

    return items.map(({ sessionInstance }) => {
      const state = getDayState(sessionInstance.status, hasSeenNext);

      if (state === "next") {
        hasSeenNext = true;
      }

      return state;
    });
  }, [items]);

  const completedCount = useMemo(() => {
    return items.filter(
      ({ sessionInstance }) => sessionInstance.status === "completed"
    ).length;
  }, [items]);

  const weekLabel = useMemo(() => {
    if (items.length === 0 || totalWeeks == null) {
      return "Week";
    }

    const currentWeekNumber = items[0].weekInstance.order;
    return `Week ${currentWeekNumber} of ${totalWeeks}`;
  }, [items, totalWeeks]);

  if (isLoading) {
    return (
      <main className="week-page">
        <TopBar title="Week" />
        <section className="week-shell">
          <p className="week-page__message">Loading week...</p>
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
          <p className="week-page__message">{errorMessage}</p>
        </section>
        <BottomNav activeTab="session" />
      </main>
    );
  }

  return (
    <main className="week-page">
      <TopBar title="Week" />

      <section className="week-shell">
        <header className="week-page__header">
          <h1 className="week-page__title">{weekLabel}</h1>
          <p className="week-page__subtitle">
            {completedCount} / {items.length} sessions completed
          </p>

          {items.length > 0 && (
            <div className="week-page__progress">
              <div className="week-page__progress-row">
                <span className="week-page__progress-label">Progress</span>
                <span className="week-page__progress-value">
                  {completedCount} / {items.length}
                </span>
              </div>

              <ProgressTrack
                states={dayStates}
                ariaLabel={`Week progress: ${completedCount} of ${items.length} sessions completed`}
              />
            </div>
          )}
        </header>

        <section className="week-page__content">
          {items.length === 0 ? (
            <p className="week-page__message">No sessions found for this week.</p>
          ) : (
            <div className="week-page__list">
              {items.map(({ sessionInstance, sessionTemplate }, index) => (
                <DayCard
                  key={sessionInstance.id}
                  day={{
                    id: sessionInstance.id,
                    name: sessionTemplate.name,
                    order: index + 1,
                  }}
                  state={dayStates[index]}
                />
              ))}
            </div>
          )}
        </section>
      </section>

      <BottomNav activeTab="session" />
    </main>
  );
}