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
import {
  computeWeightOptions,
  legacyWeightList,
  normaliseWeightList,
  suggestedListCeiling,
  weightsFromIncrement,
} from "../services/weightOptions";
import type { WeightOption } from "../services/weightOptions";
import { WEIGHT_PRESETS } from "../data/weightPresets";
import "./ConfigExercisePage.css";

// The form offers two kinds of exercise. Both legacy "increment" records and
// "explicit_list" records load as "weighted"; storedWeightMode decides what is
// written back.
type WeightKind = "bodyweight" | "weighted";

// A list the available weights can be filled from: a built-in preset or
// another exercise's list.
interface ListSource {
  key: string;
  label: string;
  weights: number[];
  step?: number;
}

const DEFAULT_STEP = 2.5;
const MAX_FILL_ENTRIES = 500;
const INLINE_CHIP_LIMIT = 24;

const PRESET_SOURCES: ListSource[] = WEIGHT_PRESETS.map((p) => ({
  key: `preset:${p.id}`,
  label: p.label,
  weights: p.weights,
  step: p.step,
}));

const NUMBER_INPUT_CLASS = "config-exercise__input config-exercise__input--number";

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
  const [weightKind, setWeightKind] = useState<WeightKind>("weighted");
  const [availableWeights, setAvailableWeights] = useState<number[]>([]);
  const [newWeightInput, setNewWeightInput] = useState("");

  // Legacy handling. legacyIncrement is set when the loaded record is an
  // "increment" record. Until the list is touched, the record round-trips
  // unchanged and the list shown is a display-only materialisation of it.
  const [listTouched, setListTouched] = useState(false);
  const [legacyIncrement, setLegacyIncrement] = useState<number | null>(null);
  const [storedIncrement, setStoredIncrement] = useState<number | null>(null);
  const [loadedPrescribedWeight, setLoadedPrescribedWeight] = useState<number | null>(null);

  // Fill tools
  const [lastStep, setLastStep] = useState<number | null>(null);
  const [fillFrom, setFillFrom] = useState("");
  const [fillTo, setFillTo] = useState("");
  const [fillStep, setFillStep] = useState(String(DEFAULT_STEP));
  const [listError, setListError] = useState<string | null>(null);
  const [showAllWeights, setShowAllWeights] = useState(false);

  // Weight selection (the anchor stored on the template)
  const [selectedWeight, setSelectedWeight] = useState<number | null>(null);
  const [historicalBestE1RM, setHistoricalBestE1RM] = useState<number | null>(null);
  const [recentMaxE1RM, setRecentMaxE1RM] = useState<number | null>(null);
  const [rirScheme, setRirScheme] = useState<number[]>([]);

  const [allTemplates, setAllTemplates] = useState<ExerciseTemplate[]>([]);

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
      const templates = await getAllExerciseTemplates();
      setAllTemplates(templates);

      const seasonTemplates = await getSeasonTemplates();
      const scheme = seasonTemplates[0]?.rirSequence ?? [];
      setRirScheme(scheme);

      if (isNew) {
        setFillFrom(String(DEFAULT_STEP));
        setFillTo(String(suggestedListCeiling(DEFAULT_STEP, null, null)));
        return;
      }

      if (!exerciseTemplateId) return;

      const template = await getExerciseTemplateById(exerciseTemplateId);
      if (!template) return;

      setExerciseName(template.exerciseName);
      setWeightKind(template.weightMode === "bodyweight" ? "bodyweight" : "weighted");

      const stored = template.weightIncrement ?? null;
      setStoredIncrement(stored);
      setLegacyIncrement(template.weightMode === "increment" ? (stored ?? DEFAULT_STEP) : null);

      const list = template.availableWeights ?? [];
      setAvailableWeights(list);

      const prescribed = template.prescribedWeight ?? null;
      setLoadedPrescribedWeight(prescribed);
      setSelectedWeight(prescribed);

      const step = stored ?? DEFAULT_STEP;
      setFillStep(String(step));
      if (list.length > 0) {
        setFillFrom(String(Math.min(...list)));
        setFillTo(String(Math.max(...list)));
      } else {
        setFillFrom(String(step));
        setFillTo(String(suggestedListCeiling(step, null, prescribed)));
      }

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

  const isUntouchedLegacy = legacyIncrement != null && !listTouched;
  const storedWeightMode: WeightMode =
    weightKind === "bodyweight"
      ? "bodyweight"
      : isUntouchedLegacy
        ? "increment"
        : "explicit_list";

  // Legacy pre-fill: show an increment record as the list it stands for.
  // Re-runs when the e1RM arrives (it loads after the template) and stops the
  // moment the list is touched. Must not clear selectedWeight: an untouched
  // save has to round-trip prescribedWeight.
  useEffect(() => {
    if (legacyIncrement == null || listTouched) return;
    setAvailableWeights(legacyWeightList(legacyIncrement, effectiveE1RM, loadedPrescribedWeight));
    setFillFrom(String(legacyIncrement));
    setFillTo(String(suggestedListCeiling(legacyIncrement, effectiveE1RM, loadedPrescribedWeight)));
  }, [legacyIncrement, listTouched, effectiveE1RM, loadedPrescribedWeight]);

  const weightOptions = useMemo<WeightOption[]>(
    () =>
      computeWeightOptions({
        effectiveE1RM,
        weightMode: storedWeightMode,
        weightIncrement: legacyIncrement ?? lastStep ?? DEFAULT_STEP,
        availableWeights,
        rirScheme,
      }),
    [effectiveE1RM, storedWeightMode, legacyIncrement, lastStep, availableWeights, rirScheme]
  );

  // Other exercises' lists, one entry per distinct list, labelled by the
  // exercises that share it.
  const copySources = useMemo<ListSource[]>(() => {
    const byList = new Map<
      string,
      { firstId: string; names: string[]; weights: number[]; step?: number }
    >();
    for (const t of allTemplates) {
      if (t.id === exerciseTemplateId) continue;
      if (t.weightMode !== "explicit_list") continue;
      const weights = normaliseWeightList(t.availableWeights ?? []);
      if (weights.length === 0) continue;
      const signature = weights.join(",");
      const entry = byList.get(signature);
      if (entry) {
        if (!entry.names.includes(t.exerciseName)) entry.names.push(t.exerciseName);
        if (entry.step == null && t.weightIncrement != null) entry.step = t.weightIncrement;
      } else {
        byList.set(signature, {
          firstId: t.id,
          names: [t.exerciseName],
          weights,
          step: t.weightIncrement,
        });
      }
    }
    return [...byList.values()]
      .map((e) => ({
        key: `tpl:${e.firstId}`,
        label: e.names.join(", "),
        weights: e.weights,
        step: e.step,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allTemplates, exerciseTemplateId]);

  // Every list edit goes through here: it converts a legacy record, clears the
  // working weight (the options change), and clears any fill error.
  function touchList(next: number[]) {
    setAvailableWeights(next);
    setListTouched(true);
    setSelectedWeight(null);
    setListError(null);
  }

  function addWeight() {
    const val = parseFloat(newWeightInput);
    if (!Number.isFinite(val) || val <= 0) return;
    touchList(normaliseWeightList([...availableWeights, val]));
    setNewWeightInput("");
  }

  function removeWeight(w: number) {
    touchList(availableWeights.filter((v) => v !== w));
  }

  function fillFromIncrement() {
    const from = parseFloat(fillFrom);
    const to = parseFloat(fillTo);
    const step = parseFloat(fillStep);
    if (!(step > 0)) {
      setListError("Step must be greater than 0.");
      return;
    }
    if (!(from > 0)) {
      setListError("From must be greater than 0.");
      return;
    }
    if (!(to >= from)) {
      setListError("To must be at least From.");
      return;
    }
    if (Math.floor((to - from) / step) + 1 > MAX_FILL_ENTRIES) {
      setListError(
        `That range would produce more than ${MAX_FILL_ENTRIES} weights. Use a larger step or a smaller range.`
      );
      return;
    }
    touchList(normaliseWeightList(weightsFromIncrement(step, from, to)));
    setLastStep(step);
  }

  function applyListSource(key: string) {
    const src =
      PRESET_SOURCES.find((s) => s.key === key) ?? copySources.find((s) => s.key === key);
    if (!src) return;
    const weights = normaliseWeightList(src.weights);
    touchList(weights);
    setLastStep(src.step ?? null);
    if (src.step != null) setFillStep(String(src.step));
    if (weights.length > 0) {
      setFillFrom(String(weights[0]));
      setFillTo(String(weights[weights.length - 1]));
    }
  }

  async function handleSave() {
    const name = exerciseName.trim();
    if (!name) {
      setError("Exercise name is required.");
      return;
    }

    if (
      weightKind === "weighted" &&
      !isUntouchedLegacy &&
      availableWeights.length === 0
    ) {
      setError("Add at least one weight, or fill the list from an increment or preset.");
      return;
    }

    if (
      weightKind !== "bodyweight" &&
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

      // An untouched legacy record is written back exactly as it was stored:
      // still "increment", same step, no availableWeights key.
      const listStep = lastStep ?? storedIncrement;
      const weightFields =
        weightKind === "bodyweight"
          ? { weightMode: "bodyweight" as const, prescribedWeight: null }
          : isUntouchedLegacy
            ? {
                weightMode: "increment" as const,
                prescribedWeight: selectedWeight,
                weightIncrement: legacyIncrement ?? DEFAULT_STEP,
              }
            : {
                weightMode: "explicit_list" as const,
                prescribedWeight: selectedWeight,
                availableWeights: normaliseWeightList(availableWeights),
                ...(listStep != null ? { weightIncrement: listStep } : {}),
              };

      const template: ExerciseTemplate = {
        id: isNew ? crypto.randomUUID() : exerciseTemplateId!,
        sessionTemplateMuscleGroupId: existingStmgId,
        movementTypeId,
        exerciseName: name,
        ...weightFields,
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

  const allExerciseNames = useMemo(
    () => [...new Set(allTemplates.map((t) => t.exerciseName))].sort(),
    [allTemplates]
  );

  const filteredSuggestions = useMemo(() => {
    const q = exerciseName.trim().toLowerCase();
    if (!q) return allExerciseNames;
    return allExerciseNames.filter((n) => n.toLowerCase().includes(q));
  }, [exerciseName, allExerciseNames]);

  const weightCount = availableWeights.length;
  const chipsVisible = weightCount <= INLINE_CHIP_LIMIT || showAllWeights;

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
                  <strong>Bodyweight</strong>: for exercises where the only variable you change week to week is the number of reps, such as pull-ups. Also useful for high-rep exercises where e1RM calculations become unreliable.<br />
                  <strong>Weighted</strong>: for exercises with an external load. List the weights you can actually load so the app only prescribes weights that exist. Fill the list from an increment, pick a preset for common equipment, or copy the list from another exercise, then add or remove single weights.
                </div>
              )}
            </span>
          </div>
          <div className="config-exercise__radio-group">
            {(
              [
                { value: "bodyweight", label: "Bodyweight" },
                { value: "weighted", label: "Weighted" },
              ] as { value: WeightKind; label: string }[]
            ).map(({ value, label }) => (
              <label key={value} className="config-exercise__radio-label">
                <input
                  type="radio"
                  name="weightMode"
                  value={value}
                  checked={weightKind === value}
                  onChange={() => {
                    setWeightKind(value);
                    setSelectedWeight(null);
                  }}
                  className="config-exercise__radio"
                />
                <span className="config-exercise__radio-text">{label}</span>
              </label>
            ))}
          </div>

          {weightKind === "weighted" && (
            <div className="config-exercise__sub-field">
              <label className="config-exercise__sub-label">
                Available weights (kg)
              </label>
              {isUntouchedLegacy && (
                <p className="config-exercise__list-note">
                  Filled from this exercise&apos;s {legacyIncrement} kg increment.
                  Edit the list to save it as a fixed list.
                </p>
              )}

              <div className="config-exercise__fill-row">
                <label className="config-exercise__fill-field">
                  <span>From</span>
                  <input
                    className={NUMBER_INPUT_CLASS}
                    type="number"
                    min="0.25"
                    step="0.25"
                    value={fillFrom}
                    onChange={(e) => setFillFrom(e.target.value)}
                  />
                </label>
                <label className="config-exercise__fill-field">
                  <span>To</span>
                  <input
                    className={NUMBER_INPUT_CLASS}
                    type="number"
                    min="0.25"
                    step="0.25"
                    value={fillTo}
                    onChange={(e) => setFillTo(e.target.value)}
                  />
                </label>
                <label className="config-exercise__fill-field">
                  <span>Step</span>
                  <input
                    className={NUMBER_INPUT_CLASS}
                    type="number"
                    min="0.25"
                    step="0.25"
                    value={fillStep}
                    onChange={(e) => setFillStep(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="config-exercise__add-weight-btn"
                  onClick={fillFromIncrement}
                >
                  Fill
                </button>
              </div>

              <select
                className="config-exercise__fill-select"
                value=""
                aria-label="Fill from a preset or another exercise"
                onChange={(e) => {
                  if (e.target.value) applyListSource(e.target.value);
                }}
              >
                <option value="">Fill from a preset or another exercise</option>
                <optgroup label="Presets">
                  {PRESET_SOURCES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </optgroup>
                {copySources.length > 0 && (
                  <optgroup label="Copy from exercise">
                    {copySources.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>

              {listError && <p className="config-exercise-error">{listError}</p>}

              {weightCount === 0 ? (
                <p className="config-exercise__no-options">No weights yet.</p>
              ) : (
                <>
                  <div className="config-exercise__list-summary">
                    <span>
                      {weightCount} {weightCount === 1 ? "weight" : "weights"},{" "}
                      {Math.min(...availableWeights)} to {Math.max(...availableWeights)} kg
                    </span>
                    {weightCount > INLINE_CHIP_LIMIT && (
                      <button
                        type="button"
                        className="config-exercise__list-toggle"
                        onClick={() => setShowAllWeights((v) => !v)}
                      >
                        {showAllWeights ? "Hide" : "Show all"}
                      </button>
                    )}
                  </div>
                  {chipsVisible && (
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
                  )}
                </>
              )}

              <div className="config-exercise__weight-add-row">
                <input
                  className={NUMBER_INPUT_CLASS}
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

        {weightKind === "bodyweight" ? (
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
                No history yet. Options will appear after the first session
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
