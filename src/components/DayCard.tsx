import { Link } from "react-router-dom";
import "./DayCard.css";

export type DayState = "completed" | "next" | "upcoming";

export interface DayCardItem {
  id: string;
  name: string;
  order: number;
}

function ordinalSuffix(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  switch (n % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

function formatScheduledDate(iso: string): string {
  const d = new Date(iso);
  const dayName = d.toLocaleDateString(undefined, { weekday: "long" });
  const dayNum = d.getDate();
  return `${dayName} ${dayNum}${ordinalSuffix(dayNum)}`;
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

export default function DayCard({
  day,
  state,
  scheduledDate,
  completedAt,
}: {
  day: DayCardItem;
  state: DayState;
  scheduledDate?: string;
  completedAt?: string | null;
}) {
  const dateLabel = scheduledDate ? formatScheduledDate(scheduledDate) : null;

  // Adherence chip for completed sessions (completed date vs scheduled date)
  let adherenceLabel: string | null = null;
  let adherenceColor: string | null = null;
  if (state === "completed" && scheduledDate && completedAt) {
    const delta = daysBetween(completedAt, scheduledDate);
    if (delta === 0) {
      adherenceLabel = "On schedule";
      adherenceColor = "#4ade80";
    } else if (delta < 0) {
      const n = Math.abs(delta);
      adherenceLabel = `${n} day${n === 1 ? "" : "s"} early`;
      adherenceColor = "#f59e0b";
    } else {
      adherenceLabel = `${delta} day${delta === 1 ? "" : "s"} late`;
      adherenceColor = "#f87171";
    }
  }

  // Urgency line for next session (scheduled date vs today)
  let urgencyLabel: string | null = null;
  let urgencyColor: string | null = null;
  if (state === "next" && scheduledDate) {
    const delta = daysBetween(scheduledDate, todayIso());
    if (delta < 0) {
      const n = Math.abs(delta);
      urgencyLabel = `${n} day${n === 1 ? "" : "s"} overdue`;
      urgencyColor = "#f87171";
    } else if (delta === 0) {
      urgencyLabel = "Today";
      urgencyColor = "var(--accent)";
    } else {
      urgencyLabel = `In ${delta} day${delta === 1 ? "" : "s"}`;
      urgencyColor = "var(--text-muted)";
    }
  }

  return (
    <Link to={`/session/${day.id}`} className={`day-card day-card--${state}`}>
      <div className="day-card__text">
        <h2 className="day-card__title">{day.name}</h2>

        {dateLabel ? (
          <>
            <p className="day-card__subtitle">{dateLabel}</p>
            {(adherenceLabel || urgencyLabel) && (
              <p
                className="day-card__indicator"
                style={{ color: (adherenceColor ?? urgencyColor) ?? undefined }}
              >
                {adherenceLabel ?? urgencyLabel}
              </p>
            )}
          </>
        ) : (
          <p className="day-card__subtitle">
            {state === "completed" && "Completed"}
            {state === "next" && "Next session"}
            {state === "upcoming" && "Upcoming"}
          </p>
        )}
      </div>

      <div className="day-card__action">
        {state === "completed" && (
          <span className="day-pill day-pill--done">Done</span>
        )}
        {state === "next" && (
          <span className="day-pill day-pill--start">Start Session</span>
        )}
        {state === "upcoming" && (
          <span className="day-pill day-pill--view">
            View <span className="day-pill__arrow">›</span>
          </span>
        )}
      </div>
    </Link>
  );
}
