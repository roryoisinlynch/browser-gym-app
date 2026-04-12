import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getActiveDestinationRoute } from "../repositories/programRepository";
import "./BottomNav.css";

type BottomNavTab = "home" | "heuristics" | "session" | "program" | "settings" | "none";

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
      {/* Home */}
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

      {/* Heuristics */}
      <Link
        to="/heuristics"
        className={`${getTabClass("heuristics", activeTab)} bottom-nav__link--inner`}
        aria-label="Heuristics"
      >
        <span className="bottom-nav__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="bottom-nav__svg">
            <rect x="4" y="3" width="16" height="18" rx="2"
                  fill="none" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M8 8h8M8 12h8M8 16h5"
                  fill="none" stroke="currentColor" strokeWidth="1.8"
                  strokeLinecap="round"/>
          </svg>
        </span>
      </Link>

      {/* Session (center) */}
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

      {/* Program */}
      <Link
        to="/config/programs"
        className={`${getTabClass("program", activeTab)} bottom-nav__link--inner`}
        aria-label="Program"
      >
        <span className="bottom-nav__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="bottom-nav__svg">
            <rect x="3" y="3" width="7" height="7" rx="1.5"
                  fill="none" stroke="currentColor" strokeWidth="1.8"/>
            <rect x="14" y="3" width="7" height="7" rx="1.5"
                  fill="none" stroke="currentColor" strokeWidth="1.8"/>
            <rect x="3" y="14" width="7" height="7" rx="1.5"
                  fill="none" stroke="currentColor" strokeWidth="1.8"/>
            <rect x="14" y="14" width="7" height="7" rx="1.5"
                  fill="none" stroke="currentColor" strokeWidth="1.8"/>
          </svg>
        </span>
      </Link>

      {/* Settings */}
      <Link
        to="/settings"
        className={`${getTabClass("settings", activeTab)} bottom-nav__link--side bottom-nav__link--right`}
        aria-label="Settings"
      >
        <span className="bottom-nav__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="bottom-nav__svg">
            <rect x="2" y="3" width="20" height="8" rx="4"
                  fill="none" stroke="currentColor" strokeWidth="1.8"/>
            <circle cx="17" cy="7" r="2" fill="currentColor"/>

            <rect x="2" y="13" width="20" height="8" rx="4"
                  fill="none" stroke="currentColor" strokeWidth="1.8"/>
            <circle cx="7" cy="17" r="2" fill="currentColor"/>
          </svg>
        </span>
      </Link>
    </nav>
  );
}
