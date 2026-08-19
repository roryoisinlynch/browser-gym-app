import { useEffect, useRef, useState } from "react";
import type { SessionMilestone } from "../repositories/programRepository";
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
  return `You've reached ${articleFor(milestone.threshold)} ${milestone.threshold}kg ${milestone.exerciseName} e1RM!`;
}

/** A confetti burst's identity: remount key plus a random launch geometry. */
function newBurst(n: number) {
  return {
    n,
    angle: Math.random() * Math.PI * 2,
    radius: 0.85 + Math.random() * 0.5,
  };
}

/**
 * One milestone's content, keyed by step index in the parent so each step
 * remounts fresh and the entry animations and confetti replay. The confetti
 * then keeps re-bursting on its own random timer for as long as the step shows.
 */
function MilestoneStep({ milestone }: { milestone: SessionMilestone }) {
  const [burst, setBurst] = useState(() => newBurst(0));

  // Reduced-motion users never see confetti (the pieces stay display: none),
  // so skip the re-burst timer entirely there.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(() => {
        setBurst((current) => newBurst(current.n + 1));
        schedule();
      }, 1600 + Math.random() * 2400);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="milestone-celebration__step">
      <p className="milestone-celebration__eyebrow">New milestone</p>
      <div className="milestone-celebration__ring" aria-hidden="true">
        <span className="milestone-celebration__number">{milestone.threshold}kg</span>
        <div className="milestone-celebration__confetti" key={burst.n}>
          {Array.from({ length: 14 }, (_, i) => (
            <span
              key={i}
              style={
                {
                  "--i": i,
                  "--dx": `${Math.cos(burst.angle + (i / 14) * Math.PI * 2) * 140 * burst.radius}px`,
                  "--dy": `${Math.sin(burst.angle + (i / 14) * Math.PI * 2) * 120 * burst.radius - 40}px`,
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
