import BottomNav from "../components/BottomNav";
import "./HomePage.css";

import { resetDatabase } from "../db/db";
import { useNavigate } from "react-router-dom";

const navigate = useNavigate();


export default function SettingsPage() {
  return (
    <main className="home-page">
      <section className="home-shell">
        <header className="home-header">
          <p className="home-eyebrow">Settings</p>
          <h1 className="home-title">Settings</h1>
          <p className="home-progress-label">This page does not exist yet.</p>
        </header>
        <button onClick={() => navigate("/import")}>Import past sets</button>
        <button
          onClick={async () => {
            await resetDatabase();
            window.location.reload();
          }}
        >
          Reset Database
        </button>

      </section>

      <BottomNav activeTab="settings" />
    </main>
  );
}


