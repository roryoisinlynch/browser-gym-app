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
            <circle
              cx="12"
              cy="12"
              r="3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <path
              d="M19.4 12a7.4 7.4 0 0 0-.07-1l2.07-1.61-2-3.46-2.47 1a7.6 7.6 0 0 0-1.73-1L14.8 2h-5.6l-.37 2.93a7.6 7.6 0 0 0-1.73 1l-2.47-1-2 3.46L4.67 11a7.4 7.4 0 0 0 0 2l-2.07 1.61 2 3.46 2.47-1a7.6 7.6 0 0 0 1.73 1L9.2 22h5.6l.37-2.93a7.6 7.6 0 0 0 1.73-1l2.47 1 2-3.46L19.33 13c.05-.33.07-.66.07-1z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </Link>
    </nav>
  );
}