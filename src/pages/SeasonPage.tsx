import { useCallback, useEffect, useMemo, useState } from "react";
import BottomNav from "../components/BottomNav";
import StartSeasonModal from "../components/StartSeasonModal";
import WeekCard, { type WeekCardState } from "../components/WeekCard";
import TopBar from "../components/TopBar";
import type { SeasonTemplate, WeekInstance } from "../domain/models";
import {
  getActiveSeasonInstance,
  getSeasonTemplates,
  getWeekInstancesForSeasonInstance,
  startSeasonFromTemplate,
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

export default function SeasonPage() {
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [seasonTemplates, setSeasonTemplates] = useState<SeasonTemplate[]>([]);
  const [seasonLabel, setSeasonLabel] = useState<string>("Season");
  const [totalWeeks, setTotalWeeks] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingStartTemplateId, setPendingStartTemplateId] = useState<string | null>(null);

  const loadSeasonPage = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [activeSeasonInstance, templates] = await Promise.all([
        getActiveSeasonInstance(),
        getSeasonTemplates(),
      ]);

      setSeasonTemplates(templates);

      if (!activeSeasonInstance) {
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
    ? seasonTemplates.find((t) => t.id === pendingStartTemplateId)
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
          {seasonTemplates.length > 0 && (
            <section className="season-page__content">
              <div className="season-page__list">
                {seasonTemplates.map((template) => (
                  <button
                    key={template.id}
                    className="week-start-card"
                    onClick={() => setPendingStartTemplateId(template.id)}
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
