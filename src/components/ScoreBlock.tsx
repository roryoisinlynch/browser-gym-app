import useCountUp from "../hooks/useCountUp";

/** How long a score takes to count from 0 to its value, in every report. */
const SCORE_DURATION_MS = 650;

type ScoreAlign = "start" | "center" | "end";

interface ScoreBlockProps {
  score: number;
  label: string;
  /** When the count-up and the bar's growth both begin, measured from `started`. */
  delayMs: number;
  /** While false the score holds at 0, so a block can wait until it's on screen. */
  started: boolean;
  align?: ScoreAlign;
}

/** The met / almost / missed buckets every summary narrative reads. */
function scoreTone(score: number): "green" | "amber" | "red" {
  if (score >= 100) return "green";
  if (score >= 90) return "amber";
  return "red";
}

/**
 * One score in a summary report's hero: the percentage, a bar, and a label.
 *
 * All three reports draw the same object, differing only in how it's aligned —
 * the season lays three out in a centred row, the week stacks three flush-left
 * beside its emoji, and the session mirrors two either side of its medal. The
 * alignment is the only thing a caller chooses; the type, the bar and the timing
 * curve are fixed so no report can drift away from the others.
 *
 * The start delay rides on a custom property rather than nth-child rules,
 * because the session's two blocks live in separate grid cells where their
 * position in the DOM says nothing about their position in the sequence.
 */
export default function ScoreBlock({
  score,
  label,
  delayMs,
  started,
  align = "center",
}: ScoreBlockProps) {
  const shown = useCountUp(score, SCORE_DURATION_MS, {
    delayMs,
    enabled: started,
  });

  return (
    <div
      className={`sum-score sum-score--${scoreTone(score)} sum-score--${align}`}
      style={{ "--score-delay": `${delayMs}ms` } as React.CSSProperties}
    >
      <span className="sum-score__pct">{shown}%</span>
      <span className="sum-score__track">
        <span
          className="sum-score__fill"
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </span>
      <span className="sum-score__label">{label}</span>
    </div>
  );
}
