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
            <path
              d="M9.67 4.2 9.4 5.57a6.9 6.9 0 0 0-1.5.87L6.7 5.92 4.92 7.7l.52 1.2c-.35.47-.64.97-.87 1.5L3.2 10.67v2.66l1.37.27c.23.53.52 1.03.87 1.5l-.52 1.2 1.78 1.78 1.2-.52c.47.35.97.64 1.5.87l.27 1.37h2.66l.27-1.37c.53-.23 1.03-.52 1.5-.87l1.2.52 1.78-1.78-.52-1.2c.35-.47.64-.97.87-1.5l1.37-.27v-2.66l-1.37-.27a6.9 6.9 0 0 0-.87-1.5l.52-1.2-1.78-1.78-1.2.52a6.9 6.9 0 0 0-1.5-.87L14.33 4.2z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx="12"
              cy="12"
              r="2.6"
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