import { useEffect, useRef, useState } from "react";
import type { SessionMilestone } from "../repositories/programRepository";
import useCountUp from "../hooks/useCountUp";
import "./MilestoneCelebration.css";

interface MilestoneCelebrationProps {
  /** Non-empty, in play order. */
  milestones: SessionMilestone[];
  /** Fired after the last milestone is tapped through, or on Escape. */
  onDismiss: () => void;
}

/** "an 80kg e1RM" but "a 70kg e1RM"; only the eighties take "an". */
function articleFor(threshold: number): string {
  return String(threshold).startsWith("8") ? "an" : "a";
}

function milestoneSentence(milestone: SessionMilestone): string {
  return `You've reached ${articleFor(milestone.threshold)} ${milestone.threshold}kg e1RM on ${milestone.exerciseName}!`;
}

/**
 * One milestone's content, keyed by step index in the parent so each step
 * remounts fresh and the entry animations, confetti, and count-up replay.
 */
function MilestoneStep({ milestone }: { milestone: SessionMilestone }) {
  const shown = useCountUp(milestone.threshold, 700);
  return (
    <div className="milestone-celebration__step">
      <p className="milestone-celebration__eyebrow">New milestone</p>
      <div className="milestone-celebration__ring" aria-hidden="true">
        <span className="milestone-celebration__number">{shown}kg</span>
        <div className="milestone-celebration__confetti">
          {Array.from({ length: 14 }, (_, i) => (
            <span
              key={i}
              style={
                {
                  "--i": i,
                  "--dx": `${Math.cos((i / 14) * Math.PI * 2) * 140}px`,
                  "--dy": `${Math.sin((i / 14) * Math.PI * 2) * 120 - 40}px`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      </div>
      <p className="milestone-celebration__copy">{milestoneSentence(milestone)}</p>
    </div>
  );
}

/**
 * Full-screen interstitial shown over the session report when the session
 * crossed one or more 10kg all-time e1RM milestones. Steps play sequentially;
 * tapping anywhere (or the CTA) advances, Escape skips straight to the report.
 */
export default function MilestoneCelebration({
  milestones,
  onDismiss,
}: MilestoneCelebrationProps) {
  const [index, setIndex] = useState(0);
  const ctaRef = useRef<HTMLButtonElement | null>(null);
  const isLast = index >= milestones.length - 1;
  const current = milestones[index];

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    ctaRef.current?.focus();
  }, [index]);

  function advance() {
    if (isLast) onDismiss();
    else setIndex(index + 1);
  }

  // The CTA is the dialog's only focusable element; keep Tab parked on it.
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      onDismiss();
    } else if (e.key === "Tab") {
      e.preventDefault();
      ctaRef.current?.focus();
    }
  }

  return (
    <div
      className="milestone-celebration"
      role="dialog"
      aria-modal="true"
      aria-label={milestoneSentence(current)}
      onClick={advance}
      onKeyDown={handleKeyDown}
    >
      <MilestoneStep key={index} milestone={current} />
      {milestones.length > 1 && (
        <div className="milestone-celebration__dots" aria-hidden="true">
          {milestones.map((_, i) => (
            <span
              key={i}
              className={`milestone-celebration__dot${i === index ? " is-active" : ""}`}
            />
          ))}
        </div>
      )}
      <button
        ref={ctaRef}
        type="button"
        className="milestone-celebration__cta"
        onClick={(e) => {
          e.stopPropagation();
          advance();
        }}
      >
        {isLast ? "View session report" : "Next"}
      </button>
    </div>
  );
}
