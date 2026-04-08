import "./ExerciseRepDashProgress.css";

interface ExerciseRepDashProgressProps {
  workingWeight: number | null;
  targetReps: number | null;
  targetRir: number | null;
  topSetEstimatedOneRepMax: number | null;
  historicalBestEstimatedOneRepMax: number | null;
  effectiveEstimatedOneRepMax: number | null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
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

export default function ExerciseRepDashProgress({
  workingWeight,
  targetReps,
  targetRir,
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

  const targetDashIndex = clamp(Math.round(targetReps) - 1, 0, dashCount - 1);

  const effectiveDashIndex =
    effectiveEquivalentReps == null
      ? null
      : clamp(Math.round(effectiveEquivalentReps) - 1, 0, dashCount - 1);

  const showEffectiveLegend =
    effectiveDashIndex != null && (targetRir ?? 0) > 0;

  const dashFillFractions = Array.from({ length: dashCount }, (_, index) =>
    clamp(topSetEquivalentReps - index, 0, 1)
  );

  const hasMetTarget = topSetEquivalentReps >= targetReps;

  return (
    <div className="exercise-rep-dash-progress">
      <div
        className="exercise-rep-dash-progress__track"
        aria-label="Intensity progress bar"
      >
        {dashFillFractions.map((fraction, index) => {
          const isTarget = index === targetDashIndex;
          const isEffective = effectiveDashIndex != null && index === effectiveDashIndex;

          return (
            <span
              key={index}
              className="exercise-rep-dash-progress__dash-wrap"
              aria-hidden="true"
            >
              {(isTarget || isEffective) && (
                <span
                  className={[
                    "exercise-rep-dash-progress__marker",
                    isTarget
                      ? "exercise-rep-dash-progress__marker--target"
                      : "exercise-rep-dash-progress__marker--effective",
                  ].join(" ")}
                />
              )}

              <span className="exercise-rep-dash-progress__dash">
                <span
                  className="exercise-rep-dash-progress__dash-fill"
                  style={{ width: `${fraction * 100}%` }}
                />
              </span>
            </span>
          );
        })}
      </div>

      <div className="exercise-rep-dash-progress__legend">
        <span className="exercise-rep-dash-progress__legend-item exercise-rep-dash-progress__legend-item--target">
          <span className="exercise-rep-dash-progress__legend-arrow exercise-rep-dash-progress__legend-arrow--target" />
          Target
        </span>
        {showEffectiveLegend && (
          <span className="exercise-rep-dash-progress__legend-item exercise-rep-dash-progress__legend-item--effective">
            <span className="exercise-rep-dash-progress__legend-arrow exercise-rep-dash-progress__legend-arrow--effective" />
            Recent best
          </span>
        )}
      </div>

      {hasMetTarget && (
        <div className="exercise-rep-dash-progress__met">
          <span className="exercise-rep-dash-progress__met-check" aria-hidden="true">
            ✓
          </span>
          <span>Intensity target met</span>
        </div>
      )}
    </div>
  );
}