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
  saveSessionTemplate,
  saveSessionTemplateMuscleGroup,
  deleteSessionTemplateMuscleGroupById,
} from "../repositories/programRepository";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import MuscleGroupPicker from "../components/MuscleGroupPicker";
import SessionGroupScreen from "../components/SessionGroupScreen";
import TargetLengthScreen from "../components/TargetLengthScreen";
import "./ConfigSessionDetailPage.css";

// The page carries no boxes and no inline controls. Hierarchy comes from type:
// the muscle group and its set target lead, exercises sit under them as plain
// rows, and the accent marks only what can be tapped to change something.
// Steppers, remove and the target length field live in sub-screens.

type SubScreenKind =
  | { kind: "none" }
  | { kind: "group"; stmgId: string }
  | { kind: "add-group" }
  | { kind: "target-length" };

function Chevron() {
  return (
    <svg className="config-session-detail__chevron" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export default function ConfigSessionDetailPage() {
  const { sessionTemplateId } = useParams<{ sessionTemplateId: string }>();
  const navigate = useNavigate();

  const [sessionTemplate, setSessionTemplate] = useState<SessionTemplate | null>(null);
  const [sections, setSections] = useState<SessionTemplateGroupWithExercises[]>([]);
  const [allMuscleGroups, setAllMuscleGroups] = useState<MuscleGroup[]>([]);

  const [subScreen, setSubScreen] = useState<SubScreenKind>({ kind: "none" });
  const [isSaving, setIsSaving] = useState(false);

  function closeSubScreen() {
    setSubScreen({ kind: "none" });
  }

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

  async function handleSaveTargetMinutes(minutes: number | null) {
    closeSubScreen();
    if (!sessionTemplate) return;
    if (minutes === (sessionTemplate.targetSessionMinutes ?? null)) return;
    await saveSessionTemplate({ ...sessionTemplate, targetSessionMinutes: minutes });
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
      closeSubScreen();
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
    closeSubScreen();
    await loadData();
  }

  if (!sessionTemplate) return null;

  const totalSets = sections.reduce(
    (sum, s) => sum + s.sessionTemplateMuscleGroup.targetWorkingSets,
    0
  );

  const openGroup =
    subScreen.kind === "group"
      ? sections.find((s) => s.sessionTemplateMuscleGroup.id === subScreen.stmgId)
      : undefined;

  return (
    <main className="config-session-detail-page">
      <TopBar
        title={sessionTemplate.name}
        backTo={`/config/programs/${sessionTemplate.seasonTemplateId}`}
        backLabel="Program"
      />
      <section className="config-session-detail-shell">
        <p className="config-session-detail__lead">
          {sections.length === 0 ? (
            "No muscle groups yet."
          ) : (
            <>
              <strong>{totalSets}</strong> working {totalSets === 1 ? "set" : "sets"} across{" "}
              {plural(sections.length, "muscle group", "muscle groups")}
            </>
          )}
        </p>

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

        {sections.length > 0 && (
          <div className="config-session-detail__groups">
            {sections.map((section) => {
              const stmg = section.sessionTemplateMuscleGroup;
              return (
                <section key={stmg.id} className="config-session-detail__group">
                  <button
                    type="button"
                    className="config-session-detail__group-header"
                    onClick={() => setSubScreen({ kind: "group", stmgId: stmg.id })}
                    aria-label={`${section.muscleGroup.name}, ${plural(stmg.targetWorkingSets, "set", "sets")}. Edit target sets or remove.`}
                  >
                    <span className="config-session-detail__group-name">
                      {section.muscleGroup.name}
                    </span>
                    <span className="config-session-detail__group-value">
                      <span className="config-session-detail__group-sets">
                        <span className="config-session-detail__group-count">
                          {stmg.targetWorkingSets}
                        </span>
                        <span className="config-session-detail__group-unit">
                          {stmg.targetWorkingSets === 1 ? "set" : "sets"}
                        </span>
                      </span>
                      <Chevron />
                    </span>
                  </button>

                  <div className="config-session-detail__list">
                    {section.exercises.map(({ exerciseTemplate }) => (
                      <button
                        key={exerciseTemplate.id}
                        type="button"
                        className="config-session-detail__row"
                        onClick={() =>
                          navigate(
                            `/config/exercises/${exerciseTemplate.id}?stmgId=${stmg.id}&muscleGroupId=${stmg.muscleGroupId}`
                          )
                        }
                      >
                        <span className="config-session-detail__row-name">
                          {exerciseTemplate.exerciseName}
                        </span>
                        <Chevron />
                      </button>
                    ))}
                    <button
                      type="button"
                      className="config-session-detail__add"
                      onClick={() =>
                        navigate(
                          `/config/exercises/new?stmgId=${stmg.id}&muscleGroupId=${stmg.muscleGroupId}`
                        )
                      }
                    >
                      + Add exercise
                    </button>
                  </div>
                </section>
              );
            })}
          </div>
        )}

        <button
          type="button"
          className="config-session-detail__add-group"
          onClick={() => setSubScreen({ kind: "add-group" })}
        >
          + Add muscle group
        </button>

        <section className="config-session-detail__session">
          <p className="config-session-detail__label">Session</p>
          <button
            type="button"
            className="config-session-detail__row config-session-detail__row--bordered"
            onClick={() => setSubScreen({ kind: "target-length" })}
          >
            <span className="config-session-detail__row-name">Target length</span>
            <span className="config-session-detail__row-value">
              <span>
                {sessionTemplate.targetSessionMinutes != null
                  ? `${sessionTemplate.targetSessionMinutes} min`
                  : "Not set"}
              </span>
              <Chevron />
            </span>
          </button>
        </section>
      </section>
      <BottomNav activeTab="program" />

      {openGroup && (
        <SessionGroupScreen
          name={openGroup.muscleGroup.name}
          targetWorkingSets={openGroup.sessionTemplateMuscleGroup.targetWorkingSets}
          exerciseCount={openGroup.exercises.length}
          onChangeTarget={(delta) =>
            handleUpdateTarget(openGroup.sessionTemplateMuscleGroup.id, delta)
          }
          onRemove={() => handleDeleteSection(openGroup.sessionTemplateMuscleGroup.id)}
          onClose={closeSubScreen}
        />
      )}
      {subScreen.kind === "add-group" && (
        <MuscleGroupPicker
          muscleGroups={allMuscleGroups}
          inSessionIds={new Set(sections.map((s) => s.sessionTemplateMuscleGroup.muscleGroupId))}
          busy={isSaving}
          onSelect={(muscleGroupId) => handleAddSection(muscleGroupId)}
          onCreate={(newName) => handleAddSection({ newName })}
          onClose={closeSubScreen}
        />
      )}
      {subScreen.kind === "target-length" && (
        <TargetLengthScreen
          initial={sessionTemplate.targetSessionMinutes ?? null}
          onSave={handleSaveTargetMinutes}
          onClose={closeSubScreen}
        />
      )}
    </main>
  );
}
