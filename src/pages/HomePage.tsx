import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DayCard from "../components/DayCard";
import type { DayState } from "../components/DayCard";
import ProgressTrack from "../components/ProgressTrack";
import BottomNav from "../components/BottomNav";
import TopBar from "../components/TopBar";
import type { SessionInstanceListItem } from "../repositories/programRepository";
import {
  getCurrentWeekInstance,
  getSessionInstanceListItemsForCurrentWeek,
  getWeekTemplateById,
} from "../repositories/programRepository";
import "./HomePage.css";

const lastCompletedIndex = 1;

function getDayState(index: number): DayState {
  if (index <= lastCompletedIndex) return "completed";
  if (index === lastCompletedIndex + 1) return "next";
  return "upcoming";
}

export default function HomePage() {
  const [currentWeekLabel, setCurrentWeekLabel] = useState<string>("Current week");
  const [sessionItems, setSessionItems] = useState<SessionInstanceListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadHomePage() {
      try {
        const currentWeekInstance = await getCurrentWeekInstance();

        if (!currentWeekInstance) {
          setErrorMessage("Could not find the current week.");
          return;
        }

        const weekTemplate = await getWeekTemplateById(
          currentWeekInstance.weekTemplateId
        );

        if (weekTemplate) {
          setCurrentWeekLabel(weekTemplate.label ?? weekTemplate.name);
        }

        const items = await getSessionInstanceListItemsForCurrentWeek();
        setSessionItems(items);
      } catch (error) {
        console.error("Failed to load home page:", error);
        setErrorMessage("Could not load your program.");
      } finally {
        setIsLoading(false);
      }
    }

    loadHomePage();
  }, []);

  if (isLoading) {
    return (
      <main className="home-page">
        <TopBar title="Week" />
        <section className="home-shell">
          <p>Loading program...</p>
        </section>
        <BottomNav activeTab="none" />
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="home-page">
        <TopBar title="Week" />
        <section className="home-shell">
          <p>{errorMessage}</p>
        </section>
        <BottomNav activeTab="none" />
      </main>
    );
  }

  const completedCount = Math.min(lastCompletedIndex + 1, sessionItems.length);
  const totalCount = sessionItems.length;

  return (
    <main className="home-page">
      <TopBar title="Week" />

      <section className="home-shell">
        <header className="home-header">
          <p className="home-subtitle">{currentWeekLabel}</p>
          <p className="home-progress-label">
            {completedCount} / {totalCount} sessions completed
          </p>

          <ProgressTrack
            states={sessionItems.map((_, index) => getDayState(index))}
            ariaLabel={`${completedCount} of ${totalCount} sessions completed`}
          />
        </header>

        <section className="day-list">
          {sessionItems.map(({ sessionInstance, sessionTemplate }, index) => (
            <DayCard
              key={sessionInstance.id}
              day={{
                id: sessionInstance.id,
                name: sessionTemplate.name,
                order: sessionTemplate.order,
              }}
              state={getDayState(index)}
            />
          ))}
        </section>

        <footer className="home-footer">
          <Link to="/config/program" className="text-link">
            Edit program
          </Link>
        </footer>
      </section>

      <BottomNav activeTab="none" />
    </main>
  );
}