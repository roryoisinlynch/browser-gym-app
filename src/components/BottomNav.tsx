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
              d="M12 9.25a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <path
              d="M19.15 12a1.2 1.2 0 0 0 .03-.28 1.2 1.2 0 0 0-.03-.28l1.73-1.35a.45.45 0 0 0 .11-.58l-1.64-2.84a.45.45 0 0 0-.54-.2l-2.04.82a6.9 6.9 0 0 0-.97-.56l-.31-2.17a.45.45 0 0 0-.44-.38h-3.28a.45.45 0 0 0-.44.38l-.31 2.17c-.34.14-.67.33-.97.56l-2.04-.82a.45.45 0 0 0-.54.2L3.01 9.5a.45.45 0 0 0 .11.58l1.73 1.35a1.2 1.2 0 0 0-.03.28c0 .09.01.19.03.28l-1.73 1.35a.45.45 0 0 0-.11.58l1.64 2.84a.45.45 0 0 0 .54.2l2.04-.82c.3.23.63.42.97.56l.31 2.17a.45.45 0 0 0 .44.38h3.28a.45.45 0 0 0 .44-.38l.31-2.17c.34-.14.67-.33.97-.56l2.04.82a.45.45 0 0 0 .54-.2l1.64-2.84a.45.45 0 0 0-.11-.58L19.15 12Z"
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