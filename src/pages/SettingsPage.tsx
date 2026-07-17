import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { resetDatabase } from "../db/db";
import {
  isHeuristicsEnabled,
  setHeuristicsEnabled,
  seedDefaultQuestions,
} from "../repositories/heuristicsRepository";
import { resetAllTutorials } from "../repositories/tutorialsRepository";
import {
  endYearInReviewPreview,
  isYearInReviewPreviewActive,
  startYearInReviewPreview,
} from "../services/yearInReview";
import BottomNav from "../components/BottomNav";
import TopBar from "../components/TopBar";
import "./SettingsPage.css";

export default function SettingsPage() {
  const navigate = useNavigate();
  const [heuristicsOn, setHeuristicsOn] = useState(false);
  const [tutorialsResetMsg, setTutorialsResetMsg] = useState<string | null>(null);
  const [yirPreviewOn, setYirPreviewOn] = useState(() => isYearInReviewPreviewActive());

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

  // TEMPORARY: Year in Review preview; remove this handler and its settings
  // card (plus the preview helpers in services/yearInReview.ts) after testing.
  async function handleYirPreview() {
    if (yirPreviewOn) {
      await endYearInReviewPreview();
      setYirPreviewOn(false);
    } else {
      await startYearInReviewPreview();
      // Full reload to the dashboard so the app-open interstitial fires,
      // exactly as it would on a real late-December open.
      window.location.assign(import.meta.env.BASE_URL);
    }
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

        {/* TEMPORARY: remove after Year in Review has been tested live. */}
        <div className="settings-section">
          <p className="settings-section-label">Preview</p>
          <div className="settings-card-list">
            <button
              type="button"
              className="settings-nav-card"
              onClick={handleYirPreview}
            >
              <div className="settings-nav-card__body">
                <span className="settings-nav-card__title">
                  {yirPreviewOn
                    ? "End Year in Review preview"
                    : "Preview Year in Review"}
                </span>
                <span className="settings-nav-card__desc">
                  {yirPreviewOn
                    ? "Back to the real date, and the December prompt is restored"
                    : "Temporary: simulates late December so you can try the feature with this year's data"}
                </span>
              </div>
              {!yirPreviewOn && <span className="settings-nav-card__chevron">›</span>}
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
