import { Link } from "react-router-dom";
import "./DayCard.css";

export type WeekCardState = "completed" | "next" | "upcoming";

export interface WeekCardItem {
  id: string;
  name: string;
  order: number;
}

export default function WeekCard({
  week,
  state,
}: {
  week: WeekCardItem;
  state: WeekCardState;
}) {
  return (
    <Link to={`/week/${week.id}`} className={`day-card day-card--${state}`}>
      <div className="day-card__text">
        <h2 className="day-card__title">{week.name}</h2>

        <p className="day-card__subtitle">
          {state === "completed" && "Completed"}
          {state === "next" && "Current week"}
          {state === "upcoming" && "Upcoming"}
        </p>
      </div>

      <div className="day-card__action">
        {state === "completed" && (
          <span className="day-pill day-pill--done">Done</span>
        )}

        {state === "next" && (
          <span className="day-pill day-pill--start">Go to Week</span>
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
