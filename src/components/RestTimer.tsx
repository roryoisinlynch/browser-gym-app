import { useEffect, useState } from "react";
import "./RestTimer.css";

/** Hide the timer once rest exceeds this; longer gaps aren't rest. */
const MAX_REST_SECONDS = 30 * 60;

/**
 * 500ms, not 1000ms: a 1s interval phase-drifts against second boundaries,
 * making the displayed second occasionally hold ~2s or skip. Identical
 * elapsed values bail out of re-rendering, so this still costs ~1 render/s.
 */
const TICK_MS = 500;

interface RestTimerProps {
  /** Epoch ms of the most recent logged set; a new value restarts the timer. */
  anchorMs: number;
}

function elapsedSecondsSince(anchorMs: number): number {
  return Math.max(0, Math.floor((Date.now() - anchorMs) / 1000));
}

function formatMinutesSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function RestTimer({ anchorMs }: RestTimerProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(() =>
    elapsedSecondsSince(anchorMs)
  );

  useEffect(() => {
    setElapsedSeconds(elapsedSecondsSince(anchorMs));

    const interval = window.setInterval(() => {
      setElapsedSeconds(elapsedSecondsSince(anchorMs));
    }, TICK_MS);

    return () => window.clearInterval(interval);
  }, [anchorMs]);

  if (elapsedSeconds >= MAX_REST_SECONDS) {
    return null;
  }

  return <span className="rest-timer">{formatMinutesSeconds(elapsedSeconds)}</span>;
}
