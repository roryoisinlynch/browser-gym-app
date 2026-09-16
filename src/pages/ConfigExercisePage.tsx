import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { ExerciseTemplate, WeightMode } from "../domain/models";
import {
  attachExerciseTemplateToSessionInstance,
  deleteExerciseTemplateById,
  getAllExerciseTemplates,
  getEffectiveE1RM,
  getExerciseTemplateById,
  getOrCreateDefaultMovementType,
  getSeasonTemplates,
  saveExerciseTemplate,
} from "../repositories/programRepository";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import { computeWeightOptions } from "../services/weightOptions";
import type { WeightOption } from "../services/weightOptions";
import "./ConfigExercisePage.css";

export default function ConfigExercisePage() {
  const { exerciseTemplateId } = useParams<{ exerciseTemplateId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const isNew = exerciseTemplateId === "new";
  const stmgId = searchParams.get("stmgId") ?? "";
  const returnTo = searchParams.get("returnTo");
  const addToSessionId = searchParams.get("addToSession");
  const addToSimgId = searchParams.get("simgId");

  // Core form state
  const [exerciseName, setExerciseName] = useState("");
  const [weightMode, setWeightMode] = useState<WeightMode>("increment");
  const [weightIncrement, setWeightIncrement] = useState("2.5");
  const [availableWeights, setAvailableWeights] = useState<number[]>([]);
  const [newWeightInput, setNewWeightInput] = useState("");

  // Weight selection (the anchor stored on the template)
  const [selectedWeight, setSelectedWeight] = useState<number | null>(null);
  const [historicalBestE1RM, setHistoricalBestE1RM] = useState<number | null>(null);
  const [recentMaxE1RM, setRecentMaxE1RM] = useState<number | null>(null);
  const [rirScheme, setRirScheme] = useState<number[]>([]);

  const [allExerciseNames, setAllExerciseNames] = useState<string[]>([]);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [weightModeTooltipOpen, setWeightModeTooltipOpen] = useState(false);
  const weightModeTooltipRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!weightModeTooltipRef.current?.contains(e.target as Node)) {
        setWeightModeTooltipOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    async function load() {
      const allTemplates = await getAllExerciseTemplates();
      const uniqueNames = [...new Set(allTemplates.map((t) => t.exerciseName))].sort();
      setAllExerciseNames(uniqueNames);

      const seasonTemplates = await getSeasonTemplates();
      const scheme = seasonTemplates[0]?.rirSequence ?? [];
      setRirScheme(scheme);

      if (isNew) {
        return;
      }

      if (!exerciseTemplateId) return;

      const template = await getExerciseTemplateById(exerciseTemplateId);
      if (!template) return;

      setExerciseName(template.exerciseName);
      setWeightMode(template.weightMode);
      setWeightIncrement(String(template.weightIncrement ?? 2.5));
      setAvailableWeights(template.availableWeights ?? []);
      setSelectedWeight(template.prescribedWeight ?? null);

      if (template.weightMode !== "bodyweight") {
        const { historicalBest, recentMax } = await getEffectiveE1RM(
          template.exerciseName
        );
        setHistoricalBestE1RM(historicalBest);
        setRecentMaxE1RM(recentMax);
      }
    }
    load();
  }, [exerciseTemplateId, isNew]);

  const effectiveE1RM = recentMaxE1RM ?? historicalBestE1RM;

  const weightOptions = useMemo<WeightOption[]>(
    () =>
      computeWeightOptions({
        effectiveE1RM,
        weightMode,
        weightIncrement: parseFloat(weightIncrement) || 2.5,
        availableWeights,
        rirScheme,
      }),
    [effectiveE1RM, weightMode, weightIncrement, availableWeights, rirScheme]
  );

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
    if (!name) {
      setError("Exercise name is required.");
      return;
    }

    if (
      weightMode !== "bodyweight" &&
      weightOptions.length > 0 &&
      selectedWeight === null
    ) {
      setError("Please select a weight option.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const existing = isNew
        ? undefined
        : await getExerciseTemplateById(exerciseTemplateId!);
      const existingStmgId = existing?.sessionTemplateMuscleGroupId ?? stmgId;

      // Movement type is no longer chosen in the UI. Existing templates keep
      // theirs; new ones get the muscle group's default.
      const movementTypeId = existing?.movementTypeId
        ? existing.movementTypeId
        : (await getOrCreateDefaultMovementType(existingStmgId)).id;

      const template: ExerciseTemplate = {
        id: isNew ? crypto.randomUUID() : exerciseTemplateId!,
        sessionTemplateMuscleGroupId: existingStmgId,
        movementTypeId,
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

      // Mid-session add: also drop a SessionInstanceExercise snapshot on the
      // current session so the new exercise appears immediately, without
      // touching other instances.
      if (isNew && addToSessionId && addToSimgId) {
        await attachExerciseTemplateToSessionInstance(
          template.id,
          addToSessionId,
          addToSimgId
        );
      }

      if (returnTo) {
        navigate(returnTo);
        return;
      }

      navigate(-1);
    } catch (err) {
      console.error("[ConfigExercisePage] save failed:", err);
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

    if (returnTo) {
      navigate(returnTo);
      return;
    }

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
        backLabel="Session"
        onBack={() => navigate(-1)}
      />
      <section className="config-exercise-shell">
        <header className="config-exercise-header">
          <p className="config-exercise-eyebrow">
            {isNew ? "New exercise" : "Edit exercise"}
          </p>
          {error && <p className="config-exercise-error">{error}</p>}
        </header>

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

        <div className="config-exercise__field-group">
          <div className="config-exercise__label-row">
            <span className="config-exercise__label">Weight mode</span>
            <span ref={weightModeTooltipRef} style={{ position: "relative" }}>
              <button
                type="button"
                className="config-exercise__info-btn"
                aria-expanded={weightModeTooltipOpen}
                onClick={() => setWeightModeTooltipOpen((v) => !v)}
              >?</button>
              {weightModeTooltipOpen && (
                <div className="config-exercise__info-tooltip">
                  <strong>Bodyweight</strong> — for exercises where the only variable you change week to week is the number of reps, such as pull-ups. Also useful for high-rep exercises where e1RM calculations become unreliable.<br />
                  <strong>Increment</strong> — The most common choice. For exercises where the app should be able to chose from weight choices which progress in even increments (e.g. adding or removing 2.5kg to a barbell between sessions).<br />
                  <strong>Fixed list</strong> — a workaround for equipment with uneven increments, such as a cable machine that jumps from 1.25kg to 5kg to 8kg where the available choices do not move in even increments. 
                </div>
              )}
            </span>
          </div>
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

        {weightMode === "bodyweight" ? (
          <div className="config-exercise__field-group">
            <div className="config-exercise__bw-note">
              Rep targets are calculated automatically from your historical best
              minus the week&apos;s RIR.
            </div>
          </div>
        ) : (
          <div className="config-exercise__field-group">
            <label className="config-exercise__label">
              Working weight
              {selectedOption && (
                <span className="config-exercise__label-selected">
                  {" "}
                  · {selectedOption.weight}kg · 0 RIR:{" "}
                  {selectedOption.zeroRirReps} reps
                </span>
              )}
            </label>

            {effectiveE1RM != null ? (
              <>
                {recentMaxE1RM != null && historicalBestE1RM != null && (
                  <p className="config-exercise__e1rm-recency-note">
                    Using recent best instead of all-time PR to keep prescriptions
                    realistic.
                  </p>
                )}

                {weightOptions.length === 0 ? (
                  <p className="config-exercise__no-options">
                    No weight options available.
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
                              Rep range: {Math.min(...opt.repRange)} -{" "}
                              {Math.max(...opt.repRange)}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <p className="config-exercise__no-history-note">
                No history yet — options will appear after the first session
                (AMRAP to establish a baseline).
              </p>
            )}
          </div>
        )}

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
      <BottomNav activeTab="program" />
    </main>
  );
}