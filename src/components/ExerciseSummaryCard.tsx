import "./ExerciseSummaryCard.css";
import ExerciseRepDashProgress from "./ExerciseRepDashProgress";

interface ExerciseSummaryCardProps {
  movementTypeName: string;
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
  isAmrap?: boolean;
  needsWeightConfig?: boolean;
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

export default function ExerciseSummaryCard({
  movementTypeName,
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
  isAmrap = false,
  needsWeightConfig = false,
}: ExerciseSummaryCardProps) {
  if (isAmrap || needsWeightConfig) {
    return (
      <section className="exercise-summary-card">
        <div className="exercise-summary-card__header-row">
          <div>
            <p className="exercise-summary-card__eyebrow">Exercise</p>
            <p className="exercise-summary-card__movement">{movementTypeName}</p>
          </div>
          <div className="exercise-summary-card__rir-pill">
            Target RIR: {targetRir ?? "—"}
          </div>
        </div>
        <div className="exercise-summary-card__amrap-banner">
          {isAmrap ? (
            <>
              <p className="exercise-summary-card__amrap-heading">
                No baseline yet
              </p>
              <p className="exercise-summary-card__amrap-body">
                Choose a challenging weight and lift for as many reps as
                possible (AMRAP). Your e1RM will be calculated from this
                session and used to prescribe future sessions.
              </p>
            </>
          ) : (
            <>
              <p className="exercise-summary-card__amrap-heading">
                Working weight not set
              </p>
              <p className="exercise-summary-card__amrap-body">
                You have session history for this exercise. Set a working weight
                to get today&apos;s target.
              </p>
            </>
          )}
        </div>
      </section>
    );
  }

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
          const dayCount = daysSince(recentMaxDate);

          const historicalContext =
            historicalBestDate != null
              ? `Your all-time PR of ${historicalStr} (set ${daysSince(
                  historicalBestDate
                )} days ago) hasn't been matched in your last three active seasons.`
              : `Your all-time PR of ${historicalStr} is from your imported training history.`;

          return (
            <div className="exercise-summary-card__recent-max-banner" role="note">
              <p className="exercise-summary-card__recent-max-heading">
                Using recent best for targets
              </p>
              <p className="exercise-summary-card__recent-max-body">
                {historicalContext} Today&apos;s targets are based on your most
                recent best of <strong>{recentStr}</strong> ({recentDateStr},{" "}
                {dayCount} days ago) to keep your training load fair and
                sustainable.
              </p>
            </div>
          );
        })()
      : null;

  return (
    <section className="exercise-summary-card">
      <div className="exercise-summary-card__header-row">
        <div>
          <p className="exercise-summary-card__eyebrow">Exercise</p>
          <p className="exercise-summary-card__movement">{movementTypeName}</p>
        </div>

        <div className="exercise-summary-card__rir-pill">
          Target RIR: {targetRir ?? "—"}
        </div>
      </div>

      {recentMaxBanner}

      <div className="exercise-summary-card__metrics-grid">
        <div className="exercise-summary-card__metric">
          <span className="exercise-summary-card__metric-label">Target</span>
          <strong className="exercise-summary-card__metric-value">
            {isBodyweight
              ? targetReps == null
                ? "—"
                : `${targetReps} reps`
              : targetWeight == null || targetReps == null
                ? "—"
                : `${formatMetricValue(targetWeight, "kg")} × ${formatMetricValue(targetReps)}`}
          </strong>
        </div>

        <div className="exercise-summary-card__metric">
          <span className="exercise-summary-card__metric-label">
            {isBodyweight ? "Best reps" : "Target e1RM"}
          </span>
          <strong className="exercise-summary-card__metric-value">
            {isBodyweight
              ? formatMetricValue(historicalBestReps)
              : formatMetricValue(targetEstimatedOneRepMax, "kg")}
          </strong>
        </div>
      </div>

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

      {isBodyweight && (
        <div className="exercise-summary-card__bodyweight-progress">
          <span className="exercise-summary-card__bodyweight-progress-label">
            Top set
          </span>
          <strong className="exercise-summary-card__bodyweight-progress-value">
            {formatMetricValue(topSetReps, " reps")}
          </strong>
        </div>
      )}
    </section>
  );
}