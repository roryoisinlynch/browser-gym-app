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
import type {
  ExerciseTemplate,
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
import MuscleGroupPicker from "../components/MuscleGroupPicker";
import "./ConfigSessionDetailPage.css";

// ── Section label with a "?" tooltip ──────────────────────────────────────────

interface InfoLabelProps {
  label: string;
  children: React.ReactNode;
}

function InfoLabel({ label, children }: InfoLabelProps) {
  const [open, setOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!rowRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="config-session-detail__label-row" ref={rowRef}>
      <p className="config-session-detail__section-label">{label}</p>
      <button
        type="button"
        className="config-session-detail__info-btn"
        aria-expanded={open}
        aria-label={`About ${label.toLowerCase()}`}
        onClick={() => setOpen((v) => !v)}
      >?</button>
      {open && <div className="config-session-detail__info-tooltip">{children}</div>}
    </div>
  );
}

// ── Exercise row ──────────────────────────────────────────────────────────────

function exerciseWeightLabel(exerciseTemplate: ExerciseTemplate): string {
  if (exerciseTemplate.weightMode === "bodyweight") return "BW reps";
  return exerciseTemplate.prescribedWeight != null
    ? `${exerciseTemplate.prescribedWeight}kg`
    : "AMRAP";
}

// Shared by the row and its DragOverlay copy so the two are identical.
function ExerciseCardBody({ exerciseTemplate }: { exerciseTemplate: ExerciseTemplate }) {
  return (
    <>
      <span className="config-session-detail__exercise-name">
        {exerciseTemplate.exerciseName}
      </span>
      <span className="config-session-detail__exercise-right">
        <span className="config-session-detail__exercise-weight">
          {exerciseWeightLabel(exerciseTemplate)}
        </span>
        <span className="config-session-detail__exercise-chevron">›</span>
      </span>
    </>
  );
}

interface DraggableExerciseRowProps {
  exerciseTemplate: ExerciseTemplate;
  stmg: SessionTemplateMuscleGroup;
  onNavigate: () => void;
}

// The row stays put while it is dragged; the DragOverlay copy is what moves.
function DraggableExerciseRow({
  exerciseTemplate,
  stmg,
  onNavigate,
}: DraggableExerciseRowProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: exerciseTemplate.id,
    data: { fromStmgId: stmg.id, exerciseTemplate },
  });

  return (
    <div
      ref={setNodeRef}
      className={`config-session-detail__exercise-row${isDragging ? " config-session-detail__exercise-row--dragging" : ""}`}
    >
      <span
        className="config-session-detail__drag-handle"
        {...attributes}
        {...listeners}
        aria-label={`Drag ${exerciseTemplate.exerciseName} to another muscle group`}
      >
        ⠿
      </span>
      <button
        type="button"
        className="config-session-detail__exercise-card"
        onClick={onNavigate}
      >
        <ExerciseCardBody exerciseTemplate={exerciseTemplate} />
      </button>
    </div>
  );
}

// ── Droppable muscle group ────────────────────────────────────────────────────

interface DroppableGroupProps {
  stmgId: string;
  children: React.ReactNode;
}

