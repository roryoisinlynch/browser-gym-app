import { emojiForRating } from "../services/weekMetrics";
import type { EmojiRating } from "../services/weekMetrics";
import ScoreBlock from "./ScoreBlock";
import useInView from "../hooks/useInView";
import "./WeekGradeHero.css";

interface WeekGradeHeroProps {
  emojiRating: EmojiRating;
  volumeScore: number;
  intensityScore: number;
  consistencyScore: number;
  endedEarly: boolean;
}

const SCORE_START_MS = [250, 500, 750];

/** Mirrors getEmojiRating's thresholds, so glow and face always agree. */
function ratingTone(rating: EmojiRating): "green" | "amber" | "red" {
  if (rating <= 2) return "green";
  if (rating === 3) return "amber";
  return "red";
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
  endedEarly,
}: WeekGradeHeroProps) {
  const [ref, inView] = useInView<HTMLDivElement>();

  return (
    <div className="wk-hero" ref={ref}>
      <span
        className={`wk-hero__emoji wk-hero__emoji--${ratingTone(emojiRating)}`}
        aria-label={endedEarly ? "Week ended early" : `Week rating ${emojiRating}`}
      >
        {emojiForRating(emojiRating)}
      </span>

      <div className="wk-hero__scores">
        <ScoreBlock score={volumeScore} label="Volume" delayMs={SCORE_START_MS[0]} started={inView} align="start" />
        <ScoreBlock score={intensityScore} label="Intensity" delayMs={SCORE_START_MS[1]} started={inView} align="start" />
        <ScoreBlock score={consistencyScore} label="Consistency" delayMs={SCORE_START_MS[2]} started={inView} align="start" />
      </div>
    </div>
  );
}
