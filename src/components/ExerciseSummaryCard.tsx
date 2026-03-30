import "./ExerciseSummaryCard.css";

interface ExerciseSummaryCardProps {
  movementTypeName: string;
  targetRir: number | null;
  targetWeight: number | null;
  targetReps: number | null;
  targetEstimatedOneRepMax: number | null;
  topSetEstimatedOneRepMax: number | null;
  historicalBestEstimatedOneRepMax: number | null;
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
}: ExerciseSummaryCardProps) {
  const scaleMax = getScaleMax(
    historicalBestEstimatedOneRepMax,
    targetEstimatedOneRepMax,
    topSetEstimatedOneRepMax
  );

  const fillPercentage = clampPercentage(
    ((topSetEstimatedOneRepMax ?? 0) / scaleMax) * 100
  );

  const targetPercentage = clampPercentage(
    ((targetEstimatedOneRepMax ?? 0) / scaleMax) * 100
  );

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

      <div className="exercise-summary-card__metrics-grid">
        <div className="exercise-summary-card__metric">
          <span className="exercise-summary-card__metric-label">Target</span>
          <strong className="exercise-summary-card__metric-value">
            {targetWeight == null || targetReps == null
              ? "—"
              : `${formatMetricValue(targetWeight, "kg")} × ${formatMetricValue(
                  targetReps
                )}`}
          </strong>
        </div>

        <div className="exercise-summary-card__metric">
          <span className="exercise-summary-card__metric-label">Target e1RM</span>
          <strong className="exercise-summary-card__metric-value">
            {formatMetricValue(targetEstimatedOneRepMax, "kg")}
          </strong>
        </div>
      </div>

      <div className="exercise-summary-card__bar-block">
        <div className="exercise-summary-card__bar-label-row">
          <span className="exercise-summary-card__bar-label">Top set progress</span>
          <span className="exercise-summary-card__bar-value">
            Historical best {formatMetricValue(historicalBestEstimatedOneRepMax, "kg")}
          </span>
        </div>

        <div
          className="exercise-summary-card__bar"
          aria-label="Top set estimated one rep max progress"
        >
          <span
            className="exercise-summary-card__bar-fill"
            style={{ width: `${fillPercentage}%` }}
          />
          <span
            className="exercise-summary-card__bar-target"
            style={{ left: `${targetPercentage}%` }}
            aria-hidden="true"
          />
        </div>

        <div className="exercise-summary-card__bar-foot">
          <span>Top set {formatMetricValue(topSetEstimatedOneRepMax, "kg")}</span>
          <span>Target marker</span>
        </div>
      </div>
    </section>
  );
}
