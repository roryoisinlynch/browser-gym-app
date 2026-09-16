import { useEffect, useRef, type ReactNode } from "react";
import TopBar from "./TopBar";
import "./SubScreen.css";

interface SubScreenProps {
  title: string;
  /** The top bar's back arrow (and Escape). The caller decides whether that
   *  closes the sub-screen or returns to a previous screen inside it. */
  onBack: () => void;
  children: ReactNode;
}

/**
 * Full-screen sub-screen with the app's top bar and a scrolling body, used
 * by the exercise config page for the working weight picker and the
 * available weights wizard. Locks body scroll, and returns focus to the
 * element that opened it when it unmounts. Local state only: it adds no
 * history entry, so the hardware back button leaves the page rather than
 * stepping back inside the sub-screen, like the app's other overlays.
 */
export default function SubScreen({ title, onBack, children }: SubScreenProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Escape is listened for on the document, not the container: a screen
  // change inside the sub-screen unmounts the control that had focus, which
  // drops focus to the body, and a container listener would then miss the key.
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);
  useEffect(() => {
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onBackRef.current();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    containerRef.current?.focus();
    return () => {
      if (opener && opener.isConnected) opener.focus();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="sub-screen"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
    >
      <TopBar title={title} onBack={onBack} backLabel="Back" />
      <div className="sub-screen__body">
        <div className="sub-screen__shell">{children}</div>
      </div>
    </div>
  );
}
