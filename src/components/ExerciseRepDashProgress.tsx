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

function formatWeight(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}kg`;
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

/**
 * Compute the warmup/working boundary in continuous equivalent-rep space.
 *
 * Working = RIR < 6 at the working weight. This corresponds to a set e1RM at
 * or above `baseline − workingWeight × (6/30)`, which in equivalent-rep space
 * at the working weight is `effectiveEquivReps − 6`. When the prescribed
 * target sits below the cutoff (the target itself is in warmup territory),
 * the cutoff is pulled down to the target so that segment counts as working.
 *
 * Returns null when there is not enough data to determine a boundary (all
 * segments treated as working / no desaturation applied).
 */
function computeWarmupCutoff(
  effectiveE1RM: number | null,
  workingWeight: number | null,
  targetReps: number | null
): number | null {
  if (effectiveE1RM == null || workingWeight == null || workingWeight <= 0) return null;

  const effectiveEquivReps = Math.max(0, 30 * (effectiveE1RM / workingWeight - 1));
  let cutoff = effectiveEquivReps - 6;

  if (targetReps != null && targetReps - 1 < cutoff) {
    cutoff = targetReps - 1;
  }

  return cutoff;
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
      if (event.key === "Escape") setTooltipOpen(false);
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

  if (repsToHistoricalPr == null || targetReps == null || workingWeight == null) {
    return null;
  }

  const dashCount = Math.max(1, Math.floor(repsToHistoricalPr + 0.0001) + 1);
  const allTimePrIndex = dashCount - 1;
  const targetIndex = clamp(Math.round(targetReps) - 1, 0, dashCount - 1);

  const effectiveEquivalentReps = getEquivalentRepsAtWeight(
    effectiveEstimatedOneRepMax,
    workingWeight
  );
  const recentBestIndex =
    effectiveEquivalentReps == null
      ? null
      : clamp(Math.floor(effectiveEquivalentReps + 0.0001), 0, dashCount - 1);
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

  // Warmup boundary in continuous equivalent-rep space.
  const warmupCutoff = computeWarmupCutoff(
    effectiveEstimatedOneRepMax,
    workingWeight,
    targetReps
  );

  const workingSetReps =
    warmupCutoff == null
      ? 1
      : Math.max(1, Math.floor(warmupCutoff + 0.0001) + 1);
  const intensityTargetReps = targetIndex + 1;
  const includeRecentBestLine =
    effectiveEstimatedOneRepMax != null &&
    targetRir !== 0 &&
    recentBestIndex != null;
  const recentBestBeatReps =
    includeRecentBestLine && recentBestIndex != null ? recentBestIndex + 1 : null;
  const allTimePrReps = dashCount;

  type NarrativeItem = { reps: number; label: string };
  const narrativeItemsAll: NarrativeItem[] = [
    { reps: workingSetReps, label: "qualify as a working set" },
    { reps: intensityTargetReps, label: "match your intensity target" },
  ];
  if (recentBestBeatReps != null) {
    narrativeItemsAll.push({
      reps: recentBestBeatReps,
      label: "beat your recent best",
    });
  }
  narrativeItemsAll.push({
    reps: allTimePrReps,
    label: "set an all time PR",
  });

  // Dedup with "later wins": walk backwards, drop earlier items whose reps
  // already appeared in a later position.
  const seenReps = new Set<number>();
  const narrativeItems: NarrativeItem[] = [];
  for (let i = narrativeItemsAll.length - 1; i >= 0; i--) {
    const item = narrativeItemsAll[i];
    if (!seenReps.has(item.reps)) {
      seenReps.add(item.reps);
      narrativeItems.unshift(item);
    }
  }

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

          // Fraction of this segment that sits in warmup territory [0, 1].
          // clamp(cutoff - i, 0, 1) gives the left portion of segment i that
          // is below the working threshold.
          const warmupFraction =
            warmupCutoff != null ? clamp(warmupCutoff - index, 0, 1) : 0;

          // Background colour of the unfilled dash.
          const dashSplit = `${(warmupFraction * 100).toFixed(1)}%`;
          const dashBgStyle =
            warmupFraction <= 0
              ? undefined
              : warmupFraction >= 1
              ? { background: "var(--dash-bg-warmup)" }
              : {
                  background: `linear-gradient(to right, var(--dash-bg-warmup) ${dashSplit}, var(--dash-bg) ${dashSplit})`,
                };

          // Colour of the filled portion. The warmup split within the fill
          // differs from the dash split because the fill may be narrower.
          const fillWarmupFraction =
            fraction > 0 ? Math.min(warmupFraction / fraction, 1) : 0;
          const fillSplit = `${(fillWarmupFraction * 100).toFixed(1)}%`;
          const fillBg =
            fillWarmupFraction >= 1
              ? "var(--dash-fill-warmup)"
              : fillWarmupFraction > 0
              ? `linear-gradient(to right, var(--dash-fill-warmup) ${fillSplit}, var(--accent) ${fillSplit})`
              : undefined; // let CSS class apply the accent gradient

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
                style={dashBgStyle}
              >
                <span
                  className="exercise-rep-dash-progress__dash-fill"
                  style={{ width: `${fraction * 100}%`, ...(fillBg ? { background: fillBg } : {}) }}
                />
              </span>
            </span>
          );
        })}
      </div>

      <div className="exercise-rep-dash-progress__caption-row">
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

      <div className="exercise-rep-dash-progress__narrative">
        <p className="exercise-rep-dash-progress__narrative-intro">
          At {formatWeight(workingWeight)} working weight…
        </p>
        <ul className="exercise-rep-dash-progress__narrative-list">
          {narrativeItems.map((item) => (
            <li
              key={item.label}
              className="exercise-rep-dash-progress__narrative-item"
            >
              lift <strong>{item.reps}</strong> reps to {item.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
