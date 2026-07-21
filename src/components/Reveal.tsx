import type { CSSProperties } from "react";
import useInView from "../hooks/useInView";
import "./Reveal.css";

/**
 * Wraps one block of a scrolling page so it rises into view the first time it's
 * reached, instead of the whole page arriving pre-rendered behind the loader.
 *
 * Safe to wrap something that renders nothing: the wrapper collapses when empty
 * (see Reveal.css), so a dismissed tutorial or an absent section leaves no
 * phantom gap in the parent's flex column.
 *
 * `delayMs` holds this block's own entrance back a beat, so a pair of adjacent
 * blocks can rise one after the other. `staggerContents` instead keeps the block
 * itself still and visible, letting its children stage their own entrance (e.g. a
 * list whose rows cascade in) — the consumer's CSS drives the per-child timing.
 */
export default function Reveal({
  children,
  delayMs,
  staggerContents,
}: {
  children?: React.ReactNode;
  delayMs?: number;
  staggerContents?: boolean;
}) {
  const [ref, shown] = useInView<HTMLDivElement>();
  const className =
    "reveal-block" +
    (staggerContents ? " reveal-block--contents" : "") +
    (shown ? " is-in" : "");
  const style: CSSProperties | undefined =
    delayMs != null ? { animationDelay: `${delayMs}ms` } : undefined;
  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
