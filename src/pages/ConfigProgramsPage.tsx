import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SeasonInstance, SeasonTemplate, WeekTemplate } from "../domain/models";
import {
  getSeasonTemplates,
  getActiveSeasonInstance,
  activateProgram,
  saveSeasonTemplate,
  saveWeekTemplate,
  deleteSeasonTemplateById,
} from "../repositories/programRepository";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import "./ConfigProgramsPage.css";

export default function ConfigProgramsPage() {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<SeasonTemplate[]>([]);
  const [activeInstance, setActiveInstance] = useState<SeasonInstance | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRir, setNewRir] = useState("4,3,2,1,0");
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmActivateId, setConfirmActivateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    const [templates, active] = await Promise.all([
      getSeasonTemplates(),
      getActiveSeasonInstance(),
    ]);
    setPrograms(templates);
    setActiveInstance(active ?? null);
  }

  useEffect(() => {
    loadData();
  }, []);

  function parseRir(input: string): number[] | null {
    const parts = input.split(",").map((s) => s.trim());
    if (parts.some((p) => p === "")) return null;
    const nums = parts.map(Number);
    if (nums.some(isNaN)) return null;
    return nums;
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) { setError("Name is required."); return; }
    const rirSequence = parseRir(newRir);
    if (!rirSequence || rirSequence.length === 0) {
      setError("Enter a valid RIR sequence, e.g. 4,3,2,1,0");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const seasonId = crypto.randomUUID();
      const seasonTemplate: SeasonTemplate = {
        id: seasonId,
        name,
        plannedWeekCount: rirSequence.length,
        rirSequence,
      };
      await saveSeasonTemplate(seasonTemplate);

      const weekTemplate: WeekTemplate = {
        id: crypto.randomUUID(),
        seasonTemplateId: seasonId,
        name: "Week Template",
        order: 1,
      };
      await saveWeekTemplate(weekTemplate);

      setNewName("");
      setNewRir("4,3,2,1,0");
      setShowCreate(false);
      navigate(`/config/programs/${seasonId}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleActivate(id: string) {
    await activateProgram(id);
    setConfirmActivateId(null);
    await loadData();
  }

  async function handleDelete(id: string) {
    await deleteSeasonTemplateById(id);
    setConfirmDeleteId(null);
    await loadData();
  }

  const activeTemplateId = activeInstance?.seasonTemplateId ?? null;

  return (
    <main className="config-programs-page">
      <TopBar title="Program" backTo="/settings" backLabel="Settings" />
      <section className="config-programs-shell">
        <header className="config-programs-header">
          <p className="config-programs-eyebrow">Configuration</p>
          <h1 className="config-programs-title">Programs</h1>
          <p className="config-programs-subtitle">
            Select a program to configure its sessions and progression.
          </p>
        </header>

        <div className="config-programs__list">
          {programs.map((program) => {
            const isActive = program.id === activeTemplateId;
            const isConfirmingActivate = confirmActivateId === program.id;
            const isConfirmingDelete = confirmDeleteId === program.id;

            return (
              <div key={program.id} className="config-programs__row">
                <button
                  type="button"
                  className={`config-programs__card${isActive ? " config-programs__card--active" : ""}`}
                  onClick={() => navigate(`/config/programs/${program.id}`)}
                >
                  <span className="config-programs__card-body">
                    <span className="config-programs__card-name">{program.name}</span>
                    {program.rirSequence && (
                      <span className="config-programs__card-rir">
                        RIR {program.rirSequence.join(", ")}
                      </span>
                    )}
                  </span>
                  <span className="config-programs__card-right">
                    {isActive && (
                      <span className="config-programs__active-pill">Active</span>
                    )}
                    <span className="config-programs__chevron">›</span>
                  </span>
                </button>

                {isConfirmingActivate ? (
                  <div className="config-programs__delete-confirm">
                    <span className="config-programs__delete-confirm-text">Switch?</span>
                    <button
                      type="button"
                      className="config-programs__delete-confirm-yes config-programs__delete-confirm-yes--activate"
                      onClick={() => handleActivate(program.id)}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className="config-programs__delete-confirm-no"
                      onClick={() => setConfirmActivateId(null)}
                    >
                      No
                    </button>
                  </div>
                ) : isConfirmingDelete ? (
                  <div className="config-programs__delete-confirm">
                    <span className="config-programs__delete-confirm-text">Delete?</span>
                    <button
                      type="button"
                      className="config-programs__delete-confirm-yes"
                      onClick={() => handleDelete(program.id)}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className="config-programs__delete-confirm-no"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <div className="config-programs__actions">
                    {!isActive && (
                      <button
                        type="button"
                        className="config-programs__activate-btn"
                        onClick={() => setConfirmActivateId(program.id)}
                        aria-label={`Activate ${program.name}`}
                      >
                        ▶
                      </button>
                    )}
                    <button
                      type="button"
                      className="config-programs__delete-btn"
                      onClick={() => setConfirmDeleteId(program.id)}
                      aria-label={`Delete ${program.name}`}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {showCreate ? (
          <div className="config-programs__create-form">
            <h2 className="config-programs__create-title">New Program</h2>
            {error && <p className="config-programs__create-error">{error}</p>}
            <label className="config-programs__create-label">
              Name
              <input
                className="config-programs__create-input"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Base Hypertrophy"
                autoFocus
              />
            </label>
            <label className="config-programs__create-label">
              RIR sequence
              <input
                className="config-programs__create-input"
                type="text"
                value={newRir}
                onChange={(e) => setNewRir(e.target.value)}
                placeholder="e.g. 4,3,2,1,0"
              />
              <span className="config-programs__create-hint">
                Comma-separated RIR targets, one per week
              </span>
            </label>
            <div className="config-programs__create-actions">
              <button
                type="button"
                className="config-programs__create-cancel"
                onClick={() => { setShowCreate(false); setNewName(""); setError(null); }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="config-programs__create-save"
                onClick={handleCreate}
                disabled={isSaving || !newName.trim()}
              >
                {isSaving ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="config-programs__add-btn"
            onClick={() => setShowCreate(true)}
          >
            + New Program
          </button>
        )}
      </section>
      <BottomNav activeTab="settings" />
    </main>
  );
}
