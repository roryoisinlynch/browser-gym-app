import { useEffect, useRef, useState } from "react";
import "./ExerciseRepDashProgress.css";

interface ExerciseRepDashProgressBodyweightProps {
  historicalBestReps: number;
  recentMaxReps: number | null;
  targetReps: number;
  targetRir: number | null;
  topSetReps: number | null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function ExerciseRepDashProgressBodyweight({
  historicalBestReps,
  recentMaxReps,
  targetReps,
  targetRir,
  topSetReps,
}: ExerciseRepDashProgressBodyweightProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const infoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!infoRef.current?.contains(event.target as Node)) {
        setTooltipOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setTooltipOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const dashCount = Math.max(1, historicalBestReps + 1);
  const allTimePrIndex = dashCount - 1;
  const targetIndex = clamp(targetReps - 1, 0, dashCount - 1);

  const recentBestIndex =
    recentMaxReps != null
      ? clamp(recentMaxReps - 1, 0, dashCount - 1)
      : null;
  const showRecentBest =
    recentMaxReps != null &&
    targetRir !== 0 &&
    recentBestIndex != null &&
    recentBestIndex !== targetIndex;

  const topSetFill = topSetReps ?? 0;
  const dashFillFractions = Array.from({ length: dashCount }, (_, i) =>
    clamp(topSetFill - i, 0, 1)
  );

  const hasMetTarget = topSetFill >= targetReps;

  // Warmup boundary: working requires RIR < 6 (gap ≤ 5).
  // Use the recency-adjusted baseline so stale PRs don't widen the warmup zone.
  const effectiveBaseline = recentMaxReps ?? historicalBestReps;
  const normalCutoff = effectiveBaseline - 6; // last segment index still in warmup
  // Pull cutoff down if the prescribed target is already in warmup territory.
  const warmupCutoff = targetReps - 1 < normalCutoff ? targetReps - 1 : normalCutoff;

  return (
    <div className="exercise-rep-dash-progress">
      <div
        className="exercise-rep-dash-progress__track"
        aria-label="Rep progress bar"
      >
        {dashFillFractions.map((fraction, index) => {
          const isTarget = index === targetIndex;
          const isRecentBest = showRecentBest && index === recentBestIndex;
          const isAllTime = index === allTimePrIndex;

          // For bodyweight reps are integers so warmupCutoff is always an
          // integer — segments are either fully warmup or fully working.
          const isWarmup = index <= warmupCutoff;

          return (
            <span key={index} className="exercise-rep-dash-progress__dash-wrap">
              {(isTarget || isRecentBest || isAllTime) && (
                <span
                  className={[
                    "exercise-rep-dash-progress__marker",
                    isTarget && "exercise-rep-dash-progress__marker--target",
                    isRecentBest && "exercise-rep-dash-progress__marker--recent",
                    isAllTime && "exercise-rep-dash-progress__marker--pr",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
              )}
              <span
                className="exercise-rep-dash-progress__dash"
                style={isWarmup ? { background: "var(--dash-bg-warmup)" } : undefined}
              >
                <span
                  className="exercise-rep-dash-progress__dash-fill"
                  style={{
                    width: `${fraction * 100}%`,
                    ...(isWarmup && fraction > 0 ? { background: "var(--dash-fill-warmup)" } : {}),
                  }}
                />
              </span>
            </span>
          );
        })}
      </div>

      <div className="exercise-rep-dash-progress__caption-row">
        <div className="exercise-rep-dash-progress__caption-group">
          <span className="exercise-rep-dash-progress__caption">
            Rep Target
          </span>
          {hasMetTarget && (
            <span
              className="exercise-rep-dash-progress__met-check"
              aria-label="Rep target met"
              title="Rep target met"
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
                This bar tracks the reps in your top set. Each segment
                represents one rep. Reach the{" "}
                <strong>green arrow</strong> to meet your rep target for the
                set
                {showRecentBest && (
                  <>
                    , reach the <strong>white arrow</strong> to beat your recent
                    best
                  </>
                )}
                , or reach the <strong>yellow arrow</strong> to set an all-time
                rep PR for this exercise.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
