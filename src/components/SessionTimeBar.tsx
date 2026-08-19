import { useEffect, useState } from "react";

/**
 * 1000ms is enough here (unlike RestTimer's 500ms): the readout is whole
 * minutes and the fill moves subpixel per second, so second-boundary phase
 * drift is invisible.
 */
const TICK_MS = 1000;

interface SessionTimeBarProps {
  /** Target length in minutes; caller only renders the bar when > 0. */
  targetMinutes: number;
  /** Epoch ms of the first logged set; null until a real set exists. */
  anchorMs: number | null;
  /** First-to-last-set span in seconds for finished sessions; null = not derivable. */
  frozenDurationSeconds: number | null;
  /** Finished sessions freeze the bar: no interval, complete track tint. */
  finished: boolean;
}

function elapsedSecondsSince(anchorMs: number): number {
  return Math.max(0, Math.floor((Date.now() - anchorMs) / 1000));
}

export default function SessionTimeBar({
  targetMinutes,
  anchorMs,
  frozenDurationSeconds,
  finished,
}: SessionTimeBarProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(() =>
    anchorMs != null ? elapsedSecondsSince(anchorMs) : 0
  );

  useEffect(() => {
    if (finished || anchorMs == null) {
      return;
    }

    setElapsedSeconds(elapsedSecondsSince(anchorMs));

    const interval = window.setInterval(() => {
      setElapsedSeconds(elapsedSecondsSince(anchorMs));
    }, TICK_MS);

    return () => window.clearInterval(interval);
  }, [anchorMs, finished]);

  const displaySeconds = finished
    ? frozenDurationSeconds ?? 0
    : anchorMs == null
      ? 0
      : elapsedSeconds;

  const targetSeconds = targetMinutes * 60;
  const percentage = Math.min(100, (displaySeconds / targetSeconds) * 100);
  const overtime = displaySeconds >= targetSeconds;
  const elapsedMinutes = Math.floor(displaySeconds / 60);

  return (
    <div className="session-progress-block">
      <div className="session-progress-row">
        <span className="session-progress-label">Time target</span>
        <span className="session-progress-value">
          {elapsedMinutes} / {targetMinutes} min
        </span>
      </div>

      <div
        className={`session-progress-track${
          finished ? " session-progress-track--complete" : ""
        }`}
        aria-label={`Time target ${elapsedMinutes} of ${targetMinutes} minutes`}
      >
        <span
          className={`session-progress-fill${
            overtime
              ? " session-progress-fill--overdue"
              : finished
                ? " session-progress-fill--complete"
                : ""
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
