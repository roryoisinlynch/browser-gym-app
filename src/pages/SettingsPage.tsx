import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { resetDatabase } from "../db/db";
import {
  isHeuristicsEnabled,
  setHeuristicsEnabled,
  seedDefaultQuestions,
} from "../repositories/heuristicsRepository";
import BottomNav from "../components/BottomNav";
import TopBar from "../components/TopBar";
import "./SettingsPage.css";

export default function SettingsPage() {
  const navigate = useNavigate();
  const [heuristicsOn, setHeuristicsOn] = useState(false);

  useEffect(() => {
    isHeuristicsEnabled().then(setHeuristicsOn);
  }, []);

  async function handleToggleHeuristics() {
    const next = !heuristicsOn;
    await setHeuristicsEnabled(next);
    if (next) await seedDefaultQuestions();
    setHeuristicsOn(next);
  }

  return (
    <main className="settings-page">
      <TopBar title="Settings" />
      <section className="settings-shell">
        <div className="settings-section">
          <p className="settings-section-label">Heuristics</p>
          <div className="settings-card-list">
            <div className="settings-nav-card settings-nav-card--toggle">
              <div className="settings-nav-card__body">
                <span className="settings-nav-card__title">
                  Enable heuristics tracking
                </span>
                <span className="settings-nav-card__desc">
                  Track daily factors like sleep, hydration, and diet
                </span>
              </div>
              <button
                type="button"
                className={`settings-toggle${heuristicsOn ? " settings-toggle--on" : ""}`}
                onClick={handleToggleHeuristics}
                role="switch"
                aria-checked={heuristicsOn}
                aria-label="Enable heuristics tracking"
              >
                <span className="settings-toggle__knob" />
              </button>
            </div>

            {heuristicsOn && (
              <button
                type="button"
                className="settings-nav-card"
                onClick={() => navigate("/heuristics/questions")}
              >
                <div className="settings-nav-card__body">
                  <span className="settings-nav-card__title">
                    Heuristics settings
                  </span>
                  <span className="settings-nav-card__desc">
                    Manage questions and answers
                  </span>
                </div>
                <span className="settings-nav-card__chevron">›</span>
              </button>
            )}
          </div>
        </div>

        <div className="settings-section">
          <p className="settings-section-label">Data</p>
          <div className="settings-card-list">
            <button
              type="button"
              className="settings-nav-card"
              onClick={() => navigate("/import")}
            >
              <div className="settings-nav-card__body">
                <span className="settings-nav-card__title">Import past sets</span>
                <span className="settings-nav-card__desc">
                  Load historical set data from CSV
                </span>
              </div>
              <span className="settings-nav-card__chevron">›</span>
            </button>

            <button
              type="button"
              className="settings-nav-card"
              onClick={() => navigate("/sets")}
            >
              <div className="settings-nav-card__body">
                <span className="settings-nav-card__title">View set records</span>
                <span className="settings-nav-card__desc">
                  Browse all logged sets
                </span>
              </div>
              <span className="settings-nav-card__chevron">›</span>
            </button>

            <button
              type="button"
              className="settings-nav-card"
              onClick={() => navigate("/backup")}
            >
              <div className="settings-nav-card__body">
                <span className="settings-nav-card__title">Backup &amp; restore</span>
                <span className="settings-nav-card__desc">
                  Export or import a full snapshot of your data
                </span>
              </div>
              <span className="settings-nav-card__chevron">›</span>
            </button>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-card-list">
            <button
              type="button"
              className="settings-nav-card"
              onClick={() => navigate("/share")}
            >
              <div className="settings-nav-card__body">
                <span className="settings-nav-card__title">Share</span>
                <span className="settings-nav-card__desc">
                  Share this app with a friend
                </span>
              </div>
              <span className="settings-nav-card__chevron">›</span>
            </button>
          </div>
        </div>

        <div className="settings-section">
          <p className="settings-section-label">Danger zone</p>
          <div className="settings-card-list">
            <button
              type="button"
              className="settings-nav-card settings-nav-card--danger"
              onClick={async () => {
                const confirmed = window.confirm(
                  "Reset the database? All data will be lost."
                );
                if (!confirmed) return;
                await resetDatabase();
                window.location.reload();
              }}
            >
              <div className="settings-nav-card__body">
                <span className="settings-nav-card__title">Reset database</span>
                <span className="settings-nav-card__desc">
                  Wipe all data and reseed from defaults
                </span>
              </div>
            </button>
          </div>
        </div>
      </section>
      <BottomNav activeTab="settings" />
    </main>
  );
}
