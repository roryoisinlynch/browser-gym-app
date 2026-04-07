import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SessionTemplate, SeasonTemplate } from "../domain/models";
import {
  getAllSessionTemplates,
  getSeasonTemplates,
  saveSessionTemplate,
  deleteSessionTemplateById,
} from "../repositories/programRepository";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import "./ConfigSessionsPage.css";

export default function ConfigSessionsPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionTemplate[]>([]);
  const [seasonTemplate, setSeasonTemplate] = useState<SeasonTemplate | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function loadData() {
    const [templates, seasons] = await Promise.all([
      getAllSessionTemplates(),
      getSeasonTemplates(),
    ]);
    setSessions(templates);
    setSeasonTemplate(seasons[0] ?? null);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed || !seasonTemplate) return;
    setIsSaving(true);
    try {
      const template: SessionTemplate = {
        id: crypto.randomUUID(),
        seasonTemplateId: seasonTemplate.id,
        name: trimmed,
        order: sessions.length + 1,
      };
      await saveSessionTemplate(template);
      setNewName("");
      setShowCreate(false);
      await loadData();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteSessionTemplateById(id);
    setConfirmDeleteId(null);
    await loadData();
  }

  return (
    <main className="config-sessions-page">
      <TopBar title="Program" backTo="/settings" backLabel="Settings" />
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
            <div key={session.id} className="config-sessions__session-row">
              <button
                type="button"
                className="config-sessions__session-card"
                onClick={() => navigate(`/config/sessions/${session.id}`)}
              >
                <span className="config-sessions__session-name">
                  {session.name}
                </span>
                <span className="config-sessions__session-chevron">›</span>
              </button>
              {confirmDeleteId === session.id ? (
                <div className="config-sessions__delete-confirm">
                  <span className="config-sessions__delete-confirm-text">Delete?</span>
                  <button
                    type="button"
                    className="config-sessions__delete-confirm-yes"
                    onClick={() => handleDelete(session.id)}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    className="config-sessions__delete-confirm-no"
                    onClick={() => setConfirmDeleteId(null)}
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="config-sessions__delete-btn"
                  onClick={() => setConfirmDeleteId(session.id)}
                  aria-label={`Delete ${session.name}`}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        {showCreate ? (
          <div className="config-sessions__create-form">
            <h2 className="config-sessions__create-title">New Session</h2>
            <label className="config-sessions__create-label">
              Name
              <input
                className="config-sessions__create-input"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Chest Back 1"
                autoFocus
              />
            </label>
            <div className="config-sessions__create-actions">
              <button
                type="button"
                className="config-sessions__create-cancel"
                onClick={() => { setShowCreate(false); setNewName(""); }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="config-sessions__create-save"
                onClick={handleCreate}
                disabled={isSaving || !newName.trim()}
              >
                {isSaving ? "Saving…" : "Create"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="config-sessions__add-btn"
            onClick={() => setShowCreate(true)}
          >
            + New Session
          </button>
        )}
      </section>
      <BottomNav activeTab="settings" />
    </main>
  );
}
