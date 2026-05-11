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

  // Warmup boundary: working requires RIR < 6 (gap ≤ 5).
  // Use the recency-adjusted baseline so stale PRs don't widen the warmup zone.
  const effectiveBaseline = recentMaxReps ?? historicalBestReps;
  // Last warmup segment index: warmup requires RIR ≥ 6 (gap > THRESHOLD=5).
  // Last warmup rep = baseline − 6; its 0-indexed segment = baseline − 7.
  const normalCutoff = effectiveBaseline - 7;
  // Pull cutoff down if the prescribed target is already in warmup territory,
  // so the target segment (index targetReps−1) is working, not warmup.
  const warmupCutoff = targetReps - 1 <= normalCutoff ? targetReps - 2 : normalCutoff;

  // Narrative items mirror the weighted card. Rep counts:
  //   working set qualifier = warmupCutoff + 2 (first segment past the warmup
  //     zone, 1-indexed), clamped to ≥ 1.
  //   rep target = targetReps (the prescription).
  //   beat recent best = recentMaxReps + 1 (one more than the recent best).
  //   set all-time PR = historicalBestReps + 1.
  const workingSetReps = Math.max(1, warmupCutoff + 2);
  const recentBestBeatReps =
    recentMaxReps != null && targetRir !== 0 ? recentMaxReps + 1 : null;
  const allTimePrReps = historicalBestReps + 1;

  type NarrativeItem = { reps: number; label: string };
  // Skip the working-set qualifier when the threshold collapses to 1 rep
  // ("lift 1 reps to qualify…" is noise — any rep already qualifies).
  const narrativeItemsAll: NarrativeItem[] = [];
  if (workingSetReps >= 2) {
    narrativeItemsAll.push({ reps: workingSetReps, label: "qualify as a working set" });
  }
  narrativeItemsAll.push({ reps: targetReps, label: "match your rep target" });
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

      <div className="exercise-rep-dash-progress__narrative">
        <p className="exercise-rep-dash-progress__narrative-intro">
          For today&apos;s session…
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