// The whole group is the drop target, header and add button included, so an
// exercise can be dropped anywhere on the group it is moving to.
function DroppableGroup({ stmgId, children }: DroppableGroupProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stmgId });
  return (
    <div
      ref={setNodeRef}
      className={`config-session-detail__group${isOver ? " config-session-detail__group--over" : ""}`}
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

  // Add muscle group sub-screen
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Target session length field state
  const [targetMinutesInput, setTargetMinutesInput] = useState("");

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

  // `pick` is an existing muscle group's id, or the name of one to create.
  async function handleAddSection(pick: string | { newName: string }) {
    if (!sessionTemplateId || isSaving) return;

    setIsSaving(true);
    try {
      let muscleGroupId: string;

      if (typeof pick === "string") {
        muscleGroupId = pick;
      } else {
        const newMG: MuscleGroup = {
          id: crypto.randomUUID(),
          name: pick.newName,
          order: allMuscleGroups.length + 1,
        };
        await saveMuscleGroup(newMG);
        muscleGroupId = newMG.id;
      }

      const newStmg: SessionTemplateMuscleGroup = {
        id: crypto.randomUUID(),
        sessionTemplateId,
        muscleGroupId,
        order: sections.length + 1,
        targetWorkingSets: 3,
      };
      await saveSessionTemplateMuscleGroup(newStmg);
      setPickerOpen(false);
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
    await deleteSessionTemplateMuscleGroupById(stmgId);
    setConfirmDeleteId(null);
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

  const totalSets = sections.reduce(
    (sum, s) => sum + s.sessionTemplateMuscleGroup.targetWorkingSets,
    0
  );

  return (
    <main className="config-session-detail-page">
      <TopBar
        title={sessionTemplate.name}
        backTo={`/config/programs/${sessionTemplate.seasonTemplateId}`}
        backLabel="Program"
      />
      <section className="config-session-detail-shell">

        {/* Target session length */}
        <div className="config-session-detail__section">
          <InfoLabel label="Target session length">
            <strong>Target session length</strong> is optional and can be
            left blank. It does not affect session, week, or season scores.
            During a session it shows a progress bar indicating how closely
            you are tracking your ideal session duration.
          </InfoLabel>
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
            <div className="config-session-detail__section">
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
            </div>
          );
        })()}

        {/* Muscle groups */}
        <div className="config-session-detail__section">
          <InfoLabel label="Muscle groups">
            Add as many exercises as you like to each muscle group, more than you would
            typically do in a single session. You don't need to do every exercise listed;
            the volume target is driven by the set count next to each muscle group, not
            by the number of exercises. A larger exercise list simply gives you more
            variety to pick from each time you train.
          </InfoLabel>
          <p className="config-session-detail__hint">
            {sections.length === 0
              ? "No muscle groups yet."
              : `Target working sets: ${totalSets}`}
          </p>

          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="config-session-detail__group-list">
              {sections.map((section) => {
                const stmg = section.sessionTemplateMuscleGroup;
                const confirming = confirmDeleteId === stmg.id;
                const exerciseCount = section.exercises.length;
                return (
                  <DroppableGroup key={stmg.id} stmgId={stmg.id}>
                    <div className="config-session-detail__group-header">
                      <p className="config-session-detail__group-name">
                        {section.muscleGroup.name}
                      </p>
                      {confirming ? (
                        <div className="config-session-detail__delete-confirm">
                          <button
                            type="button"
                            className="config-session-detail__delete-confirm-yes"
                            onClick={() => handleDeleteSection(stmg.id)}
                          >
                            Remove
                          </button>
                          <button
                            type="button"
                            className="config-session-detail__delete-confirm-no"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="config-session-detail__stepper">
                            <button
                              type="button"
                              className="config-session-detail__stepper-btn"
                              onClick={() => handleUpdateTarget(stmg.id, -1)}
                              disabled={stmg.targetWorkingSets <= 1}
                              aria-label={`Decrease ${section.muscleGroup.name} target sets`}
                            >
                              −
                            </button>
                            <span className="config-session-detail__stepper-value">
                              {stmg.targetWorkingSets}
                            </span>
                            <button
                              type="button"
                              className="config-session-detail__stepper-btn"
                              onClick={() => handleUpdateTarget(stmg.id, 1)}
                              aria-label={`Increase ${section.muscleGroup.name} target sets`}
                            >
                              +
                            </button>
                            <span className="config-session-detail__stepper-label">sets</span>
                          </div>
                          <button
                            type="button"
                            className="config-session-detail__delete-btn"
                            onClick={() => setConfirmDeleteId(stmg.id)}
                            aria-label={`Remove ${section.muscleGroup.name}`}
                          >
                            ✕
                          </button>
                        </>
                      )}
                    </div>

                    {confirming && exerciseCount > 0 && (
                      <p className="config-session-detail__delete-note">
                        This also removes its {exerciseCount}{" "}
                        {exerciseCount === 1 ? "exercise" : "exercises"}.
                      </p>
                    )}

                    <div className="config-session-detail__exercise-list">
                      {exerciseCount === 0 ? (
                        <p className="config-session-detail__empty">No exercises yet.</p>
                      ) : (
                        section.exercises.map(({ exerciseTemplate }) => (
                          <DraggableExerciseRow
                            key={exerciseTemplate.id}
                            exerciseTemplate={exerciseTemplate}
                            stmg={stmg}
                            onNavigate={() =>
                              navigate(
                                `/config/exercises/${exerciseTemplate.id}?stmgId=${stmg.id}&muscleGroupId=${stmg.muscleGroupId}`
                              )
                            }
                          />
                        ))
                      )}
                    </div>

                    <button
                      type="button"
                      className="config-session-detail__add-btn"
                      onClick={() =>
                        navigate(
                          `/config/exercises/new?stmgId=${stmg.id}&muscleGroupId=${stmg.muscleGroupId}`
                        )
                      }
                    >
                      + Add exercise
                    </button>
                  </DroppableGroup>
                );
              })}
            </div>

            <DragOverlay>
              {activeExerciseTemplate ? (
                <div className="config-session-detail__exercise-row config-session-detail__exercise-row--overlay">
                  <span className="config-session-detail__drag-handle" aria-hidden>
                    ⠿
                  </span>
                  <div className="config-session-detail__exercise-card">
                    <ExerciseCardBody exerciseTemplate={activeExerciseTemplate} />
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          <button
            type="button"
            className="config-session-detail__add-btn config-session-detail__add-btn--group"
            onClick={() => setPickerOpen(true)}
          >
            + Add muscle group
          </button>
        </div>

      </section>
      <BottomNav activeTab="program" />

      {pickerOpen && (
        <MuscleGroupPicker
          muscleGroups={allMuscleGroups}
          inSessionIds={new Set(sections.map((s) => s.sessionTemplateMuscleGroup.muscleGroupId))}
          busy={isSaving}
          onSelect={(muscleGroupId) => handleAddSection(muscleGroupId)}
          onCreate={(newName) => handleAddSection({ newName })}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </main>
  );
}
