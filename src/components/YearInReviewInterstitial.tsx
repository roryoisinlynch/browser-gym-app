import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getYearInReviewState,
  hasAnyReviewData,
} from "../services/yearInReview";
import {
  hasSeenYearInReviewPrompt,
  markYearInReviewPromptSeen,
} from "../repositories/yearInReviewRepository";
import "./YearInReviewInterstitial.css";

/**
 * Once-per-review-year prompt shown over whatever route the app opened on
 * during the review window. Either choice persists the per-year flag; the
 * dashboard CTA stays available for the rest of the window regardless.
 */
export default function YearInReviewInterstitial() {
  const navigate = useNavigate();
  const [reviewYear, setReviewYear] = useState<number | null>(null);
  const primaryRef = useRef<HTMLButtonElement | null>(null);
  const secondaryRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    // Desktop gets the QR gate everywhere; never show (or burn the flag) there
    // so the phone still gets prompted.
    if (window.innerWidth >= 1024) return;
    // A deep link straight to the review needs no prompt.
    const path = window.location.pathname.replace(/\/+$/, "");
    if (path.endsWith("/year-in-review")) return;

    const state = getYearInReviewState();
    if (!state.inWindow) return;

    let cancelled = false;
    (async () => {
      const [seen, hasData] = await Promise.all([
        hasSeenYearInReviewPrompt(state.reviewYear),
        hasAnyReviewData(state.reviewYear),
      ]);
      if (!cancelled && !seen && hasData) setReviewYear(state.reviewYear);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (reviewYear == null) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    primaryRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, [reviewYear]);

  if (reviewYear == null) return null;

  function choose(showReview: boolean) {
    const year = reviewYear!;
    setReviewYear(null);
    // Fire-and-forget: a failed flag write must not block (or silently
    // swallow) the navigation; worst case the prompt shows once more.
    void markYearInReviewPromptSeen(year).catch(() => {});
    if (showReview) navigate("/year-in-review");
  }

  // Keep Tab cycling between the dialog's two buttons; everything behind the
  // opaque overlay is presented as inert by aria-modal.
  function trapFocus(e: React.KeyboardEvent) {
    if (e.key !== "Tab") return;
    const first = primaryRef.current;
    const last = secondaryRef.current;
    if (!first || !last) return;
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    } else if (active !== first && active !== last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="yir-interstitial"
      role="dialog"
      aria-modal="true"
      aria-label="Year in review is ready"
      onKeyDown={trapFocus}
    >
      <div className="yir-interstitial__inner">
        <p className="yir-interstitial__eyebrow">It's that time of year</p>
        <div className="yir-interstitial__deck" aria-hidden="true">
          <span className="yir-interstitial__frame yir-interstitial__frame--left" />
          <span className="yir-interstitial__frame yir-interstitial__frame--right" />
          <span className="yir-interstitial__frame yir-interstitial__frame--front">
            <span className="yir-interstitial__year">{reviewYear}</span>
          </span>
        </div>
        <h2 className="yir-interstitial__title">Your year in the gym is ready</h2>
        <p className="yir-interstitial__sub">
          Every session, set, and PR from {reviewYear}, wrapped up in a short
          story. Takes about a minute.
        </p>
        <button
          ref={primaryRef}
          type="button"
          className="yir-interstitial__primary"
          onClick={() => choose(true)}
        >
          Show me my year
        </button>
        <button
          ref={secondaryRef}
          type="button"
          className="yir-interstitial__secondary"
          onClick={() => choose(false)}
        >
          Skip for now
        </button>
        <p className="yir-interstitial__footnote">
          You can open it anytime from the dashboard until Jan 31.
        </p>
      </div>
    </div>
  );
}
