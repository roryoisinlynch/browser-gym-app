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

function getMarkerPercent(
  repValue: number | null,
  dashCount: number
): number | null {
  if (repValue == null || !Number.isFinite(repValue) || dashCount <= 0) {
    return null;
  }

  const clamped = clamp(repValue, 0, dashCount);
  const isWholeRep = Math.abs(clamped - Math.round(clamped)) < 0.0001;

  if (isWholeRep && clamped >= 1) {
    return clamp(((clamped - 0.5) / dashCount) * 100, 0, 100);
  }

  return clamp((clamped / dashCount) * 100, 0, 100);
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

  const dashFillFractions = Array.from({ length: dashCount }, (_, index) =>
    clamp(topSetEquivalentReps - index, 0, 1)
  );

  const targetMarkerPercent = getMarkerPercent(targetReps, dashCount);
  const effectiveMarkerPercent = getMarkerPercent(
    effectiveEquivalentReps,
    dashCount
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
        <div className="exercise-rep-dash-progress__markers" aria-hidden="true">
          {targetMarkerPercent != null && (
            <span
              className="exercise-rep-dash-progress__marker exercise-rep-dash-progress__marker--target"
              style={{ left: `${targetMarkerPercent}%` }}
            />
          )}
          {effectiveMarkerPercent != null && (
            <span
              className="exercise-rep-dash-progress__marker exercise-rep-dash-progress__marker--effective"
              style={{ left: `${effectiveMarkerPercent}%` }}
            />
          )}
        </div>

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
      </div>

      <div className="exercise-rep-dash-progress__legend">
        {effectiveMarkerPercent != null && (
          <span className="exercise-rep-dash-progress__legend-item exercise-rep-dash-progress__legend-item--effective">
            Recent best
          </span>
        )}
        <span className="exercise-rep-dash-progress__legend-item exercise-rep-dash-progress__legend-item--target">
          Rep target
        </span>
      </div>

      <div className="exercise-rep-dash-progress__footer">
        <span>
          Top set equiv. {Math.min(topSetEquivalentReps, dashCount).toFixed(1)} reps
        </span>
        <span>{formatMetricValue(workingWeight, "kg")} working weight</span>
        <span>PR</span>
      </div>
    </div>
  );
}