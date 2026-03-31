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
  if (status === "completed") return "completed";
  if (!hasSeenNext) return "next";
  return "upcoming";
}

function daysBetween(a: string, b: string) {
  const aDate = new Date(a);
  const bDate = new Date(b);
  const diff = bDate.getTime() - aDate.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

export default function WeekPage() {
  const [items, setItems] = useState<SessionInstanceListItem[]>([]);
  const [totalWeeks, setTotalWeeks] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadWeekPage() {
      try {
        const [sessions, weeks] = await Promise.all([
          getSessionInstanceListItemsForCurrentWeek(),
          getWeekTemplates(),
        ]);

        const sorted = [...sessions].sort((a, b) =>
          a.sessionInstance.date.localeCompare(b.sessionInstance.date)
        );

        setItems(sorted);
        setTotalWeeks(weeks.length);
      } catch (error) {
        console.error(error);
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

      if (state === "next") hasSeenNext = true;

      return state;
    });
  }, [items]);

  const completedCount = useMemo(() => {
    return items.filter(
      ({ sessionInstance }) => sessionInstance.status === "completed"
    ).length;
  }, [items]);

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

  return (
    <main className="week-page">
      <TopBar title="Week" />

      <section className="week-shell">
        <header className="week-page__header">
          <h1 className="week-page__title">{weekLabel}</h1>
          <p className="week-page__subtitle">
            {completedCount} / {items.length} sessions completed
          </p>

          <ProgressTrack
            states={dayStates}
            ariaLabel={`Week progress: ${completedCount} of ${items.length} sessions completed`}
          />
        </header>

        <section className="week-page__content">
          <div className="week-page__list">
            {items.map((item, index) => {
              const prev = items[index - 1];

              const showRestDivider =
                prev &&
                daysBetween(prev.sessionInstance.date, item.sessionInstance.date) > 1;

              return (
                <div key={item.sessionInstance.id}>
                  {showRestDivider && (
                    <div className="week-rest-divider">Rest Day</div>
                  )}

                  <DayCard
                    day={{
                      id: item.sessionInstance.id,
                      name: item.sessionTemplate.name,
                      order: index + 1,
                    }}
                    state={dayStates[index]}
                  />
                </div>
              );
            })}
          </div>
        </section>
      </section>

      <BottomNav activeTab="session" />
    </main>
  );
}