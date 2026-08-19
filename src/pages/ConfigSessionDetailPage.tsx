import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type {
  ExerciseTemplate,
  MovementType,
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
  saveExerciseTemplate,
  saveSessionTemplate,
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

// ── Draggable exercise row ────────────────────────────────────────────────────

interface DraggableExerciseRowProps {
  exerciseTemplate: ExerciseTemplate;
  movementType: MovementType;
  stmg: SessionTemplateMuscleGroup;
  onNavigate: () => void;
}

function DraggableExerciseRow({
  exerciseTemplate,
  movementType,
  stmg,
  onNavigate,
}: DraggableExerciseRowProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: exerciseTemplate.id,
    data: { fromStmgId: stmg.id, exerciseTemplate },
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`config-session-detail__exercise-row${isDragging ? " config-session-detail__exercise-row--dragging" : ""}`}
      style={style}
      onClick={onNavigate}
      {...attributes}
    >
      <span
        className="config-session-detail__drag-handle"
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        aria-label="Drag to move to another muscle group"
      >
        ⠿
      </span>
      <div className="config-session-detail__exercise-info">
        <span className="config-session-detail__exercise-name">
          {exerciseTemplate.exerciseName}
        </span>
        <span className="config-session-detail__exercise-meta">{movementType.name}</span>
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
        <span className="config-session-detail__exercise-chevron">›</span>
      </div>
    </button>
  );
}

// ── Droppable section body ────────────────────────────────────────────────────

interface DroppableSectionBodyProps {
  stmgId: string;
  isEmpty: boolean;
  children: React.ReactNode;
}

function DroppableSectionBody({ stmgId, isEmpty, children }: DroppableSectionBodyProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stmgId });
  return (
    <div
      ref={setNodeRef}
      className={`config-session-detail__exercise-list${isOver ? " config-session-detail__exercise-list--over" : ""}${isEmpty ? " config-session-detail__exercise-list--empty" : ""}`}
    >
      {children}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

function parseTargetMinutes(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed);
  return rounded >= 1 ? rounded : null;
}

