import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type {
  MuscleGroup,
  SessionTemplate,
  SessionTemplateMuscleGroup,
} from "../domain/models";
import type { SessionTemplateGroupWithExercises } from "../repositories/programRepository";
import {
  getAllMuscleGroups,
  getSessionTemplateById,
  getSessionTemplateGroupsWithExercises,
  saveMuscleGroup,
  saveSessionTemplateMuscleGroup,
  deleteSessionTemplateMuscleGroupById,
} from "../repositories/programRepository";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import "./ConfigSessionDetailPage.css";

function weightModeLabel(mode: string): string {
  if (mode === "bodyweight") return "BW";
  if (mode === "explicit_list") return "List";
  return "Inc";
}

export default function ConfigSessionDetailPage() {
  const { sessionTemplateId } = useParams<{ sessionTemplateId: string }>();
  const navigate = useNavigate();

  const [sessionTemplate, setSessionTemplate] =
    useState<SessionTemplate | null>(null);
  const [sections, setSections] = useState<SessionTemplateGroupWithExercises[]>([]);
  const [allMuscleGroups, setAllMuscleGroups] = useState<MuscleGroup[]>([]);

  // Add-section form state
  const [showAddSection, setShowAddSection] = useState(false);
  const [selectedMuscleGroupId, setSelectedMuscleGroupId] = useState("");
  const [newMuscleGroupName, setNewMuscleGroupName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function loadData() {
    if (!sessionTemplateId) return;

    const [tmpl, groups, muscleGroups] = await Promise.all([
      getSessionTemplateById(sessionTemplateId),
      getSessionTemplateGroupsWithExercises(sessionTemplateId),
      getAllMuscleGroups(),
    ]);

    if (!tmpl) return;
    setSessionTemplate(tmpl);
    setAllMuscleGroups(muscleGroups);
    setSections(groups.sort((a, b) => a.sessionTemplateMuscleGroup.order - b.sessionTemplateMuscleGroup.order));
  }

  useEffect(() => {
    loadData();
  }, [sessionTemplateId]);

  async function handleAddSection() {
    if (!sessionTemplateId) return;

    setIsSaving(true);
    try {
      let muscleGroupId = selectedMuscleGroupId;

      if (selectedMuscleGroupId === "__new__") {
        const trimmed = newMuscleGroupName.trim();
        if (!trimmed) return;
        const newMG: MuscleGroup = {
          id: crypto.randomUUID(),
          name: trimmed,
          order: allMuscleGroups.length + 1,
        };
        await saveMuscleGroup(newMG);
        muscleGroupId = newMG.id;
      }

      if (!muscleGroupId) return;

      const newStmg: SessionTemplateMuscleGroup = {
        id: crypto.randomUUID(),
        sessionTemplateId,
        muscleGroupId,
        order: sections.length + 1,
        targetWorkingSets: 3,
      };
      await saveSessionTemplateMuscleGroup(newStmg);
      setShowAddSection(false);
      setSelectedMuscleGroupId("");
      setNewMuscleGroupName("");
      await loadData();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteSection(stmgId: string) {
    const confirmed = window.confirm(
      "Remove this muscle group section and all its exercises?"
    );
    if (!confirmed) return;
    await deleteSessionTemplateMuscleGroupById(stmgId);
    await loadData();
  }

  if (!sessionTemplate) return null;

  return (
    <main className="config-session-detail-page">
      <TopBar
        title={sessionTemplate.name}
        backTo={`/config/programs/${sessionTemplate.seasonTemplateId}`}
        backLabel="Program"
      />
      <section className="config-session-detail-shell">
        <header className="config-session-detail-header">
          <p className="config-session-detail-eyebrow">Session</p>
          <h1 className="config-session-detail-title">{sessionTemplate.name}</h1>
        </header>

        {sections.map((section) => {
          const stmg = section.sessionTemplateMuscleGroup;
          return (
            <div key={stmg.id} className="config-session-detail__section">
              <div className="config-session-detail__section-header">
                <p className="config-session-detail__section-name">
                  {section.muscleGroup.name}
                </p>
                <button
                  type="button"
                  className="config-session-detail__section-delete"
                  onClick={() => handleDeleteSection(stmg.id)}
                  aria-label={`Remove ${section.muscleGroup.name} section`}
                >
                  ✕
                </button>
              </div>

              {section.exercises.length === 0 ? (
                <p className="config-session-detail__empty">No exercises yet.</p>
              ) : (
                <div className="config-session-detail__exercise-list">
                  {section.exercises.map(({ exerciseTemplate, movementType }) => (
                    <button
                      key={exerciseTemplate.id}
                      type="button"
                      className="config-session-detail__exercise-row"
                      onClick={() =>
                        navigate(
                          `/config/exercises/${exerciseTemplate.id}?stmgId=${stmg.id}&muscleGroupId=${stmg.muscleGroupId}`
                        )
                      }
                    >
                      <div className="config-session-detail__exercise-info">
                        <span className="config-session-detail__exercise-name">
                          {exerciseTemplate.exerciseName}
                        </span>
                        <span className="config-session-detail__exercise-meta">
                          {movementType.name}
                        </span>
                      </div>
                      <div className="config-session-detail__exercise-right">
                        <span className="config-session-detail__mode-badge">
                          {weightModeLabel(exerciseTemplate.weightMode)}
                        </span>
                        <span className="config-session-detail__reps">
                          {exerciseTemplate.weightMode === "bodyweight"
                            ? "BW reps"
                            : exerciseTemplate.prescribedWeight != null
                            ? `${exerciseTemplate.prescribedWeight}kg`
                            : "AMRAP"}
                        </span>
                        <span className="config-session-detail__exercise-chevron">
                          ›
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                className="config-session-detail__add-exercise-btn"
                onClick={() =>
                  navigate(
                    `/config/exercises/new?stmgId=${stmg.id}&muscleGroupId=${stmg.muscleGroupId}`
                  )
                }
              >
                + Add exercise
              </button>
            </div>
          );
        })}

        {showAddSection ? (
          <div className="config-session-detail__add-section-form">
            <p className="config-session-detail__add-section-title">
              Add muscle group section
            </p>
            <select
              className="config-session-detail__select"
              value={selectedMuscleGroupId}
              onChange={(e) => setSelectedMuscleGroupId(e.target.value)}
            >
              <option value="">Select muscle group…</option>
              {allMuscleGroups.map((mg) => (
                <option key={mg.id} value={mg.id}>
                  {mg.name}
                </option>
              ))}
              <option value="__new__">+ Create new</option>
            </select>

            {selectedMuscleGroupId === "__new__" && (
              <input
                className="config-session-detail__input"
                placeholder="Muscle group name"
                value={newMuscleGroupName}
                onChange={(e) => setNewMuscleGroupName(e.target.value)}
              />
            )}

            <div className="config-session-detail__add-section-actions">
              <button
                type="button"
                className="config-session-detail__btn config-session-detail__btn--secondary"
                onClick={() => {
                  setShowAddSection(false);
                  setSelectedMuscleGroupId("");
                  setNewMuscleGroupName("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="config-session-detail__btn config-session-detail__btn--primary"
                disabled={
                  isSaving ||
                  !selectedMuscleGroupId ||
                  (selectedMuscleGroupId === "__new__" &&
                    !newMuscleGroupName.trim())
                }
                onClick={handleAddSection}
              >
                Add section
              </button>
            </div>
          </div>
        ) : (
          <div className="config-session-detail__footer">
            <button
              type="button"
              className="config-session-detail__btn config-session-detail__btn--ghost"
              onClick={() => setShowAddSection(true)}
            >
              + Add muscle group section
            </button>
          </div>
        )}
      </section>
      <BottomNav activeTab="settings" />
    </main>
  );
}
