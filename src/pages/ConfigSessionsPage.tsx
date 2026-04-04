import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SessionTemplate } from "../domain/models";
import { getAllSessionTemplateListItems } from "../repositories/programRepository";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import "./ConfigSessionsPage.css";

export default function ConfigSessionsPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionTemplate[]>([]);

  useEffect(() => {
    getAllSessionTemplateListItems().then((items) =>
      setSessions(items.map((i) => i.sessionTemplate))
    );
  }, []);

  return (
    <main className="config-sessions-page">
      <TopBar title="Programme" backTo="/settings" backLabel="Settings" />
      <section className="config-sessions-shell">
        <header className="config-sessions-header">
          <p className="config-sessions-eyebrow">Configuration</p>
          <h1 className="config-sessions-title">Sessions</h1>
          <p className="config-sessions-subtitle">
            Select a session to view and edit its exercises.
          </p>
        </header>

        <div className="config-sessions__session-list">
          {sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              className="config-sessions__session-card"
              onClick={() => navigate(`/config/sessions/${session.id}`)}
            >
              <span className="config-sessions__session-name">
                {session.name}
              </span>
              <span className="config-sessions__session-chevron">›</span>
            </button>
          ))}
        </div>
      </section>
      <BottomNav activeTab="settings" />
    </main>
  );
}
