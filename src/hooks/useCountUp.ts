import { useEffect, useState } from "react";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface CountUpOptions {
  /** Hold at 0 for this long before the count starts, for staggered rows. */
  delayMs?: number;
  /** While false the value stays at 0, so a count can wait until it's on screen. */
  enabled?: boolean;
}

/**
 * Counts from 0 to `target` on an easeOutCubic curve. Reduced-motion users get
 * the final value immediately — including while `enabled` is false, since the
 * hold-at-zero is itself part of the animation.
 */
export default function useCountUp(
  target: number,
  durationMs = 600,
  { delayMs = 0, enabled = true }: CountUpOptions = {}
): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));

  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    if (!enabled) {
      setValue(0);
      return;
    }

    let raf = 0;
    let timer = 0;
    const run = () => {
      const start = performance.now();
      const tick = (t: number) => {
        const p = Math.min((t - start) / durationMs, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        setValue(Math.round(target * eased));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    if (delayMs > 0) timer = window.setTimeout(run, delayMs);
    else run();

    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [target, durationMs, delayMs, enabled]);

  return value;
}
