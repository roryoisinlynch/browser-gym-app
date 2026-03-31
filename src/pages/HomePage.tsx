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
  getSeasonInstanceById,
  getSessionInstanceListItemsForCurrentWeek,
} from "../repositories/programRepository";
import "./HomePage.css";

function getDayState(
  status: SessionInstanceListItem["sessionInstance"]["status"]
): DayState {
  if (status === "completed") return "completed";
  if (status === "in_progress") return "next";
  return "upcoming";
}

export default function HomePage() {
  const [weekTitle, setWeekTitle] = useState<string>("Week");
  const [seasonLabel, setSeasonLabel] = useState<string>("Season ?");
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

        const seasonInstance = await getSeasonInstanceById(
          currentWeekInstance.seasonInstanceId
        );

        setWeekTitle(`Week ${currentWeekInstance.order ?? "?"}`);
        setSeasonLabel(`Season ${seasonInstance?.order ?? "?"}`);

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

  const completedCount = sessionItems.filter(
    ({ sessionInstance }) => sessionInstance.status === "completed"
  ).length;

  const totalCount = sessionItems.length;

  return (
    <main className="home-page">
      <TopBar title="Week" />

      <section className="home-shell">
        <header className="home-header">
          <h1 className="home-title">{weekTitle}</h1>
          <p className="home-subtitle">{seasonLabel}</p>

          <p className="home-progress-label">
            {completedCount} / {totalCount} sessions completed
          </p>

          <ProgressTrack
            states={sessionItems.map(({ sessionInstance }) =>
              getDayState(sessionInstance.status)
            )}
            ariaLabel={`${completedCount} of ${totalCount} sessions completed`}
          />
        </header>

        <section className="day-list">
          {sessionItems.map(({ sessionInstance, sessionTemplate }) => (
            <DayCard
              key={sessionInstance.id}
              day={{
                id: sessionInstance.id,
                name: sessionTemplate.name,
                order: sessionTemplate.order,
              }}
              state={getDayState(sessionInstance.status)}
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