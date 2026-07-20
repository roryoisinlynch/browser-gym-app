import { useEffect, useState } from "react";
import { gradeColor } from "../services/seasonMetrics";
import type { SeasonGrade } from "../services/seasonMetrics";
import useCountUp from "../hooks/useCountUp";
import useInView from "../hooks/useInView";
import "./SeasonGradeHero.css";

interface SeasonGradeHeroProps {
  grade: SeasonGrade;
  volumeScore: number;
  intensityScore: number;
  consistencyScore: number;
  endedEarly: boolean;
}

/** Letters the slot cycles through while the sub-scores are still counting. */
const CYCLE_LETTERS = ["A", "B", "C", "D", "F"];

const CYCLE_INTERVAL_MS = 45;
/** ~100ms after the last sub-score settles (750ms start + 650ms duration). */
const SETTLE_AT_MS = 1500;
const SCORE_START_MS = [250, 500, 750];
const SCORE_DURATION_MS = 650;

/** Same buckets buildSeasonNarrative reads: met / almost / missed. */
function scoreTone(score: number): "green" | "amber" | "red" {
  if (score >= 100) return "green";
  if (score >= 90) return "amber";
  return "red";
}

function ScoreTile({
  score,
  label,
  index,
  started,
}: {
  score: number;
  label: string;
  index: number;
  started: boolean;
}) {
  const shown = useCountUp(score, SCORE_DURATION_MS, {
    delayMs: SCORE_START_MS[index],
    enabled: started,
  });
  return (
    <div className={`ss-score ss-score--${scoreTone(score)}`}>
      <span className="ss-score__pct">{shown}%</span>
      <span className="ss-score__track">
        <span
          className="ss-score__fill"
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </span>
      <span className="ss-score__label">{label}</span>
    </div>
  );
}

/**
 * The season's headline: the grade letter alone on its own row, with volume,
 * intensity and consistency beneath it.
 *
 * The letter resolves *last*. While the three sub-scores count up it cycles
 * through candidate letters in muted grey — the grade is an average of those
 * three numbers, so showing it settle only once they've landed matches how it's
 * actually derived. Under reduced motion nothing cycles and nothing counts.
 */
export default function SeasonGradeHero({
  grade,
  volumeScore,
  intensityScore,
  consistencyScore,
  endedEarly,
}: SeasonGradeHeroProps) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const [settled, setSettled] = useState(reduced);
  const [cycleIndex, setCycleIndex] = useState(0);

  useEffect(() => {
    if (!inView || reduced) return;
    const interval = window.setInterval(
      () => setCycleIndex((i) => i + 1),
      CYCLE_INTERVAL_MS
    );
    const timer = window.setTimeout(() => {
      window.clearInterval(interval);
      setSettled(true);
    }, SETTLE_AT_MS);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timer);
    };
  }, [inView, reduced]);

  const color = gradeColor(grade);
  const letter = settled ? grade : CYCLE_LETTERS[cycleIndex % CYCLE_LETTERS.length];

  return (
    <div className="ss-hero" ref={ref}>
      <div className="ss-hero__grade-row">
        <span
          className={`ss-hero__grade ss-hero__grade--${color}${settled ? " is-settled" : ""}`}
          aria-label={endedEarly ? "Season ended early" : `Season grade ${grade}`}
        >
          {letter}
        </span>
        <span className={`ss-hero__caption${settled ? " is-settled" : ""}`}>
          {endedEarly ? "Ended early" : "Season grade"}
        </span>
      </div>

      <div className="ss-hero__scores">
        <ScoreTile score={volumeScore} label="Volume" index={0} started={inView} />
        <ScoreTile score={intensityScore} label="Intensity" index={1} started={inView} />
        <ScoreTile score={consistencyScore} label="Consistency" index={2} started={inView} />
      </div>
    </div>
  );
}
