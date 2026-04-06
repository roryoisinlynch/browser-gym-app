import { Link } from "react-router-dom";
import "./TopBar.css";

interface TopBarProps {
  title: string;
  backTo?: string;
  backLabel?: string;
  onBack?: () => void;
}

export default function TopBar({
  title,
  backTo,
  backLabel = "Back",
  onBack,
}: TopBarProps) {
  const backIcon = (
    <svg viewBox="0 0 24 24" className="top-bar__back-icon" aria-hidden="true">
      <path
        d="M15 6l-6 6 6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <header className="top-bar">
      <div className="top-bar__inner">
        <div className="top-bar__side">
          {onBack ? (
            <button type="button" onClick={onBack} className="top-bar__back" aria-label={backLabel}>
              {backIcon}
            </button>
          ) : backTo ? (
            <Link to={backTo} className="top-bar__back" aria-label={backLabel}>
              {backIcon}
            </Link>
          ) : (
            <span className="top-bar__spacer" aria-hidden="true" />
          )}
        </div>

        <h1 className="top-bar__title">{title}</h1>

        <div className="top-bar__side">
          <span className="top-bar__spacer" aria-hidden="true" />
        </div>
      </div>
    </header>
  );
}