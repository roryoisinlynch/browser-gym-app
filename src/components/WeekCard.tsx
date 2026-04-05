import { Link } from "react-router-dom";
import "./DayCard.css";
import "./WeekCard.css";

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
  const inner = (
    <>
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
          <span className="day-pill day-pill--view week-card__pill--dim">
            Upcoming
          </span>
        )}
      </div>
    </>
  );

  if (state === "next") {
    return (
      <Link to="/week" className="day-card day-card--next">
        {inner}
      </Link>
    );
  }

  return (
    <div className={`day-card day-card--${state} week-card--static`}>
      {inner}
    </div>
  );
}
