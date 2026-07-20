import { useEffect, useState } from "react";
import { emojiForRating } from "../services/weekMetrics";
import type { EmojiRating } from "../services/weekMetrics";
import useCountUp from "../hooks/useCountUp";
import useInView from "../hooks/useInView";
import "./WeekGradeHero.css";

interface WeekGradeHeroProps {
  emojiRating: EmojiRating;
  volumeScore: number;
  intensityScore: number;
  consistencyScore: number;
  /** The week's identity ("Week 3, 2 RIR"), which has no title bar to live in. */
  caption: string;
  endedEarly: boolean;
}

const RATINGS: EmojiRating[] = [1, 2, 3, 4, 5];

const CYCLE_INTERVAL_MS = 45;
/** ~100ms after the last sub-score settles (750ms start + 650ms duration). */
const SETTLE_AT_MS = 1500;
const SCORE_START_MS = [250, 500, 750];
const SCORE_DURATION_MS = 650;

/** Same buckets buildWeekNarrative reads: met / almost / missed. */
function scoreTone(score: number): "green" | "amber" | "red" {
  if (score >= 100) return "green";
  if (score >= 90) return "amber";
  return "red";
}

/** Mirrors getEmojiRating's thresholds, so glow and face always agree. */
function ratingTone(rating: EmojiRating): "green" | "amber" | "red" {
  if (rating <= 2) return "green";
  if (rating === 3) return "amber";
  return "red";
}

function ScoreRow({
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
    <div className={`wk-score wk-score--${scoreTone(score)}`}>
      <div className="wk-score__head">
        <span className="wk-score__label">{label}</span>
        <span className="wk-score__pct">{shown}%</span>
      </div>
      <span className="wk-score__track">
        <span
          className="wk-score__fill"
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </span>
    </div>
  );
}

/**
 * The week's headline: its emoji rating on the left, with volume, intensity and
 * consistency stacked beside it.
 *
 * The face resolves last, cycling the five ratings while the scores count up —
 * the rating is derived from their average, so it settles only once they have.
 * Under reduced motion nothing cycles and nothing counts.
 */
export default function WeekGradeHero({
  emojiRating,
  volumeScore,
  intensityScore,
  consistencyScore,
  caption,
  endedEarly,
}: WeekGradeHeroProps) {
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

  const shownRating = settled
    ? emojiRating
    : RATINGS[cycleIndex % RATINGS.length];

  return (
    <div className="wk-hero" ref={ref}>
      <div className={`wk-hero__face wk-hero__face--${ratingTone(emojiRating)}`}>
        <span
          className={`wk-hero__emoji${settled ? " is-settled" : ""}`}
          aria-label={endedEarly ? "Week ended early" : `Week rating ${emojiRating}`}
        >
          {emojiForRating(shownRating)}
        </span>
        <span className={`wk-hero__caption${settled ? " is-settled" : ""}`}>
          {endedEarly ? `${caption} · ended early` : caption}
        </span>
      </div>

      <div className="wk-hero__scores">
        <ScoreRow score={volumeScore} label="Volume" index={0} started={inView} />
        <ScoreRow score={intensityScore} label="Intensity" index={1} started={inView} />
        <ScoreRow score={consistencyScore} label="Consistency" index={2} started={inView} />
      </div>
    </div>
  );
}
