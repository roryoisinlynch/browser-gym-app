import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  const [captionBelowBar, setCaptionBelowBar] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const captionRowRef = useRef<HTMLDivElement | null>(null);
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

  const showRecentBest =
    effectiveEstimatedOneRepMax != null && (targetRir ?? 0) > 0 && effectiveDashIndex != null;

  const dashFillFractions = Array.from({ length: dashCount }, (_, index) =>
    clamp(topSetEquivalentReps - index, 0, 1)
  );

  const hasMetTarget = topSetEquivalentReps >= targetReps;

  const visibleMarkerIndices = useMemo(() => {
    const indices = [targetDashIndex];
    if (showRecentBest && effectiveDashIndex != null) {
      indices.push(effectiveDashIndex);
    }
    return indices;
  }, [targetDashIndex, showRecentBest, effectiveDashIndex]);

  useLayoutEffect(() => {
    function measureOverlap() {
      const root = rootRef.current;
      const captionRow = captionRowRef.current;
      if (!root || !captionRow) {
        return;
      }

      const captionRect = captionRow.getBoundingClientRect();
      const markerEls = root.querySelectorAll<HTMLElement>(
        ".exercise-rep-dash-progress__marker[data-visible='true']"
      );

      if (markerEls.length === 0) {
        setCaptionBelowBar(false);
        return;
      }

      const horizontalPadding = 8;
      const captionLeft = captionRect.left - horizontalPadding;
      const captionRight = captionRect.right + horizontalPadding;

      let overlaps = false;

      markerEls.forEach((markerEl) => {
        const rect = markerEl.getBoundingClientRect();
        const markerCenterX = rect.left + rect.width / 2;
        if (markerCenterX >= captionLeft && markerCenterX <= captionRight) {
          overlaps = true;
        }
      });

      setCaptionBelowBar(overlaps);
    }

    const id = window.requestAnimationFrame(measureOverlap);
    window.addEventListener("resize", measureOverlap);

    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("resize", measureOverlap);
    };
  }, [visibleMarkerIndices, isTooltipOpen]);

  const captionRow = (
    <div className="exercise-rep-dash-progress__caption-row" ref={captionRowRef}>
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
                Each segment on the bar represents one rep at your working
                weight. If you lift a different weight, the segments fill
                proportionately to reflect the equivalent intensity. The bar
                tracks only your top set for this exercise in this session and
                evaluates it against this week&apos;s RIR-based intensity target.
                The full length of the bar is relative to your all-time best
                lift for this exercise, so filling the bar would result in a new
                PR.
                {showRecentBest
                  ? " The recent best is also annotated on the bar alongside the target."
                  : ""}
              </p>

              <div className="exercise-rep-dash-progress__tooltip-key">
                <span className="exercise-rep-dash-progress__tooltip-key-item">
                  <span className="exercise-rep-dash-progress__tooltip-arrow exercise-rep-dash-progress__tooltip-arrow--target" />
                  Target
                </span>
                {showRecentBest && (
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

  return (
    <div className="exercise-rep-dash-progress" ref={rootRef}>
      {!captionBelowBar && captionRow}

      <div
        className="exercise-rep-dash-progress__track"
        aria-label="Intensity progress bar"
      >
        {dashFillFractions.map((fraction, index) => {
          const isTarget = index === targetDashIndex;
          const isEffective = showRecentBest && effectiveDashIndex != null && index === effectiveDashIndex;

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
                  data-visible="true"
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

      {captionBelowBar && captionRow}
    </div>
  );
}