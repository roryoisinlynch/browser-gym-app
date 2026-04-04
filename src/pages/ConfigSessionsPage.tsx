import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SessionTemplateListItem } from "../repositories/programRepository";
import { getAllSessionTemplateListItems } from "../repositories/programRepository";
import type { WeekTemplate } from "../domain/models";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import "./ConfigSessionsPage.css";

export default function ConfigSessionsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<SessionTemplateListItem[]>([]);

  useEffect(() => {
    getAllSessionTemplateListItems().then(setItems);
  }, []);

  const byWeek = new Map<
    string,
    { weekTemplate: WeekTemplate; sessions: SessionTemplateListItem[] }
  >();
  for (const item of items) {
    const key = item.weekTemplate.id;
    if (!byWeek.has(key)) {
      byWeek.set(key, { weekTemplate: item.weekTemplate, sessions: [] });
    }
    byWeek.get(key)!.sessions.push(item);
  }

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

        {Array.from(byWeek.values()).map(({ weekTemplate, sessions }) => (
          <div key={weekTemplate.id} className="config-sessions__week-group">
            <p className="config-sessions__week-label">
              {weekTemplate.label ?? weekTemplate.name}
              {weekTemplate.targetRir != null && (
                <span className="config-sessions__week-rir">
                  {" "}· RIR {weekTemplate.targetRir}
                </span>
              )}
            </p>
            <div className="config-sessions__session-list">
              {sessions.map(({ sessionTemplate }) => (
                <button
                  key={sessionTemplate.id}
                  type="button"
                  className="config-sessions__session-card"
                  onClick={() =>
                    navigate(`/config/sessions/${sessionTemplate.id}`)
                  }
                >
                  <span className="config-sessions__session-name">
                    {sessionTemplate.name}
                  </span>
                  <span className="config-sessions__session-chevron">›</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>
      <BottomNav activeTab="settings" />
    </main>
  );
}
