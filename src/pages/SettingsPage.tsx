import { useNavigate } from "react-router-dom";
import { resetDatabase } from "../db/db";
import BottomNav from "../components/BottomNav";
import TopBar from "../components/TopBar";
import "./SettingsPage.css";

export default function SettingsPage() {
  const navigate = useNavigate();

  return (
    <main className="settings-page">
      <TopBar title="Settings" />
      <section className="settings-shell">
        <header className="settings-header">
          <p className="settings-eyebrow">Settings</p>
          <h1 className="settings-title">Settings</h1>
        </header>

        <div className="settings-section">
          <p className="settings-section-label">Programme</p>
          <div className="settings-card-list">
            <button
              type="button"
              className="settings-nav-card"
              onClick={() => navigate("/config/sessions")}
            >
              <div className="settings-nav-card__body">
                <span className="settings-nav-card__title">
                  Configure sessions
                </span>
                <span className="settings-nav-card__desc">
                  Manage exercises, weights, and rep targets
                </span>
              </div>
              <span className="settings-nav-card__chevron">›</span>
            </button>
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
