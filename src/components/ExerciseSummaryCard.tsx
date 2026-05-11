import "./ExerciseSummaryCard.css";
import ExerciseRepDashProgress from "./ExerciseRepDashProgress";
import ExerciseRepDashProgressBodyweight from "./ExerciseRepDashProgressBodyweight";

interface ExerciseSummaryCardProps {
  targetRir: number | null;
  targetWeight: number | null;
  targetReps: number | null;
  targetEstimatedOneRepMax: number | null;
  topSetEstimatedOneRepMax: number | null;
  historicalBestEstimatedOneRepMax: number | null;
  historicalBestDate: string | null;
  recentMaxEstimatedOneRepMax: number | null;
  recentMaxDate: string | null;
  isBodyweight?: boolean;
  historicalBestReps?: number | null;
  topSetReps?: number | null;
  recentMaxReps?: number | null;
  recentMaxRepsDate?: string | null;
  isAmrap?: boolean;
  isBodyweightAmrap?: boolean;
}

function formatMetricValue(value: number | null, suffix = ""): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }

  return `${Number.isInteger(value) ? value : value.toFixed(1)}${suffix}`;
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function daysSince(isoDate: string): number {
  return Math.round(
    (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24)
  );
}

// Phrasing buckets:
//   < 6 months   →  "N days ago"
//   < 2 years    →  "N months ago" (round to nearest 30-day month)
//   ≥ 2 years    →  "over N years ago" for first half of the year,
//                   "almost N+1 years ago" for the second half.
function formatTimeAgo(isoDate: string): string {
  const days = daysSince(isoDate);
  if (days < 180) {
    return `${days} ${days === 1 ? "day" : "days"} ago`;
  }
  if (days < 730) {
    const months = Math.round(days / 30);
    return `${months} months ago`;
  }
  const years = days / 365;
  const floorYears = Math.floor(years);
  const fraction = years - floorYears;
  return fraction <= 0.5
    ? `over ${floorYears} years ago`
    : `almost ${floorYears + 1} years ago`;
}

export default function ExerciseSummaryCard({
  targetRir,
  targetWeight,
  targetReps,
  targetEstimatedOneRepMax,
  topSetEstimatedOneRepMax,
  historicalBestEstimatedOneRepMax,
  historicalBestDate,
  recentMaxEstimatedOneRepMax,
  recentMaxDate,
  isBodyweight = false,
  historicalBestReps = null,
  topSetReps = null,
  recentMaxReps = null,
  recentMaxRepsDate = null,
  isAmrap = false,
  isBodyweightAmrap = false,
}: ExerciseSummaryCardProps) {
  if (isAmrap || isBodyweightAmrap) {
    return (
      <section className="exercise-summary-card">
        <div className="exercise-summary-card__target-block">
          <strong className="exercise-summary-card__target-value">AMRAP</strong>
          <p className="exercise-summary-card__target-secondary">
            {isAmrap
              ? "Choose a challenging weight and lift for as many reps as possible. Your e1RM will be calculated from this session and used to prescribe future sessions."
              : "Lift for as many reps as possible. Your best reps will be recorded and used to prescribe future sessions."}
          </p>
        </div>
      </section>
    );
  }

  const recentMaxRepsBanner =
    recentMaxReps != null && recentMaxRepsDate != null
      ? (() => {
          const historicalStr = historicalBestReps != null ? `${historicalBestReps} reps` : null;
          const recentStr = `${recentMaxReps} reps`;
          const recentDateStr = formatDate(recentMaxRepsDate);
          const recentTimeAgo = formatTimeAgo(recentMaxRepsDate);

          const historicalContext = historicalStr
            ? `Your all-time best of ${historicalStr} hasn't been matched in a while.`
            : null;

          return (
            <div className="exercise-summary-card__recent-max-banner" role="note">
              <p className="exercise-summary-card__recent-max-heading">
                Using recent best for targets
              </p>
              <p className="exercise-summary-card__recent-max-body">
                {historicalContext}{historicalContext ? " " : ""}Today&apos;s targets are based on your more
                recent best of <strong>{recentStr}</strong> ({recentDateStr},{" "}
                {recentTimeAgo}) to keep your training load fair and
                sustainable.
              </p>
            </div>
          );
        })()
      : null;

  const recentMaxBanner =
    recentMaxEstimatedOneRepMax != null && recentMaxDate != null
      ? (() => {
          const historicalStr = formatMetricValue(
            historicalBestEstimatedOneRepMax,
            "kg"
          );
          const recentStr = formatMetricValue(
            recentMaxEstimatedOneRepMax,
            "kg"
          );
          const recentDateStr = formatDate(recentMaxDate);
          const recentTimeAgo = formatTimeAgo(recentMaxDate);

          const historicalContext =
            historicalBestDate != null
              ? `Your all-time PR of ${historicalStr} (set ${formatTimeAgo(
                  historicalBestDate
                )}) hasn't been matched in a while.`
              : `Your all-time PR of ${historicalStr} is from your imported training history.`;

          return (
            <div className="exercise-summary-card__recent-max-banner" role="note">
              <p className="exercise-summary-card__recent-max-heading">
                Using recent best for targets
              </p>
              <p className="exercise-summary-card__recent-max-body">
                {historicalContext} Today&apos;s targets are based on your more
                recent best of <strong>{recentStr}</strong> ({recentDateStr},{" "}
                {recentTimeAgo}) to keep your training load fair and
                sustainable.
              </p>
            </div>
          );
        })()
      : null;

  return (
    <section className="exercise-summary-card">
      <div className="exercise-summary-card__target-header">
        <div className="exercise-summary-card__target-caption-block">
          <p className="exercise-summary-card__target-caption">
            Today’s target
          </p>
          <p className="exercise-summary-card__target-secondary">
            {isBodyweight
              ? "Bodyweight reps"
              : `${formatMetricValue(targetEstimatedOneRepMax, "kg")} e1RM`}
          </p>
        </div>
        <strong className="exercise-summary-card__target-value">
          {isBodyweight
            ? targetReps == null
              ? "—"
              : `${targetReps} reps`
            : targetWeight == null || targetReps == null
              ? "—"
              : `${formatMetricValue(targetWeight, "kg")} × ${formatMetricValue(targetReps)}`}
        </strong>
      </div>

      <hr className="exercise-summary-card__divider" />

      {!isBodyweight && (
        <ExerciseRepDashProgress
          workingWeight={targetWeight}
          targetReps={targetReps}
          targetRir={targetRir}
          topSetEstimatedOneRepMax={topSetEstimatedOneRepMax}
          historicalBestEstimatedOneRepMax={historicalBestEstimatedOneRepMax}
          effectiveEstimatedOneRepMax={recentMaxEstimatedOneRepMax}
        />
      )}

      {isBodyweight && historicalBestReps != null && targetReps != null && (
        <ExerciseRepDashProgressBodyweight
          historicalBestReps={historicalBestReps}
          recentMaxReps={recentMaxReps}
          targetReps={targetReps}
          targetRir={targetRir}
          topSetReps={topSetReps}
        />
      )}

      {(isBodyweight ? recentMaxRepsBanner : recentMaxBanner)}
    </section>
  );
}