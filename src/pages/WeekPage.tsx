import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import type { DayState } from "../components/DayCard";
import StartSeasonModal from "../components/StartSeasonModal";
import TopBar from "../components/TopBar";
import type { SeasonTemplate } from "../domain/models";
import type { WeekInstanceItemView } from "../repositories/programRepository";
import {
  getActiveSeasonInstance,
  getSeasonTemplates,
  getWeekInstanceItemsForCurrentWeek,
  startSeasonFromTemplate,
} from "../repositories/programRepository";
import "./WeekPage.css";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function getDayState(
  status: "not_started" | "in_progress" | "completed",
  hasSeenNext: boolean
): DayState {
  if (status === "completed") return "completed";
  if (!hasSeenNext) return "next";
  return "upcoming";
}

function localDayStart(iso: string): number {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function daysBetween(isoA: string, isoB: string): number {
  return Math.round((localDayStart(isoA) - localDayStart(isoB)) / 86400000);
}

function todayIso(): string {
  return new Date().toISOString();
}

/** Derive the calendar date for any item using a sibling session's date + order offset */
function deriveDate(item: WeekInstanceItemView, allItems: WeekInstanceItemView[]): Date | null {
  const ref = allItems.find((i) => i.sessionInstance?.date);
  if (!ref?.sessionInstance) return null;
  const refDate = new Date(ref.sessionInstance.date);
  const diff = item.weekInstanceItem.order - ref.weekInstanceItem.order;
  const d = new Date(refDate);
  d.setDate(d.getDate() + diff);
  return d;
}

function formatDateShort(d: Date): string {
  const dayNum = d.getDate();
  const mod100 = dayNum % 100;
  let suffix = "th";
  if (mod100 >= 11 && mod100 <= 13) suffix = "th";
  else {
    switch (dayNum % 10) {
      case 1: suffix = "st"; break;
      case 2: suffix = "nd"; break;
      case 3: suffix = "rd"; break;
    }
  }
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${dayNum}${suffix} ${months[d.getMonth()]}`;
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export default function WeekPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<WeekInstanceItemView[]>([]);
  const [seasonTemplates, setSeasonTemplates] = useState<SeasonTemplate[]>([]);
  const [totalWeeks, setTotalWeeks] = useState<number | null>(null);
  const [rirSequence, setRirSequence] = useState<number[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingStartTemplateId, setPendingStartTemplateId] = useState<string | null>(null);

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

      if (activeSeasonInstance) {
        const matchingTemplate = templates.find(
          (t) => t.id === activeSeasonInstance.seasonTemplateId
        );
        setTotalWeeks(matchingTemplate?.rirSequence?.length ?? null);
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

  async function handleConfirmStart(startedAt: string) {
    if (!pendingStartTemplateId) return;
    setPendingStartTemplateId(null);
    try {
      await startSeasonFromTemplate(pendingStartTemplateId, startedAt);
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
              Start a season from the Season page to begin tracking your sessions.
            </p>
          </header>
          <section className="week-page__content">
            <div className="week-page__list">
              <button
                className="week-start-card"
                onClick={() => navigate("/season")}
              >
                <span className="day-card__text">
                  <span className="day-card__title">Back to Season</span>
                </span>
                <span className="day-card__action">
                  <span className="day-pill day-pill--start">Go →</span>
                </span>
              </button>
            </div>
          </section>
        </section>
        <BottomNav activeTab="session" />
      </main>
    );
  }

  let sessionIndex = 0;

  const pendingTemplate = pendingStartTemplateId
    ? seasonTemplates.find((t) => t.id === pendingStartTemplateId)
    : null;

  return (
    <>
    {pendingTemplate && (
      <StartSeasonModal
        programName={pendingTemplate.name}
        onConfirm={handleConfirmStart}
        onCancel={() => setPendingStartTemplateId(null)}
      />
    )}
    <main className="week-page">
      <TopBar title="Week" backTo="/season" backLabel="Season" />

      <section className="week-shell">
        <header className="week-page__header">
          <h1 className="week-page__title">{weekLabel}</h1>

          {rirSequence && rirSequence.length > 0 && (
            <div className="week-page__rir-row">
              <span className="week-page__rir-label">RIR target</span>
              <div className="week-page__rir-track" aria-label="RIR progression">
              {rirSequence.map((rir, i) => (
                <div
                  key={i}
                  className={`week-page__rir-step${i === currentRirIndex ? " week-page__rir-step--current" : ""}`}
                >
                  <span className="week-page__rir-pip" />
                  <span className="week-page__rir-value">
                    {i === currentRirIndex
                      ? (items[0]?.weekInstance.rirTarget ?? rir)
                      : rir}
                  </span>
                </div>
              ))}
              </div>
            </div>
          )}
        </header>

        <section className="week-page__content">
          <div className="week-page__days">
            {items.map((item) => {
              const isRest = item.weekInstanceItem.type === "rest";
              const date = isRest
                ? deriveDate(item, items)
                : item.sessionInstance?.date
                  ? new Date(item.sessionInstance.date)
                  : null;

              const dayName = date ? DAY_NAMES[date.getDay()] : "";
              const dateShort = date ? formatDateShort(date) : "";

              if (isRest) {
                return (
                  <div key={item.weekInstanceItem.id} className="week-day week-day--rest">
                    <div className="week-day__header">
                      <span className="week-day__name">{dayName}</span>
                      <span className="week-day__date">{dateShort}</span>
                    </div>
                    <span className="week-day__activity">Rest</span>
                  </div>
                );
              }

              // Session
              const state = dayStates[sessionIndex];
              sessionIndex += 1;

              if (!item.sessionInstance || !item.sessionTemplate) return null;

              const scheduledDate = item.sessionInstance.date;
              const completedAt = item.sessionInstance.completedAt;

              // Adherence (completed)
              let caption: string | null = null;
              let captionColor: string | null = null;
              if (state === "completed" && scheduledDate && completedAt) {
                const delta = daysBetween(completedAt, scheduledDate);
                if (delta === 0) {
                  caption = "On schedule";
                  captionColor = "#4ade80";
                } else if (delta < 0) {
                  const n = Math.abs(delta);
                  caption = `${n} day${n === 1 ? "" : "s"} early`;
                  captionColor = "#f59e0b";
                } else {
                  caption = `${delta} day${delta === 1 ? "" : "s"} late`;
                  captionColor = "#f87171";
                }
              }

              // Urgency (next)
              if (state === "next" && scheduledDate) {
                const delta = daysBetween(scheduledDate, todayIso());
                if (delta < 0) {
                  const n = Math.abs(delta);
                  caption = `${n} day${n === 1 ? "" : "s"} overdue`;
                  captionColor = "#f87171";
                } else if (delta === 0) {
                  caption = "Today";
                  captionColor = "var(--accent)";
                } else {
                  caption = `In ${delta} day${delta === 1 ? "" : "s"}`;
                  captionColor = "var(--text-muted)";
                }
              }

              return (
                <Link
                  key={item.sessionInstance.id}
                  to={`/session/${item.sessionInstance.id}`}
                  className={`week-day week-day--session week-day--${state}`}
                >
                  <div className="week-day__left">
                    <div className="week-day__header">
                      <span className="week-day__name">{dayName}</span>
                      <span className="week-day__date">{dateShort}</span>
                    </div>
                    <span className="week-day__activity">{item.sessionTemplate.name}</span>
                    {caption && (
                      <span className="week-day__caption" style={{ color: captionColor ?? undefined }}>
                        {caption}
                      </span>
                    )}
                  </div>
                  <div className="week-day__right">
                    {state === "completed" && (
                      <span className="day-pill day-pill--done">Done</span>
                    )}
                    {state === "next" && (
                      <span className="day-pill day-pill--start">Start</span>
                    )}
                    {state === "upcoming" && (
                      <span className="day-pill day-pill--view">View ›</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </section>

      <BottomNav activeTab="session" />
    </main>
    </>
  );
}
