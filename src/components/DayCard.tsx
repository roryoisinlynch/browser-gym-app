import { Link } from "react-router-dom";
import "./DayCard.css";

export type DayState = "completed" | "next" | "upcoming";

export interface DayCardItem {
  id: string;
  name: string;
  order: number;
}

export default function DayCard({
  day,
  state,
}: {
  day: DayCardItem;
  state: DayState;
}) {
  return (
    <Link to={`/session/${day.id}`} className={`day-card day-card--${state}`}>
      <div className="day-card__text">
        <h2 className="day-card__title">{day.name}</h2>

        <p className="day-card__subtitle">
          {state === "completed" && "Completed"}
          {state === "next" && "Next session"}
          {state === "upcoming" && "Upcoming"}
        </p>
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