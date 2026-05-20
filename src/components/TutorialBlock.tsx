import { useEffect, useState } from "react";
import {
  dismissTutorial,
  isTutorialDismissed,
  type TutorialId,
} from "../repositories/tutorialsRepository";
import "./TutorialBlock.css";

interface Props {
  id: TutorialId;
  title: string;
  blurb: string;
  children?: React.ReactNode;
  // Render children directly without the inset preview panel — useful when
  // the child already has its own panel chrome (e.g. dashboard-timeline).
  unwrapped?: boolean;
}

// Each tutorial block remembers its own dismissed state via the meta store.
// While the state is loading we render nothing so dismissed blocks don't
// flicker into view on dashboard mount.
export default function TutorialBlock({ id, title, blurb, children, unwrapped }: Props) {
  const [state, setState] = useState<"loading" | "visible" | "dismissed">("loading");

  useEffect(() => {
    let cancelled = false;
    isTutorialDismissed(id).then((d) => {
      if (cancelled) return;
      setState(d ? "dismissed" : "visible");
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleDismiss() {
    setState("dismissed");
    await dismissTutorial(id);
  }

  if (state !== "visible") return null;

  return (
    <section className="tutorial-block" aria-label={`Tutorial: ${title}`}>
      <header className="tutorial-block__header">
        <div className="tutorial-block__header-text">
          <span className="tutorial-block__pill">Tutorial</span>
          <h3 className="tutorial-block__title">{title}</h3>
        </div>
        <button
          type="button"
          className="tutorial-block__dismiss"
          onClick={handleDismiss}
          aria-label="Dismiss tutorial"
        >
          ×
        </button>
      </header>
      {children && (
        unwrapped
          ? <div className="tutorial-block__preview-bare">{children}</div>
          : <div className="tutorial-block__preview">{children}</div>
      )}
      <p className="tutorial-block__blurb">{blurb}</p>
    </section>
  );
}
