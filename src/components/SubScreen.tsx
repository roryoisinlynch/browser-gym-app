import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import "./SubScreen.css";

interface SubScreenProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Full-screen sub-screen with a header and a scrolling body, used by the
 * exercise config page for the working weight picker and the available
 * weights wizard. Locks body scroll, closes on Escape, and returns focus to
 * the element that opened it. Local state only: it adds no history entry, so
 * the hardware back button leaves the page rather than closing the
 * sub-screen, like the app's other overlays.
 */
export default function SubScreen({ title, onClose, children }: SubScreenProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
  }

  return (
    <div
      ref={containerRef}
      className="sub-screen"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <header className="sub-screen__header">
        <div className="sub-screen__header-inner">
          <span className="sub-screen__spacer" />
          <h2 className="sub-screen__title">{title}</h2>
          <button
            type="button"
            className="sub-screen__close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </header>
      <div className="sub-screen__body">
        <div className="sub-screen__shell">{children}</div>
      </div>
    </div>
  );
}
