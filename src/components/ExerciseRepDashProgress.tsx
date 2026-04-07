import "./ExerciseRepDashProgress.css";

interface ExerciseRepDashProgressProps {
  workingWeight: number | null;
  targetReps: number | null;
  topSetEstimatedOneRepMax: number | null;
  historicalBestEstimatedOneRepMax: number | null;
  effectiveEstimatedOneRepMax: number | null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatMetricValue(value: number | null, suffix = ""): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }

  return `${Number.isInteger(value) ? value : value.toFixed(1)}${suffix}`;
}

function getEquivalentRepsAtWeight(
  estimatedOneRepMax: number | null,
  workingWeight: number | null
): number | null {
  if (
    estimatedOneRepMax == null ||
    workingWeight == null ||
    !Number.isFinite(estimatedOneRepMax) ||
    !Number.isFinite(workingWeight) ||
    workingWeight <= 0
  ) {
    return null;
  }

  const equivalentReps = 30 * (estimatedOneRepMax / workingWeight - 1);
  return Number.isFinite(equivalentReps) ? Math.max(0, equivalentReps) : null;
}

function getMarkerVariant(
  primaryPosition: number | null,
  secondaryPosition: number | null
): "top" | "bottom" {
  if (primaryPosition == null || secondaryPosition == null) {
    return "top";
  }

  return Math.abs(primaryPosition - secondaryPosition) < 10 ? "bottom" : "top";
}

export default function ExerciseRepDashProgress({
  workingWeight,
  targetReps,
  topSetEstimatedOneRepMax,
  historicalBestEstimatedOneRepMax,
  effectiveEstimatedOneRepMax,
}: ExerciseRepDashProgressProps) {
  const repsToHistoricalPr = getEquivalentRepsAtWeight(
    historicalBestEstimatedOneRepMax,
    workingWeight
  );

  if (
    repsToHistoricalPr == null ||
    targetReps == null ||
    workingWeight == null ||
    workingWeight <= 0
  ) {
    return null;
  }

  const dashCount = Math.max(1, Math.ceil(repsToHistoricalPr));
  const topSetEquivalentReps =
    getEquivalentRepsAtWeight(topSetEstimatedOneRepMax, workingWeight) ?? 0;

  const effectiveEquivalentReps = getEquivalentRepsAtWeight(
    effectiveEstimatedOneRepMax,
    workingWeight
  );


  const targetPercent = clamp((targetReps / dashCount) * 100, 0, 100);
  const effectivePercent =
    effectiveEquivalentReps == null
      ? null
      : clamp((effectiveEquivalentReps / dashCount) * 100, 0, 100);

  const targetVariant = getMarkerVariant(targetPercent, effectivePercent);
  const effectiveVariant =
    effectivePercent == null
      ? "top"
      : getMarkerVariant(effectivePercent, targetPercent);

  const dashFillFractions = Array.from({ length: dashCount }, (_, index) =>
    clamp(topSetEquivalentReps - index, 0, 1)
  );

  return (
    <div className="exercise-rep-dash-progress">
      <div className="exercise-rep-dash-progress__header">
        <span className="exercise-rep-dash-progress__label">
          Rep path to all-time PR
        </span>
        <span className="exercise-rep-dash-progress__value">
          {dashCount} {dashCount === 1 ? "rep" : "reps"} to match{" "}
          {formatMetricValue(historicalBestEstimatedOneRepMax, "kg")}
        </span>
      </div>

      <div className="exercise-rep-dash-progress__track-wrap">
        <div
          className="exercise-rep-dash-progress__track"
          aria-label="Rep-equivalent progress toward all-time PR at working weight"
        >
          {dashFillFractions.map((fraction, index) => (
            <span
              key={index}
              className="exercise-rep-dash-progress__dash"
              aria-hidden="true"
            >
              <span
                className="exercise-rep-dash-progress__dash-fill"
                style={{ width: `${fraction * 100}%` }}
              />
            </span>
          ))}
        </div>

        <div
          className={`exercise-rep-dash-progress__marker exercise-rep-dash-progress__marker--${targetVariant}`}
          style={{ left: `${targetPercent}%` }}
          aria-hidden="true"
        >
          <span className="exercise-rep-dash-progress__marker-line exercise-rep-dash-progress__marker-line--target" />
          <span className="exercise-rep-dash-progress__marker-pill">Target</span>
        </div>

        {effectivePercent != null && (
          <div
            className={`exercise-rep-dash-progress__marker exercise-rep-dash-progress__marker--${effectiveVariant}`}
            style={{ left: `${effectivePercent}%` }}
            aria-hidden="true"
          >
            <span className="exercise-rep-dash-progress__marker-line exercise-rep-dash-progress__marker-line--effective" />
            <span className="exercise-rep-dash-progress__marker-pill">Recent best</span>
          </div>
        )}
      </div>

      <div className="exercise-rep-dash-progress__footer">
        <span>
          Top set equiv.{" "}
          {topSetEquivalentReps <= 0
            ? "0.0"
            : Math.min(topSetEquivalentReps, dashCount).toFixed(1)}{" "}
          reps
        </span>
        <span>{formatMetricValue(workingWeight, "kg")} working weight</span>
        <span>PR</span>
      </div>
    </div>
  );
}