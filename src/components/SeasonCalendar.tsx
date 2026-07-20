import useInView from "../hooks/useInView";
import "./SeasonCalendar.css";

export type SeasonDayStatus = "done" | "skipped" | "both";

export interface SeasonMonth {
  year: number;
  /** 0-indexed, as per Date. */
  month: number;
}

interface SeasonCalendarProps {
  months: SeasonMonth[];
  /** Local "YYYY-MM-DD" -> what happened, by the date it actually happened. */
  dayStatus: Map<string, SeasonDayStatus>;
  seasonStartIso: string;
  seasonEndIso: string;
  /** Null for ended seasons, so no ring is drawn outside the season window. */
  todayIso: string | null;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isoFor(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function MonthGrid({
  year,
  month,
  dayStatus,
  seasonStartIso,
  seasonEndIso,
  todayIso,
}: SeasonMonth & Omit<SeasonCalendarProps, "months">) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Monday-based weekday of the 1st: getDay() is Sunday-based, so rotate by 6.
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;

  return (
    <div className="ss-cal__month">
      <span className="ss-cal__month-label">{MONTH_NAMES[month]}</span>
      <div className="ss-cal__grid" aria-hidden="true">
        {Array.from({ length: lead }, (_, i) => (
          <span key={`pad-${i}`} className="ss-cal__cell ss-cal__cell--pad" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const iso = isoFor(year, month, day);
          const outside = iso < seasonStartIso || iso > seasonEndIso;
          const status = dayStatus.get(iso);
          const classes = ["ss-cal__cell"];
          if (outside) classes.push("ss-cal__cell--outside");
          if (status) classes.push(`ss-cal__cell--${status}`);
          if (todayIso && iso === todayIso) classes.push("ss-cal__cell--today");
          return (
            <span
              key={iso}
              className={classes.join(" ")}
              // Column index drives a left-to-right sweep; a per-cell stagger
              // would take seconds to cross a multi-month season.
              style={{ "--c": Math.floor((lead + i) / 7) } as React.CSSProperties}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * Every calendar month the season touched, two per row, with a square filled on
 * each day a session actually landed — not the day it was scheduled for. A
 * season that drifts off its template shows that drift here.
 */
export default function SeasonCalendar({
  months,
  dayStatus,
  seasonStartIso,
  seasonEndIso,
  todayIso,
}: SeasonCalendarProps) {
  const [ref, inView] = useInView<HTMLDivElement>();
  if (months.length === 0) return null;

  const statuses = new Set(dayStatus.values());
  const hasDone = statuses.has("done") || statuses.has("both");
  const hasSkipped = statuses.has("skipped") || statuses.has("both");

  return (
    <div className={`ss-cal${inView ? " is-in" : ""}`} ref={ref}>
      <div className="ss-cal__months">
        {months.map((m) => (
          <MonthGrid
            key={`${m.year}-${m.month}`}
            year={m.year}
            month={m.month}
            dayStatus={dayStatus}
            seasonStartIso={seasonStartIso}
            seasonEndIso={seasonEndIso}
            todayIso={todayIso}
          />
        ))}
      </div>
      {(hasDone || hasSkipped) && (
        <div className="ss-cal__legend">
          {hasDone && (
            <span className="ss-cal__legend-item">
              <span className="ss-cal__legend-swatch ss-cal__legend-swatch--done" />
              Trained
            </span>
          )}
          {hasSkipped && (
            <span className="ss-cal__legend-item">
              <span className="ss-cal__legend-swatch ss-cal__legend-swatch--skipped" />
              Skipped
            </span>
          )}
        </div>
      )}
    </div>
  );
}
