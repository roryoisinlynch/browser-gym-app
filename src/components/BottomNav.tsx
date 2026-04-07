import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getActiveDestinationRoute } from "../repositories/programRepository";
import "./BottomNav.css";

type BottomNavTab = "home" | "session" | "settings" | "none";

interface BottomNavProps {
  activeTab: BottomNavTab;
}

function getTabClass(tab: BottomNavTab, activeTab: BottomNavTab) {
  return tab === activeTab
    ? "bottom-nav__link bottom-nav__link--active"
    : "bottom-nav__link";
}

export default function BottomNav({ activeTab }: BottomNavProps) {
  const [sessionPath, setSessionPath] = useState("/week");

  useEffect(() => {
    async function loadSessionPath() {
      try {
        setSessionPath(await getActiveDestinationRoute());
      } catch (error) {
        console.error("Failed to load active destination:", error);
        setSessionPath("/week");
      }
    }

    loadSessionPath();
  }, []);

  return (
    <nav className="bottom-nav" aria-label="Primary">
      <Link
        to="/"
        className={`${getTabClass("home", activeTab)} bottom-nav__link--side bottom-nav__link--left`}
        aria-label="Home"
      >
        <span className="bottom-nav__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="bottom-nav__svg">
            <path
              d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </Link>

      <Link
        to={sessionPath}
        className={`${getTabClass("session", activeTab)} bottom-nav__link--center`}
        aria-label="Current session"
      >
        <span
          className="bottom-nav__icon bottom-nav__icon--plus"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="bottom-nav__svg">
            <path
              d="M12 5v14M5 12h14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </Link>

      <Link
        to="/settings"
        className={`${getTabClass("settings", activeTab)} bottom-nav__link--side bottom-nav__link--right`}
        aria-label="Settings"
      >
        <span className="bottom-nav__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="bottom-nav__svg">
            <rect
              x="3"
              y="4"
              width="18"
              height="7"
              rx="3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <circle
              cx="17"
              cy="7.5"
              r="2.1"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <rect
              x="3"
              y="13"
              width="18"
              height="7"
              rx="3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <circle
              cx="7"
              cy="16.5"
              r="2.1"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            />
          </svg>
        </span>
      </Link>
    </nav>
  );
}