import { useEffect, useState } from "react";
import type { HeuristicQuestion } from "../domain/models";
import {
  getQuestions,
  putQuestion,
  deleteQuestion,
} from "../repositories/heuristicsRepository";
import { bulkPutItems } from "../db/db";
import { STORE_NAMES } from "../db/db";
import BottomNav from "../components/BottomNav";
import TopBar from "../components/TopBar";
import "./HeuristicsQuestionsPage.css";

export default function HeuristicsQuestionsPage() {
  const [questions, setQuestions] = useState<HeuristicQuestion[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  async function load() {
    setQuestions(await getQuestions());
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd() {
    const label = newLabel.trim();
    if (!label) return;
    const maxOrder = questions.reduce((m, q) => Math.max(m, q.order), 0);
    await putQuestion({
      id: crypto.randomUUID(),
      label,
      order: maxOrder + 1,
    });
    setNewLabel("");
    load();
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("Delete this question? Historical entries for it will be ignored.");
    if (!confirmed) return;
    await deleteQuestion(id);
    load();
  }

  async function handleMove(id: string, direction: -1 | 1) {
    const idx = questions.findIndex((q) => q.id === id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= questions.length) return;
    const updated = [...questions];
    [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
    // Reassign order values
    const reordered = updated.map((q, i) => ({ ...q, order: i + 1 }));
    await bulkPutItems(STORE_NAMES.heuristicQuestions, reordered);
    setQuestions(reordered);
  }

  async function handleEditSave(id: string) {
    const label = editLabel.trim();
    if (!label) return;
    const q = questions.find((q) => q.id === id);
    if (!q) return;
    await putQuestion({ ...q, label });
    setEditingId(null);
    setEditLabel("");
    load();
  }

  return (
    <main className="hq-page">
      <TopBar title="Manage Questions" backTo="/heuristics" />
      <section className="hq-shell">
        {/* Question list */}
        <div className="hq-list">
          {questions.map((q, idx) => (
            <div key={q.id} className="hq-item">
              {editingId === q.id ? (
                <div className="hq-item__edit-row">
                  <input
                    className="hq-item__input"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleEditSave(q.id)}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="hq-item__save-btn"
                    onClick={() => handleEditSave(q.id)}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="hq-item__cancel-btn"
                    onClick={() => { setEditingId(null); setEditLabel(""); }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="hq-item__display-row">
                  <span className="hq-item__label">{q.label}</span>
                  <div className="hq-item__actions">
                    <button
                      type="button"
                      className="hq-item__action-btn"
                      onClick={() => handleMove(q.id, -1)}
                      disabled={idx === 0}
                      aria-label="Move up"
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16">
                        <path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="hq-item__action-btn"
                      onClick={() => handleMove(q.id, 1)}
                      disabled={idx === questions.length - 1}
                      aria-label="Move down"
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16">
                        <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="hq-item__action-btn"
                      onClick={() => { setEditingId(q.id); setEditLabel(q.label); }}
                      aria-label="Edit"
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="hq-item__action-btn hq-item__action-btn--danger"
                      onClick={() => handleDelete(q.id)}
                      aria-label="Delete"
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16">
                        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add new */}
        <div className="hq-add">
          <input
            className="hq-add__input"
            placeholder="New question…"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <button
            type="button"
            className="hq-add__btn"
            onClick={handleAdd}
            disabled={!newLabel.trim()}
          >
            Add
          </button>
        </div>
      </section>
      <BottomNav activeTab="heuristics" />
    </main>
  );
}
