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

  return Math.max(0, 30 * (estimatedOneRepMax / workingWeight - 1));
}

export default function ExerciseRepDashProgress({
  workingWeight,
  targetReps,
  targetRir,
  topSetEstimatedOneRepMax,
  historicalBestEstimatedOneRepMax,
  effectiveEstimatedOneRepMax,
}: ExerciseRepDashProgressProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const infoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!infoRef.current?.contains(event.target as Node)) {
        setTooltipOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setTooltipOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClick);
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
    workingWeight == null
  ) {
    return null;
  }

  /*
    BAR LENGTH

    floor(repsToHistoricalPr) = highest rep that does NOT beat all-time best
    +1 segment = first rep that WOULD beat all-time best (PR)
  */
  const dashCount = Math.max(1, Math.floor(repsToHistoricalPr) + 1);

  const allTimePrIndex = dashCount - 1;

  const targetIndex = clamp(Math.round(targetReps) - 1, 0, dashCount - 1);

  const effectiveEquivalentReps = getEquivalentRepsAtWeight(
    effectiveEstimatedOneRepMax,
    workingWeight
  );

  /*
    RECENT BEST MARKER

    floor(recentEquivalent) = highest rep that matches but does not beat
    therefore marker sits one rep higher (beat recent best)
  */
  const recentBestIndex =
    effectiveEquivalentReps == null
      ? null
      : clamp(Math.floor(effectiveEquivalentReps), 0, dashCount - 1);

  const showRecentBest =
    effectiveEstimatedOneRepMax != null &&
    targetRir !== 0 &&
    recentBestIndex != null &&
    recentBestIndex !== targetIndex;

  const topSetEquivalentReps =
    getEquivalentRepsAtWeight(topSetEstimatedOneRepMax, workingWeight) ?? 0;

  const dashFillFractions = Array.from({ length: dashCount }, (_, i) =>
    clamp(topSetEquivalentReps - i, 0, 1)
  );

  const hasMetTarget = topSetEquivalentReps >= targetReps;

  return (
    <div className="exercise-rep-dash-progress">
      <div
        className="exercise-rep-dash-progress__track"
        aria-label="Intensity progress bar"
      >
        {dashFillFractions.map((fraction, index) => {
          const isTarget = index === targetIndex;
          const isRecentBest = showRecentBest && index === recentBestIndex;
          const isAllTime = index === allTimePrIndex;

          return (
            <span key={index} className="exercise-rep-dash-progress__dash-wrap">
              {(isTarget || isRecentBest || isAllTime) && (
                <span
                  className={[
                    "exercise-rep-dash-progress__marker",
                    isTarget && "exercise-rep-dash-progress__marker--target",
                    isRecentBest &&
                      "exercise-rep-dash-progress__marker--recent",
                    isAllTime && "exercise-rep-dash-progress__marker--pr",
                  ]
                    .filter(Boolean)
                    .join(" ")}
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
            className="exercise-rep-dash-progress__info-button"
            aria-expanded={tooltipOpen}
            onClick={() => setTooltipOpen((v) => !v)}
          >
            ?
          </button>

          {tooltipOpen && (
            <div className="exercise-rep-dash-progress__tooltip">
              <p className="exercise-rep-dash-progress__tooltip-text">
                This bar tracks the intensity of your top set. Each segment
                represents one rep at your working weight. Reach the{" "}
                <strong>green arrow</strong> to meet your intensity target for
                the set
                {showRecentBest && (
                  <>
                    , reach the <strong>white arrow</strong> to beat your recent
                    best
                  </>
                )}
                , or reach the <strong>yellow arrow</strong> to set an all-time
                PR for this exercise.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}