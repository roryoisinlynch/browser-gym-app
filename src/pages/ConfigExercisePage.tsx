import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { ExerciseTemplate, MovementType, WeightMode } from "../domain/models";
import {
  deleteExerciseTemplateById,
  getExerciseTemplateById,
  getMovementTypeById,
  getMovementTypesByMuscleGroupId,
  saveExerciseTemplate,
  saveMovementType,
} from "../repositories/programRepository";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import "./ConfigExercisePage.css";

export default function ConfigExercisePage() {
  const { exerciseTemplateId } = useParams<{ exerciseTemplateId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const isNew = exerciseTemplateId === "new";
  const stmgId = searchParams.get("stmgId") ?? "";
  const muscleGroupId = searchParams.get("muscleGroupId") ?? "";

  // Form state
  const [exerciseName, setExerciseName] = useState("");
  const [movementTypeId, setMovementTypeId] = useState("");
  const [targetReps, setTargetReps] = useState("8");
  const [repMin, setRepMin] = useState("6");
  const [repMax, setRepMax] = useState("12");
  const [weightMode, setWeightMode] = useState<WeightMode>("increment");
  const [weightIncrement, setWeightIncrement] = useState("2.5");
  const [availableWeights, setAvailableWeights] = useState<number[]>([]);
  const [newWeightInput, setNewWeightInput] = useState("");

  // Movement type options
  const [movementTypes, setMovementTypes] = useState<MovementType[]>([]);
  const [newMovementTypeName, setNewMovementTypeName] = useState("");
  const [resolvedMuscleGroupId, setResolvedMuscleGroupId] = useState(muscleGroupId);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (isNew) {
        if (muscleGroupId) {
          const mts = await getMovementTypesByMuscleGroupId(muscleGroupId);
          setMovementTypes(mts.sort((a, b) => a.order - b.order));
          setResolvedMuscleGroupId(muscleGroupId);
        }
        return;
      }

      if (!exerciseTemplateId) return;

      const template = await getExerciseTemplateById(exerciseTemplateId);
      if (!template) return;

      setExerciseName(template.exerciseName);
      setMovementTypeId(template.movementTypeId);
      setTargetReps(String(template.targetReps));
      setRepMin(String(template.repMin));
      setRepMax(String(template.repMax));
      setWeightMode(template.weightMode);
      setWeightIncrement(String(template.weightIncrement ?? 2.5));
      setAvailableWeights(template.availableWeights ?? []);

      const mt = await getMovementTypeById(template.movementTypeId);
      if (mt) {
        const mgId = mt.muscleGroupId;
        setResolvedMuscleGroupId(mgId);
        const mts = await getMovementTypesByMuscleGroupId(mgId);
        setMovementTypes(mts.sort((a, b) => a.order - b.order));
      }
    }
    load();
  }, [exerciseTemplateId, isNew, muscleGroupId]);

  function addWeight() {
    const val = parseFloat(newWeightInput);
    if (!Number.isFinite(val) || val <= 0) return;
    if (availableWeights.includes(val)) return;
    setAvailableWeights((prev) => [...prev, val].sort((a, b) => a - b));
    setNewWeightInput("");
  }

  function removeWeight(w: number) {
    setAvailableWeights((prev) => prev.filter((v) => v !== w));
  }

  async function handleSave() {
    const name = exerciseName.trim();
    if (!name) { setError("Exercise name is required."); return; }

    let resolvedMovementTypeId = movementTypeId;

    if (movementTypeId === "__new__") {
      const mtName = newMovementTypeName.trim();
      if (!mtName) { setError("Movement type name is required."); return; }
      const newMt: MovementType = {
        id: crypto.randomUUID(),
        muscleGroupId: resolvedMuscleGroupId,
        name: mtName,
        order: movementTypes.length + 1,
      };
      await saveMovementType(newMt);
      resolvedMovementTypeId = newMt.id;
    }

    if (!resolvedMovementTypeId) {
      setError("Please select a movement type.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const template: ExerciseTemplate = {
        id: isNew ? crypto.randomUUID() : exerciseTemplateId!,
        sessionTemplateMuscleGroupId: isNew
          ? stmgId
          : (await getExerciseTemplateById(exerciseTemplateId!))
              ?.sessionTemplateMuscleGroupId ?? stmgId,
        movementTypeId: resolvedMovementTypeId,
        exerciseName: name,
        targetReps: Math.max(1, parseInt(targetReps) || 1),
        repMin: Math.max(1, parseInt(repMin) || 1),
        repMax: Math.max(1, parseInt(repMax) || 1),
        rirSequence: [],
        weightMode,
        ...(weightMode === "increment"
          ? { weightIncrement: parseFloat(weightIncrement) || 2.5 }
          : {}),
        ...(weightMode === "explicit_list"
          ? { availableWeights: [...availableWeights].sort((a, b) => a - b) }
          : {}),
      };

      await saveExerciseTemplate(template);
      navigate(-1);
    } catch {
      setError("Could not save exercise.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!exerciseTemplateId || isNew) return;
    const confirmed = window.confirm(
      `Delete "${exerciseName}"? This cannot be undone.`
    );
    if (!confirmed) return;
    await deleteExerciseTemplateById(exerciseTemplateId);
    navigate(-1);
  }

  return (
    <main className="config-exercise-page">
      <TopBar
        title={isNew ? "New exercise" : "Edit exercise"}
        backLabel="Back"
      />
      <section className="config-exercise-shell">
        <header className="config-exercise-header">
          <p className="config-exercise-eyebrow">
            {isNew ? "New exercise" : "Edit exercise"}
          </p>
          {error && <p className="config-exercise-error">{error}</p>}
        </header>

        {/* Name */}
        <div className="config-exercise__field-group">
          <label className="config-exercise__label">Exercise name</label>
          <input
            className="config-exercise__input"
            type="text"
            value={exerciseName}
            onChange={(e) => setExerciseName(e.target.value)}
            placeholder="e.g. Bench Press"
          />
        </div>

        {/* Movement type */}
        <div className="config-exercise__field-group">
          <label className="config-exercise__label">Movement type</label>
          <select
            className="config-exercise__select"
            value={movementTypeId}
            onChange={(e) => setMovementTypeId(e.target.value)}
          >
            <option value="">Select…</option>
            {movementTypes.map((mt) => (
              <option key={mt.id} value={mt.id}>
                {mt.name}
              </option>
            ))}
            <option value="__new__">+ Create new</option>
          </select>
          {movementTypeId === "__new__" && (
            <input
              className="config-exercise__input"
              style={{ marginTop: 8 }}
              type="text"
              placeholder="Movement type name"
              value={newMovementTypeName}
              onChange={(e) => setNewMovementTypeName(e.target.value)}
            />
          )}
        </div>

        {/* Rep targets */}
        <div className="config-exercise__field-group">
          <label className="config-exercise__label">Rep targets</label>
          <div className="config-exercise__rep-row">
            <div className="config-exercise__rep-field">
              <span className="config-exercise__rep-label">Target</span>
              <input
                className="config-exercise__input config-exercise__input--number"
                type="number"
                min="1"
                value={targetReps}
                onChange={(e) => setTargetReps(e.target.value)}
              />
            </div>
            <div className="config-exercise__rep-field">
              <span className="config-exercise__rep-label">Min</span>
              <input
                className="config-exercise__input config-exercise__input--number"
                type="number"
                min="1"
                value={repMin}
                onChange={(e) => setRepMin(e.target.value)}
              />
            </div>
            <div className="config-exercise__rep-field">
              <span className="config-exercise__rep-label">Max</span>
              <input
                className="config-exercise__input config-exercise__input--number"
                type="number"
                min="1"
                value={repMax}
                onChange={(e) => setRepMax(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Weight mode */}
        <div className="config-exercise__field-group">
          <label className="config-exercise__label">Weight mode</label>
          <div className="config-exercise__radio-group">
            {(["bodyweight", "increment", "explicit_list"] as WeightMode[]).map(
              (mode) => (
                <label key={mode} className="config-exercise__radio-label">
                  <input
                    type="radio"
                    name="weightMode"
                    value={mode}
                    checked={weightMode === mode}
                    onChange={() => setWeightMode(mode)}
                    className="config-exercise__radio"
                  />
                  <span className="config-exercise__radio-text">
                    {mode === "bodyweight"
                      ? "Bodyweight"
                      : mode === "increment"
                      ? "Increment"
                      : "Fixed list"}
                  </span>
                </label>
              )
            )}
          </div>

          {weightMode === "increment" && (
            <div className="config-exercise__sub-field">
              <label className="config-exercise__sub-label">
                Weight increment (kg)
              </label>
              <input
                className="config-exercise__input config-exercise__input--number"
                type="number"
                min="0.25"
                step="0.25"
                value={weightIncrement}
                onChange={(e) => setWeightIncrement(e.target.value)}
              />
            </div>
          )}

          {weightMode === "explicit_list" && (
            <div className="config-exercise__sub-field">
              <label className="config-exercise__sub-label">
                Available weights (kg)
              </label>
              <div className="config-exercise__weight-tags">
                {availableWeights.map((w) => (
                  <span key={w} className="config-exercise__weight-tag">
                    {w}
                    <button
                      type="button"
                      className="config-exercise__weight-tag-remove"
                      onClick={() => removeWeight(w)}
                      aria-label={`Remove ${w}kg`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="config-exercise__weight-add-row">
                <input
                  className="config-exercise__input config-exercise__input--number"
                  type="number"
                  min="0.25"
                  step="0.25"
                  placeholder="kg"
                  value={newWeightInput}
                  onChange={(e) => setNewWeightInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addWeight()}
                />
                <button
                  type="button"
                  className="config-exercise__add-weight-btn"
                  onClick={addWeight}
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="config-exercise__actions">
          {!isNew && (
            <button
              type="button"
              className="config-exercise__btn config-exercise__btn--danger"
              onClick={handleDelete}
              disabled={isSaving}
            >
              Delete
            </button>
          )}
          <button
            type="button"
            className="config-exercise__btn config-exercise__btn--primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </section>
      <BottomNav activeTab="settings" />
    </main>
  );
}
