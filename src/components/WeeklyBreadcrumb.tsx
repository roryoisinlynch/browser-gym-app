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
            <div className="weekly-breadcrumb__dot">
              {/* Size comes from WeeklyBreadcrumb.css, which overrides the
                  Medal size variants at equal specificity but later in the
                  cascade — so this prop has no effect on the icon here. */}
              <Medal
                status={session.ragStatus ?? "grey"}
                size="sm"
                isCurrent={session.isCurrent}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
