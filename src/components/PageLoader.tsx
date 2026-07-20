import { useEffect, useRef, useState } from "react";
import "./PageLoader.css";

interface PageLoaderProps {
  /** Short factual label, e.g. "Building your week summary…". */
  label: string;
  /** Time in ms for the synthetic bar to log-climb to the 90% cap. */
  durationMs: number;
  /** True once the page's data is loaded; this releases the final 10%. */
  ready: boolean;
  /** Called once the bar has filled to 100% and the loader can dismiss. */
  onDone: () => void;
}

// The synthetic climb stops here and waits for the page to be ready, so the
// bar can never read as "finished" before the content actually is.
const CAP = 90;
// Brief pause at 100% so the eye registers completion before we hand off.
const HOLD_MS = 140;

// Logarithmic ease: quick off the line, decelerating into the cap. Maps
// [0,1] → [0,1] with log(1 + 9x) / log(10).
function logEase(x: number): number {
  return Math.log(1 + 9 * x) / Math.log(10);
}

// Quadratic ease-out for the final release to 100%.
function easeOut(x: number): number {
  return 1 - (1 - x) * (1 - x);
}

/**
 * Centered loading screen shared by the day / week / season summary reports.
 *
 * The bar fills on a time-based logarithmic curve — fast off the line, easing
 * toward a 90% cap over `durationMs` — independent of how far the real load has
 * got. The last 10% is gated on `ready`: once the page's data lands, the bar
 * sweeps from wherever it is to 100% (faster the less distance is left, so a
 * page that loads before the curve finishes still wraps up promptly), then
 * calls `onDone` so the parent can reveal the content.
 */
export default function PageLoader({ label, durationMs, ready, onDone }: PageLoaderProps) {
  const [progress, setProgress] = useState(0);

  // Refs so the single rAF loop reads live values without being torn down and
  // restarted each time `ready` flips or the parent re-renders.
  const readyRef = useRef(ready);
  const onDoneRef = useRef(onDone);
  readyRef.current = ready;
  onDoneRef.current = onDone;

  useEffect(() => {
    let raf = 0;
    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    let start: number | null = null;
    let releaseStart: number | null = null;
    let releaseFrom = 0;
    let releaseMs = 0;
    let current = 0;

    function frame(now: number) {
      if (start === null) start = now;

      let value: number;
      if (readyRef.current) {
        // Release: accelerate from the current fill to 100%. Less remaining
        // distance finishes quicker, so an early-ready page snaps shut.
        if (releaseStart === null) {
          releaseStart = now;
          releaseFrom = current;
          releaseMs = 160 + (100 - releaseFrom) * 2.4;
        }
        const rp = Math.min(1, (now - releaseStart) / releaseMs);
        value = releaseFrom + (100 - releaseFrom) * easeOut(rp);
      } else {
        // Log-climb toward the 90% cap over durationMs.
        const x = Math.min(1, (now - start) / durationMs);
        value = CAP * logEase(x);
      }

      current = value;

      if (value >= 99.9) {
        setProgress(100);
        holdTimer = setTimeout(() => onDoneRef.current(), HOLD_MS);
        return;
      }

      setProgress(value);
      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      if (holdTimer) clearTimeout(holdTimer);
    };
  }, [durationMs]);

  return (
    <div className="page-loader" role="status" aria-live="polite">
      <p className="page-loader__label">{label}</p>
      <div className="page-loader__bar">
        <div className="page-loader__fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
