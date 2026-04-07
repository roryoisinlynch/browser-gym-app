import "./ExerciseSummaryCard.css";
import ExerciseRepDashProgress from "./ExerciseRepDashProgress.tsx";

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

function formatMetricValue(
  value: number | null,
  suffix = ""
): string {
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

function getScaleMax(
  historicalBestEstimatedOneRepMax: number | null,
  targetEstimatedOneRepMax: number | null,
  topSetEstimatedOneRepMax: number | null
) {
  return Math.max(
    historicalBestEstimatedOneRepMax ?? 0,
    targetEstimatedOneRepMax ?? 0,
    topSetEstimatedOneRepMax ?? 0,
    1
  );
}

function clampPercentage(value: number) {
  return Math.max(0, Math.min(100, value));
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
  const scaleMax = isBodyweight
    ? Math.max(historicalBestReps ?? 0, targetReps ?? 0, topSetReps ?? 0, 1)
    : getScaleMax(
        historicalBestEstimatedOneRepMax,
        targetEstimatedOneRepMax,
        topSetEstimatedOneRepMax
      );

  const fillPercentage = clampPercentage(
    isBodyweight
      ? ((topSetReps ?? 0) / scaleMax) * 100
      : ((topSetEstimatedOneRepMax ?? 0) / scaleMax) * 100
  );

  const targetPercentage = clampPercentage(
    isBodyweight
      ? ((targetReps ?? 0) / scaleMax) * 100
      : ((targetEstimatedOneRepMax ?? 0) / scaleMax) * 100
  );

  const recentMaxPercentage =
    !isBodyweight && recentMaxEstimatedOneRepMax != null
      ? clampPercentage((recentMaxEstimatedOneRepMax / scaleMax) * 100)
      : null;

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
                You have session history for this exercise. Go to Settings →
                Configure sessions to select a working weight.
              </p>
            </>
          )}
        </div>
      </section>
    );
  }

  const recentMaxBanner = recentMaxEstimatedOneRepMax != null && recentMaxDate != null ? (() => {
    const historicalStr = formatMetricValue(historicalBestEstimatedOneRepMax, "kg");
    const recentStr = formatMetricValue(recentMaxEstimatedOneRepMax, "kg");
    const recentDateStr = formatDate(recentMaxDate);
    const dayCount = daysSince(recentMaxDate);

    const historicalContext = historicalBestDate != null
      ? `Your all-time PR of ${historicalStr} (set ${daysSince(historicalBestDate)} days ago) hasn't been matched in your last three active seasons.`
      : `Your all-time PR of ${historicalStr} is from your imported training history.`;

    return (
      <div className="exercise-summary-card__recent-max-banner" role="note">
        <p className="exercise-summary-card__recent-max-heading">Using recent best for targets</p>
        <p className="exercise-summary-card__recent-max-body">
          {historicalContext}{" "}
          Today's targets are based on your most recent best of{" "}
          <strong>{recentStr}</strong> ({recentDateStr}, {dayCount} days ago) to
          keep your training load fair and sustainable.
        </p>
      </div>
    );
  })() : null;

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
              ? targetReps == null ? "—" : `${targetReps} reps`
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

      <div className="exercise-summary-card__bar-block">
        <div className="exercise-summary-card__bar-label-row">
          <span className="exercise-summary-card__bar-label">Top set progress</span>
          <span className="exercise-summary-card__bar-value">
            {isBodyweight
              ? `Historical best ${formatMetricValue(historicalBestReps, " reps")}`
              : `All-time best ${formatMetricValue(historicalBestEstimatedOneRepMax, "kg")}`}
          </span>
        </div>

        <div
          className="exercise-summary-card__bar"
          aria-label={isBodyweight ? "Top set rep count progress" : "Top set estimated one rep max progress"}
        >
          <span
            className="exercise-summary-card__bar-fill"
            style={{ width: `${fillPercentage}%` }}
          />
          {recentMaxPercentage != null && (
            <span
              className="exercise-summary-card__bar-recent-max"
              style={{ left: `${recentMaxPercentage}%` }}
              aria-hidden="true"
            />
          )}
          <span
            className="exercise-summary-card__bar-target"
            style={{ left: `${targetPercentage}%` }}
            aria-hidden="true"
          />
        </div>

        <div className="exercise-summary-card__bar-foot">
          <span>
            {isBodyweight
              ? `Top set ${formatMetricValue(topSetReps, " reps")}`
              : `Top set ${formatMetricValue(topSetEstimatedOneRepMax, "kg")}`}
          </span>
          {recentMaxPercentage != null && (
            <span className="exercise-summary-card__bar-foot-recent-max">
              Recent best
            </span>
          )}
          <span>Target</span>
        </div>
      </div>

      {!isBodyweight && (
        <ExerciseRepDashProgress
          workingWeight={targetWeight}
          targetReps={targetReps}
          topSetEstimatedOneRepMax={topSetEstimatedOneRepMax}
          historicalBestEstimatedOneRepMax={historicalBestEstimatedOneRepMax}
          effectiveEstimatedOneRepMax={recentMaxEstimatedOneRepMax}
        />
      )}
    </section>
  );
}