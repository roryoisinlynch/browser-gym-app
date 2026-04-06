import type { RagStatus } from "../services/sessionMetrics";
import TrafficLight from "./TrafficLight";
import "./WeeklyBreadcrumb.css";

export interface BreadcrumbSession {
  sessionInstanceId: string;
  ragStatus: RagStatus | null;
  isCurrent: boolean;
}

interface WeeklyBreadcrumbProps {
  sessions: BreadcrumbSession[];
}

export default function WeeklyBreadcrumb({ sessions }: WeeklyBreadcrumbProps) {
  if (sessions.length === 0) {
    return null;
  }

  return (
    <div className="weekly-breadcrumb" aria-label="Sessions this week">
      <p className="weekly-breadcrumb__label">Sessions this week</p>
      <div className="weekly-breadcrumb__trail">
        {sessions.map((session, index) => (
          <div key={session.sessionInstanceId} className="weekly-breadcrumb__item">
            {index > 0 && (
              <span className="weekly-breadcrumb__separator" aria-hidden="true" />
            )}
            <TrafficLight
              status={session.ragStatus ?? "grey"}
              size="sm"
              isCurrent={session.isCurrent}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
