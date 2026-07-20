import type { RagStatus } from "../services/sessionMetrics";
import Medal from "./Medal";
import "./WeeklyBreadcrumb.css";

export interface BreadcrumbSession {
  sessionInstanceId: string;
  ragStatus: RagStatus | "skipped" | null;
  isCurrent: boolean;
}

interface WeeklyBreadcrumbProps {
  sessions: BreadcrumbSession[];
  /** Bumped on the summary reports, where the trail is a section of its own. */
  medalSize?: "sm" | "md" | "lg";
}

export default function WeeklyBreadcrumb({
  sessions,
  medalSize = "sm",
}: WeeklyBreadcrumbProps) {
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
            <div className="weekly-breadcrumb__dot">
              <Medal
                status={session.ragStatus ?? "grey"}
                size={medalSize}
                isCurrent={session.isCurrent}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
