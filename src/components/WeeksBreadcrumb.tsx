import { emojiForRating } from "../services/weekMetrics";
import type { EmojiRating } from "../services/weekMetrics";
import "./WeeksBreadcrumb.css";

export interface BreadcrumbWeek {
  weekInstanceId: string;
  emojiRating: EmojiRating | null;
  isCurrent: boolean;
  endedEarly?: boolean;
}

interface WeeksBreadcrumbProps {
  weeks: BreadcrumbWeek[];
}

export default function WeeksBreadcrumb({ weeks }: WeeksBreadcrumbProps) {
  if (weeks.length === 0) return null;

  return (
    <div className="weeks-breadcrumb" aria-label="Weeks this season">
      <p className="weeks-breadcrumb__label">Weeks this season</p>
      <div className="weeks-breadcrumb__trail">
        {weeks.map((week, index) => (
          <div key={week.weekInstanceId} className="weeks-breadcrumb__item">
            {index > 0 && (
              <span className="weeks-breadcrumb__separator" aria-hidden="true" />
            )}
            <div className="weeks-breadcrumb__dot">
              <span
                className={`weeks-breadcrumb__emoji${week.isCurrent ? " weeks-breadcrumb__emoji--current" : ""}${week.endedEarly ? " weeks-breadcrumb__emoji--ended-early" : ""}`}
                aria-label={
                  week.endedEarly
                    ? "Week ended early"
                    : week.emojiRating != null
                    ? `Week rating ${week.emojiRating}`
                    : "Not yet completed"
                }
              >
                {week.emojiRating != null ? emojiForRating(week.emojiRating) : "○"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
