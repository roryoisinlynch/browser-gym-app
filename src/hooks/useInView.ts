import { useCallback, useRef, useState } from "react";

/**
 * Latches true the first time the element intersects the viewport, then stops
 * observing — sections animate in once and never replay on scroll-back.
 *
 * Returns a ref *callback* rather than a ref object so it fires when the node
 * mounts. Content on this page appears behind a PageLoader, so a ref object
 * read in an effect would still be null on the pass that matters.
 *
 * Reduced-motion users (and anything without IntersectionObserver) start
 * revealed, matching the CSS contract where the un-animated state is final.
 */
export default function useInView<T extends HTMLElement>(
  rootMargin = "0px 0px -12% 0px"
): [(node: T | null) => void, boolean] {
  const startsShown =
    typeof IntersectionObserver === "undefined" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const [shown, setShown] = useState(startsShown);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback(
    (node: T | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (!node || startsShown) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          setShown(true);
          observer.disconnect();
          observerRef.current = null;
        },
        { rootMargin }
      );
      observer.observe(node);
      observerRef.current = observer;
    },
    [rootMargin, startsShown]
  );

  return [ref, shown];
}
