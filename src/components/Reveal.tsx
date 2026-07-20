import useInView from "../hooks/useInView";
import "./Reveal.css";

/**
 * Wraps one block of a scrolling page so it rises into view the first time it's
 * reached, instead of the whole page arriving pre-rendered behind the loader.
 *
 * Safe to wrap something that renders nothing: the wrapper collapses when empty
 * (see Reveal.css), so a dismissed tutorial or an absent section leaves no
 * phantom gap in the parent's flex column.
 */
export default function Reveal({ children }: { children?: React.ReactNode }) {
  const [ref, shown] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className={`reveal-block${shown ? " is-in" : ""}`}>
      {children}
    </div>
  );
}
