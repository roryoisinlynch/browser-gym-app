import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { SessionInstanceListItem } from "../repositories/programRepository";
import { getSessionInstanceListItemsForCurrentWeek } from "../repositories/programRepository";
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

function getCurrentSessionPath(items: SessionInstanceListItem[]) {
  const inProgress = items.find(
    ({ sessionInstance }) => sessionInstance.status === "in_progress"
  );

  if (inProgress) {
    return `/session/${inProgress.sessionInstance.id}`;
  }

  const nextNotStarted = items.find(
    ({ sessionInstance }) => sessionInstance.status === "not_started"
  );

  if (nextNotStarted) {
    return `/session/${nextNotStarted.sessionInstance.id}`;
  }

  const firstItem = items[0];

  if (firstItem) {
    return `/session/${firstItem.sessionInstance.id}`;
  }

  return "/week";
}

export default function BottomNav({ activeTab }: BottomNavProps) {
  const [sessionPath, setSessionPath] = useState("/week");

  useEffect(() => {
    async function loadSessionPath() {
      try {
        const items = await getSessionInstanceListItemsForCurrentWeek();
        setSessionPath(getCurrentSessionPath(items));
      } catch (error) {
        console.error("Failed to load current session path:", error);
        setSessionPath("/week");
      }
    }

    loadSessionPath();
  }, []);

  return (
    <nav className="bottom-nav" aria-label="Primary">
      <Link to="/" className={getTabClass("home", activeTab)} aria-label="Home">
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
        <span className="bottom-nav__label">Home</span>
      </Link>

      <Link
        to={sessionPath}
        className={getTabClass("session", activeTab)}
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
        <span className="bottom-nav__label">Session</span>
      </Link>

      <Link
        to="/settings"
        className={getTabClass("settings", activeTab)}
        aria-label="Settings"
      >
        <span className="bottom-nav__icon bottom-nav__icon--gear" aria-hidden="true">
          ⚙
        </span>
        <span className="bottom-nav__label">Settings</span>
      </Link>
    </nav>
  );
}