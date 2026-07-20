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

function ScoreBlock({
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
      <span className="wk-score__pct">{shown}%</span>
      <span className="wk-score__track">
        <span
          className="wk-score__fill"
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </span>
      <span className="wk-score__label">{label}</span>
    </div>
  );
}

/**
 * The week's headline: its emoji rating on the left, with volume, intensity and
 * consistency stacked beside it as the same blocks the season report lays out
 * in a row.
 *
 * Deliberately quieter than the season's grade: the scores count up, but the
 * face is simply there from the start. The cycling slot-machine reveal belongs
 * to the season report, so each report up the chain earns a little more
 * ceremony than the one below it.
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

  return (
    <div className="wk-hero" ref={ref}>
      <div className={`wk-hero__face wk-hero__face--${ratingTone(emojiRating)}`}>
        <span
          className="wk-hero__emoji"
          aria-label={endedEarly ? "Week ended early" : `Week rating ${emojiRating}`}
        >
          {emojiForRating(emojiRating)}
        </span>
        <span className="wk-hero__caption">
          {endedEarly ? `${caption} · ended early` : caption}
        </span>
      </div>

      <div className="wk-hero__scores">
        <ScoreBlock score={volumeScore} label="Volume" index={0} started={inView} />
        <ScoreBlock score={intensityScore} label="Intensity" index={1} started={inView} />
        <ScoreBlock score={consistencyScore} label="Consistency" index={2} started={inView} />
      </div>
    </div>
  );
}