export default function ConfigSessionDetailPage() {
  const { sessionTemplateId } = useParams<{ sessionTemplateId: string }>();
  const navigate = useNavigate();

  const [sessionTemplate, setSessionTemplate] = useState<SessionTemplate | null>(null);
  const [sections, setSections] = useState<SessionTemplateGroupWithExercises[]>([]);
  const [allMuscleGroups, setAllMuscleGroups] = useState<MuscleGroup[]>([]);

  // Add-section form state
  const [showAddSection, setShowAddSection] = useState(false);
  const [selectedMuscleGroupId, setSelectedMuscleGroupId] = useState("");
  const [newMuscleGroupName, setNewMuscleGroupName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Target session length field state
  const [targetMinutesInput, setTargetMinutesInput] = useState("");
  const [targetTooltipOpen, setTargetTooltipOpen] = useState(false);
  const targetTooltipRef = useRef<HTMLDivElement | null>(null);

  // Drag overlay state
  const [activeExerciseTemplate, setActiveExerciseTemplate] =
    useState<ExerciseTemplate | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  async function loadData() {
    if (!sessionTemplateId) return;

    const [tmpl, groups, muscleGroups] = await Promise.all([
      getSessionTemplateById(sessionTemplateId),
      getSessionTemplateGroupsWithExercises(sessionTemplateId),
      getAllMuscleGroups(),
    ]);

    if (!tmpl) return;
    setSessionTemplate(tmpl);
    setTargetMinutesInput(
      tmpl.targetSessionMinutes != null ? String(tmpl.targetSessionMinutes) : ""
    );
    setAllMuscleGroups(muscleGroups);
    setSections(
      groups.sort(
        (a, b) =>
          a.sessionTemplateMuscleGroup.order - b.sessionTemplateMuscleGroup.order
      )
    );
  }

  useEffect(() => {
    loadData();
  }, [sessionTemplateId]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!targetTooltipRef.current?.contains(e.target as Node)) {
        setTargetTooltipOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleSaveTargetMinutes() {
    if (!sessionTemplate) return;
    const parsed = parseTargetMinutes(targetMinutesInput);
    if (parsed === (sessionTemplate.targetSessionMinutes ?? null)) {
      // No-op write, but re-normalize whatever was typed (e.g. "abc" or "0").
      setTargetMinutesInput(parsed != null ? String(parsed) : "");
      return;
    }
    await saveSessionTemplate({ ...sessionTemplate, targetSessionMinutes: parsed });
    await loadData();
  }

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

  async function handleUpdateTarget(stmgId: string, delta: number) {
    const section = sections.find((s) => s.sessionTemplateMuscleGroup.id === stmgId);
    if (!section) return;
    const stmg = section.sessionTemplateMuscleGroup;
    const newTarget = Math.max(1, stmg.targetWorkingSets + delta);
    await saveSessionTemplateMuscleGroup({ ...stmg, targetWorkingSets: newTarget });
    await loadData();
  }

  async function handleDeleteSection(stmgId: string) {
    const confirmed = window.confirm(
      "Remove this muscle group section and all its exercises?"
    );
    if (!confirmed) return;
    await deleteSessionTemplateMuscleGroupById(stmgId);
    await loadData();
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveExerciseTemplate(event.active.data.current?.exerciseTemplate ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveExerciseTemplate(null);
    const { active, over } = event;
    if (!over) return;

    const fromStmgId = active.data.current?.fromStmgId as string;
    const toStmgId = over.id as string;
    if (fromStmgId === toStmgId) return;

    const exerciseTemplate = active.data.current?.exerciseTemplate as ExerciseTemplate;
    await saveExerciseTemplate({
      ...exerciseTemplate,
      sessionTemplateMuscleGroupId: toStmgId,
    });
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
          <p className="config-session-detail-intro">
            Add as many exercises as you like to each muscle group — more than you would
            typically do in a single session. You don't need to do every exercise listed;
            the volume target is driven by the set count at the top of each muscle group,
            not by the number of exercises. A larger exercise list simply gives you more
            variety to pick from each time you train.
          </p>
        </header>

        <div className="config-session-detail__section">
          <div className="config-session-detail__label-row" ref={targetTooltipRef}>
            <p className="config-session-detail__field-label">Target session length</p>
            <button
              type="button"
              className="config-session-detail__info-btn"
              aria-expanded={targetTooltipOpen}
              onClick={() => setTargetTooltipOpen((v) => !v)}
            >?</button>
            {targetTooltipOpen && (
              <div className="config-session-detail__info-tooltip">
                <strong>Target session length</strong> is optional and can be
                left blank. It does not affect session, week, or season scores.
                During a session it shows a progress bar indicating how closely
                you are tracking your ideal session duration.
              </div>
            )}
          </div>
          <div className="config-session-detail__target-minutes-row">
            <input
              className="config-session-detail__input config-session-detail__target-minutes-input"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              placeholder="e.g. 60"
              value={targetMinutesInput}
              onChange={(e) => setTargetMinutesInput(e.target.value)}
              onBlur={handleSaveTargetMinutes}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              aria-label="Target session length in minutes"
            />
            <span className="config-session-detail__target-minutes-unit">min</span>
          </div>
        </div>

        {/* Warnings */}
        {(() => {
          const warnings: string[] = [];

          const totalSets = sections.reduce(
            (sum, s) => sum + s.sessionTemplateMuscleGroup.targetWorkingSets,
            0
          );
          if (sections.length > 0 && totalSets < 5) {
            warnings.push(
              "There are fewer than 5 target working sets (this should typically be around 15)"
            );
          }
          if (sections.length > 0 && totalSets > 25) {
            warnings.push(
              "There are more than 25 target working sets (this should typically be around 15)"
            );
          }

          if (sections.length > 0 && sections.length < 2) {
            warnings.push(
              "Session has fewer than 2 muscle groups (there would typically be 2 or 3)"
            );
          }

          const lowSetGroups = sections.filter(
            (s) => s.sessionTemplateMuscleGroup.targetWorkingSets < 3
          );
          if (lowSetGroups.length > 0) {
            warnings.push(
              `${lowSetGroups.length} muscle ${lowSetGroups.length === 1 ? "group has" : "groups have"} fewer than 3 target working sets: ${lowSetGroups.map((s) => s.muscleGroup.name).join(", ")}`
            );
          }

          const noExerciseGroups = sections.filter((s) => s.exercises.length === 0);
          if (noExerciseGroups.length > 0) {
            warnings.push(
              `${noExerciseGroups.length} muscle ${noExerciseGroups.length === 1 ? "group has" : "groups have"} no exercises: ${noExerciseGroups.map((s) => s.muscleGroup.name).join(", ")}`
            );
          }

          if (warnings.length === 0) return null;

          return (
            <div className="config-session-detail__warnings">
              <p className="config-session-detail__warnings-title">
                {warnings.length} {warnings.length === 1 ? "warning" : "warnings"}
              </p>
              <ul className="config-session-detail__warnings-list">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          );
        })()}

        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {sections.map((section) => {
            const stmg = section.sessionTemplateMuscleGroup;
            return (
              <div key={stmg.id} className="config-session-detail__section">
                <div className="config-session-detail__section-header">
                  <p className="config-session-detail__section-name">
                    {section.muscleGroup.name}
                  </p>
                  <div className="config-session-detail__target-stepper">
                    <button
                      type="button"
                      className="config-session-detail__target-btn"
                      onClick={() => handleUpdateTarget(stmg.id, -1)}
                      disabled={stmg.targetWorkingSets <= 1}
                      aria-label="Decrease target sets"
                    >
                      −
                    </button>
                    <span className="config-session-detail__target-value">
                      {stmg.targetWorkingSets}
                    </span>
                    <button
                      type="button"
                      className="config-session-detail__target-btn"
                      onClick={() => handleUpdateTarget(stmg.id, 1)}
                      aria-label="Increase target sets"
                    >
                      +
                    </button>
                    <span className="config-session-detail__target-label">sets</span>
                  </div>
                  <button
                    type="button"
                    className="config-session-detail__section-delete"
                    onClick={() => handleDeleteSection(stmg.id)}
                    aria-label={`Remove ${section.muscleGroup.name} section`}
                  >
                    ✕
                  </button>
                </div>

                <DroppableSectionBody stmgId={stmg.id} isEmpty={section.exercises.length === 0}>
                  {section.exercises.length === 0 ? (
                    <p className="config-session-detail__empty">No exercises yet.</p>
                  ) : (
                    section.exercises.map(({ exerciseTemplate, movementType }) => (
                      <DraggableExerciseRow
                        key={exerciseTemplate.id}
                        exerciseTemplate={exerciseTemplate}
                        movementType={movementType}
                        stmg={stmg}
                        onNavigate={() =>
                          navigate(
                            `/config/exercises/${exerciseTemplate.id}?stmgId=${stmg.id}&muscleGroupId=${stmg.muscleGroupId}`
                          )
                        }
                      />
                    ))
                  )}
                </DroppableSectionBody>

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

          <DragOverlay>
            {activeExerciseTemplate ? (
              <div className="config-session-detail__exercise-row config-session-detail__exercise-row--overlay">
                <span className="config-session-detail__drag-handle" aria-hidden>
                  ⠿
                </span>
                <div className="config-session-detail__exercise-info">
                  <span className="config-session-detail__exercise-name">
                    {activeExerciseTemplate.exerciseName}
                  </span>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

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
                  (selectedMuscleGroupId === "__new__" && !newMuscleGroupName.trim())
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
      <BottomNav activeTab="program" />
    </main>
  );
}
