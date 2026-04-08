import { useEffect, useRef, useState } from "react";
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
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const infoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!infoRef.current?.contains(event.target as Node)) {
        setIsTooltipOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsTooltipOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

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

      <div className="exercise-rep-dash-progress__caption-row">
        <div className="exercise-rep-dash-progress__caption-group">
          <span className="exercise-rep-dash-progress__caption">
            Intensity Target
          </span>
          {hasMetTarget && (
            <span
              className="exercise-rep-dash-progress__met-check"
              aria-label="Intensity target met"
              title="Intensity target met"
            >
              ✓
            </span>
          )}
        </div>

        <div className="exercise-rep-dash-progress__info" ref={infoRef}>
          <button
            type="button"
            className="exercise-rep-dash-progress__info-button"
            aria-label="Show intensity progress help"
            aria-expanded={isTooltipOpen}
            onClick={() => setIsTooltipOpen((current) => !current)}
          >
            ?
          </button>

          {isTooltipOpen && (
            <div
              className="exercise-rep-dash-progress__tooltip"
              role="dialog"
              aria-label="Intensity progress help"
            >
              <p className="exercise-rep-dash-progress__tooltip-text">
                Each dash represents one rep needed to match your all-time PR at
                your current working weight.
              </p>
              <p className="exercise-rep-dash-progress__tooltip-text">
                Filled dashes show your top set&apos;s current intensity,
                converted into rep-equivalents at that working weight.
              </p>
              <div className="exercise-rep-dash-progress__tooltip-key">
                <span className="exercise-rep-dash-progress__tooltip-key-item">
                  <span className="exercise-rep-dash-progress__tooltip-arrow exercise-rep-dash-progress__tooltip-arrow--target" />
                  Target
                </span>
                {showEffectiveLegend && (
                  <span className="exercise-rep-dash-progress__tooltip-key-item">
                    <span className="exercise-rep-dash-progress__tooltip-arrow exercise-rep-dash-progress__tooltip-arrow--effective" />
                    Recent best
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}