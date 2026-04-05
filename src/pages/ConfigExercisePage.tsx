import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { ExerciseTemplate, MovementType, WeightMode } from "../domain/models";
import {
  deleteExerciseTemplateById,
  getAllExerciseTemplates,
  getAllMovementTypes,
  getExerciseSessionHistory,
  getExerciseTemplateById,
  getMovementTypeById,
  getWeekTemplates,
  saveExerciseTemplate,
  saveMovementType,
} from "../repositories/programRepository";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import "./ConfigExercisePage.css";

interface WeightOption {
  weight: number;
  zeroRirReps: number;   // floor((e1RM / weight - 1) * 30) — the 0 RIR rep count
  remainder: number;     // e1RM − implied e1RM at zeroRirReps (accuracy gap)
  repRange: number[];    // one rep count per week, sorted RIR high→low (fewest first)
}

export default function ConfigExercisePage() {
  const { exerciseTemplateId } = useParams<{ exerciseTemplateId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const isNew = exerciseTemplateId === "new";
  const stmgId = searchParams.get("stmgId") ?? "";
  const muscleGroupId = searchParams.get("muscleGroupId") ?? "";

  // Core form state
  const [exerciseName, setExerciseName] = useState("");
  const [movementTypeId, setMovementTypeId] = useState("");
  const [weightMode, setWeightMode] = useState<WeightMode>("increment");
  const [weightIncrement, setWeightIncrement] = useState("2.5");
  const [availableWeights, setAvailableWeights] = useState<number[]>([]);
  const [newWeightInput, setNewWeightInput] = useState("");

  // Weight selection (the anchor stored on the template)
  const [selectedWeight, setSelectedWeight] = useState<number | null>(null);
  const [historicalE1RM, setHistoricalE1RM] = useState<number | null>(null);
  const [rirScheme, setRirScheme] = useState<number[]>([]);
  const [minRepsFilter, setMinRepsFilter] = useState(1);
  const [maxRepsFilter, setMaxRepsFilter] = useState(30);

  // Movement type options
  const [movementTypes, setMovementTypes] = useState<MovementType[]>([]);
  const [newMovementTypeName, setNewMovementTypeName] = useState("");
  const [resolvedMuscleGroupId, setResolvedMuscleGroupId] = useState(muscleGroupId);

  const [allExerciseNames, setAllExerciseNames] = useState<string[]>([]);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const allTemplates = await getAllExerciseTemplates();
      const uniqueNames = [...new Set(allTemplates.map((t) => t.exerciseName))].sort();
      setAllExerciseNames(uniqueNames);

      const weeks = await getWeekTemplates();
      const scheme = weeks
        .map((w) => w.targetRir)
        .filter((r): r is number => r != null);
      setRirScheme(scheme);

      if (isNew) {
        const allMts = await getAllMovementTypes();
        console.log("[ConfigExercisePage] muscleGroupId param:", JSON.stringify(muscleGroupId));
        console.log("[ConfigExercisePage] all movement types:", allMts);
        if (muscleGroupId) {
          const mts = allMts.filter((mt) => mt.muscleGroupId === muscleGroupId);
          console.log("[ConfigExercisePage] filtered mts:", mts);
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
      setWeightMode(template.weightMode);
      setWeightIncrement(String(template.weightIncrement ?? 2.5));
      setAvailableWeights(template.availableWeights ?? []);
      setSelectedWeight(template.prescribedWeight ?? null);

      const mt = await getMovementTypeById(template.movementTypeId);
      if (mt) {
        const mgId = mt.muscleGroupId;
        setResolvedMuscleGroupId(mgId);
        const allMts = await getAllMovementTypes();
        const mts = allMts.filter((m) => m.muscleGroupId === mgId);
        setMovementTypes(mts.sort((a, b) => a.order - b.order));
      }

      if (template.weightMode !== "bodyweight") {
        const history = await getExerciseSessionHistory(template.exerciseName);
        const best = history.reduce<number | null>((max, d) => {
          if (d.topEstimatedOneRepMax == null) return max;
          return max == null || d.topEstimatedOneRepMax > max
            ? d.topEstimatedOneRepMax
            : max;
        }, null);
        setHistoricalE1RM(best);
      }
    }
    load();
  }, [exerciseTemplateId, isNew, muscleGroupId]);

  const weightOptions = useMemo<WeightOption[]>(() => {
    if (!historicalE1RM || rirScheme.length === 0) return [];
    if (weightMode === "bodyweight") return [];

    const inc = parseFloat(weightIncrement) || 2.5;
    const sortedRir = [...rirScheme].sort((a, b) => b - a); // high RIR first → fewest reps first

    let candidates: number[];
    if (weightMode === "explicit_list") {
      candidates = [...availableWeights].sort((a, b) => a - b);
    } else {
      candidates = [];
      for (let w = inc; w < historicalE1RM; w = Math.round((w + inc) * 1000) / 1000) {
        candidates.push(w);
      }
    }

    const options: WeightOption[] = [];
    for (const weight of candidates) {
      const zeroRirReps = Math.floor((historicalE1RM / weight - 1) * 30);
      if (zeroRirReps < 1) continue;

      const repRange = sortedRir.map((rir) => zeroRirReps - rir);
      const minRep = Math.min(...repRange);
      const maxRep = Math.max(...repRange);

      if (minRep < 1) continue;
      if (maxRep < minRepsFilter || minRep > maxRepsFilter) continue;

      // Remainder: the e1RM gap that the floor'd rep count doesn't account for
      const impliedE1RM = weight * (1 + zeroRirReps / 30);
      const remainder = historicalE1RM - impliedE1RM;

      options.push({ weight, zeroRirReps, remainder, repRange });
    }

    return options.reverse(); // heaviest first
  }, [
    historicalE1RM,
    weightMode,
    weightIncrement,
    availableWeights,
    rirScheme,
    minRepsFilter,
    maxRepsFilter,
  ]);

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

    if (weightMode !== "bodyweight" && selectedWeight === null) {
      setError("Please select a weight option.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      let existingStmgId = stmgId;
      if (!isNew) {
        const existing = await getExerciseTemplateById(exerciseTemplateId!);
        existingStmgId = existing?.sessionTemplateMuscleGroupId ?? stmgId;
      }

      const template: ExerciseTemplate = {
        id: isNew ? crypto.randomUUID() : exerciseTemplateId!,
        sessionTemplateMuscleGroupId: existingStmgId,
        movementTypeId: resolvedMovementTypeId,
        exerciseName: name,
        weightMode,
        prescribedWeight: weightMode === "bodyweight" ? null : selectedWeight,
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

  const selectedOption = weightOptions.find((o) => o.weight === selectedWeight);

  const filteredSuggestions = useMemo(() => {
    const q = exerciseName.trim().toLowerCase();
    if (!q) return allExerciseNames;
    return allExerciseNames.filter((n) => n.toLowerCase().includes(q));
  }, [exerciseName, allExerciseNames]);


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
        <div className="config-exercise__field-group config-exercise__autocomplete-wrap">
          <label className="config-exercise__label">Exercise name</label>
          <input
            ref={nameInputRef}
            className="config-exercise__input"
            type="text"
            value={exerciseName}
            onChange={(e) => {
              setExerciseName(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="e.g. Bench Press"
            autoComplete="off"
          />
          {showSuggestions && filteredSuggestions.length > 0 && (
            <ul className="config-exercise__suggestions">
              {filteredSuggestions.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    className="config-exercise__suggestion-item"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setExerciseName(name);
                      setShowSuggestions(false);
                      nameInputRef.current?.blur();
                    }}
                  >
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          )}
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
                    onChange={() => {
                      setWeightMode(mode);
                      setSelectedWeight(null);
                    }}
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
                onChange={(e) => {
                  setWeightIncrement(e.target.value);
                  setSelectedWeight(null);
                }}
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
                      onClick={() => {
                        removeWeight(w);
                        setSelectedWeight(null);
                      }}
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

        {/* Rep options — only for weighted exercises */}
        {weightMode === "bodyweight" ? (
          <div className="config-exercise__field-group">
            <div className="config-exercise__bw-note">
              Rep targets are calculated automatically from your historical best
              minus the week's RIR.
            </div>
          </div>
        ) : (
          <div className="config-exercise__field-group">
            <label className="config-exercise__label">
              Working weight
              {selectedOption && (
                <span className="config-exercise__label-selected">
                  {" "}· {selectedOption.weight}kg · 0 RIR: {selectedOption.zeroRirReps} reps
                </span>
              )}
            </label>

            {historicalE1RM != null ? (
              <>
                <p className="config-exercise__e1rm-note">
                  Historical e1RM:{" "}
                  <strong>
                    {Number.isInteger(historicalE1RM)
                      ? historicalE1RM
                      : historicalE1RM.toFixed(1)}
                    kg
                  </strong>
                  {"  ·  "}
                  <span className="config-exercise__e1rm-scheme">
                    RIR scheme: {[...rirScheme].sort((a, b) => b - a).join(", ")}
                  </span>
                </p>

                {/* Filter */}
                <div className="config-exercise__rep-filter">
                  <span className="config-exercise__rep-filter-label">
                    Show 0 RIR reps
                  </span>
                  <input
                    className="config-exercise__input config-exercise__input--number"
                    type="number"
                    min="1"
                    value={minRepsFilter}
                    onChange={(e) =>
                      setMinRepsFilter(Math.max(1, parseInt(e.target.value) || 1))
                    }
                  />
                  <span className="config-exercise__rep-filter-label">to</span>
                  <input
                    className="config-exercise__input config-exercise__input--number"
                    type="number"
                    min="1"
                    value={maxRepsFilter}
                    onChange={(e) =>
                      setMaxRepsFilter(Math.max(1, parseInt(e.target.value) || 1))
                    }
                  />
                </div>

                {weightOptions.length === 0 ? (
                  <p className="config-exercise__no-options">
                    No options in this rep range. Try adjusting the filter.
                  </p>
                ) : (
                  <div className="config-exercise__option-list">
                    {weightOptions.map((opt) => {
                      const isSelected = opt.weight === selectedWeight;
                      return (
                        <button
                          key={opt.weight}
                          type="button"
                          className={`config-exercise__option${
                            isSelected
                              ? " config-exercise__option--selected"
                              : ""
                          }`}
                          onClick={() => setSelectedWeight(opt.weight)}
                        >
                          <span className="config-exercise__option-weight">
                            {opt.weight}kg
                          </span>
                          <span className="config-exercise__option-middle">
                            <span className="config-exercise__option-reps">
                              {opt.repRange.join(" · ")}
                            </span>
                            <span className="config-exercise__option-zero-rir">
                              0 RIR: {opt.zeroRirReps} reps
                            </span>
                          </span>
                          <span className="config-exercise__option-remainder">
                            +{opt.remainder.toFixed(1)}kg
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <p className="config-exercise__no-history-note">
                No history yet. Options will appear after the first session
                (AMRAP to establish a baseline).
              </p>
            )}
          </div>
        )}

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
