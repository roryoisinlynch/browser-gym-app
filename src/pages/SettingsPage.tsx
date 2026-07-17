import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { resetDatabase } from "../db/db";
import {
  isHeuristicsEnabled,
  setHeuristicsEnabled,
  seedDefaultQuestions,
} from "../repositories/heuristicsRepository";
import { resetAllTutorials } from "../repositories/tutorialsRepository";
import { getReviewableYears } from "../services/yearInReview";
import BottomNav from "../components/BottomNav";
import TopBar from "../components/TopBar";
import "./SettingsPage.css";

export default function SettingsPage() {
  const navigate = useNavigate();
  const [heuristicsOn, setHeuristicsOn] = useState(false);
  const [tutorialsResetMsg, setTutorialsResetMsg] = useState<string | null>(null);
  // Null until the hidden gesture unlocks the preview; then the years worth
  // previewing (most recent first).
  const [previewYears, setPreviewYears] = useState<number[] | null>(null);
  const [previewYear, setPreviewYear] = useState<number | null>(null);

  useEffect(() => {
    isHeuristicsEnabled().then(setHeuristicsOn);
  }, []);

  async function handleToggleHeuristics() {
    const next = !heuristicsOn;
    await setHeuristicsEnabled(next);
    if (next) await seedDefaultQuestions();
    setHeuristicsOn(next);
  }

  async function handleResetTutorials() {
    await resetAllTutorials();
    setTutorialsResetMsg("Tutorials re-enabled");
    setTimeout(() => setTutorialsResetMsg(null), 2000);
  }

  // Hidden entry to the Year in Review preview deck, so the feature can be
  // shown for a chosen year outside the real Dec 25 - Jan 31 window (there is
  // no address bar in the installed PWA to reach ?preview directly): five quick
  // taps on the "Settings" title reveal the year selector below. The real
  // gated flow never passes a year, so it always shows the year just past.
  const tapCountRef = useRef(0);
  const lastTapRef = useRef(0);
  async function unlockPreview() {
    const years = await getReviewableYears();
    const list = years.length > 0 ? years : [new Date().getFullYear() - 1];
    setPreviewYears(list);
    setPreviewYear((prev) => prev ?? list[0]);
  }
  function handleTitleTap() {
    const now = Date.now();
    tapCountRef.current = now - lastTapRef.current < 600 ? tapCountRef.current + 1 : 1;
    lastTapRef.current = now;
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      void unlockPreview();
    }
  }

  return (
    <main className="settings-page">
      <TopBar title="Settings" onTitleTap={handleTitleTap} />
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
              onClick={() => navigate("/seasons")}
            >
              <div className="settings-nav-card__body">
                <span className="settings-nav-card__title">View season records</span>
                <span className="settings-nav-card__desc">
                  Browse and delete seasons
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
          <p className="settings-section-label">Tutorials</p>
          <div className="settings-card-list">
            <button
              type="button"
              className="settings-nav-card"
              onClick={handleResetTutorials}
            >
              <div className="settings-nav-card__body">
                <span className="settings-nav-card__title">Re-enable tutorials</span>
                <span className="settings-nav-card__desc">
                  {tutorialsResetMsg ?? "Reset all dismissed tutorial blocks on the dashboard"}
                </span>
              </div>
            </button>
          </div>
        </div>

        {previewYears && previewYear != null && (
          <div className="settings-section">
            <p className="settings-section-label">Preview</p>
            <div className="settings-card-list">
              <div className="settings-nav-card settings-nav-card--toggle">
                <div className="settings-nav-card__body">
                  <span className="settings-nav-card__title">Year in Review</span>
                  <span className="settings-nav-card__desc">
                    Open the deck for a chosen year, outside the usual window
                  </span>
                </div>
                <select
                  className="settings-year-select"
                  value={previewYear}
                  onChange={(e) => setPreviewYear(Number(e.target.value))}
                  aria-label="Preview year"
                >
                  {previewYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="settings-nav-card"
                onClick={() => navigate(`/year-in-review?preview=${previewYear}`)}
              >
                <div className="settings-nav-card__body">
                  <span className="settings-nav-card__title">Open preview</span>
                  <span className="settings-nav-card__desc">
                    Preview {previewYear} in Review
                  </span>
                </div>
                <span className="settings-nav-card__chevron">›</span>
              </button>
            </div>
          </div>
        )}

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
