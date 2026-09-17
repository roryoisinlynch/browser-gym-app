import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { ExerciseTemplate } from "../domain/models";
import {
  attachExerciseTemplateToSessionInstance,
  deleteExerciseTemplateById,
  getAllExerciseTemplates,
  getEffectiveE1RM,
  getExerciseTemplateById,
  getOrCreateDefaultMovementType,
  getSeasonTemplates,
  getSessionTemplateMuscleGroupsForSection,
  saveExerciseTemplate,
} from "../repositories/programRepository";
import type { SessionTemplateMuscleGroupWithMeta } from "../repositories/programRepository";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import ExerciseGroupPicker from "../components/ExerciseGroupPicker";
import WeightListWizard from "../components/WeightListWizard";
import WorkingWeightPicker from "../components/WorkingWeightPicker";
import {
  computeWeightOptions,
  pickBestWeightOption,
  TARGET_MAX_REPS,
  TARGET_MIN_REPS,
} from "../services/weightOptions";
import type { WeightOption } from "../services/weightOptions";
import {
  DEFAULT_STEP,
  EMPTY_LIST_CONFIG,
  describeWeightConfig,
  isWeightConfigured,
  sameWeightFields,
  weightConfigFromTemplate,
  weightFieldsFromConfig,
  type WeightConfig,
} from "../services/weightConfig";
import "./ConfigExercisePage.css";

type SubScreenKind = "none" | "weights" | "working-weight" | "muscle-group";

// What the toggle restores when an exercise is switched back from bodyweight.
interface WeightedMemory {
  config: WeightConfig;
  selectedWeight: number | null;
}

interface CardState {
  value: string | null;
  desc: string;
  tappable: boolean;
}

export default function ConfigExercisePage() {
  const { exerciseTemplateId } = useParams<{ exerciseTemplateId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const isNew = exerciseTemplateId === "new";
  const stmgId = searchParams.get("stmgId") ?? "";
  const returnTo = searchParams.get("returnTo");
  const addToSessionId = searchParams.get("addToSession");
  const addToSimgId = searchParams.get("simgId");
  const openParam = searchParams.get("open");

  // Core form state
  const [exerciseName, setExerciseName] = useState("");
  const [config, setConfig] = useState<WeightConfig>(EMPTY_LIST_CONFIG);
  const lastWeightedRef = useRef<WeightedMemory>({
    config: EMPTY_LIST_CONFIG,
    selectedWeight: null,
  });

  // The explicit working-weight choice; null means "follow the recommendation".
  const [selectedWeight, setSelectedWeight] = useState<number | null>(null);
  const [historicalBestE1RM, setHistoricalBestE1RM] = useState<number | null>(null);
  const [recentMaxE1RM, setRecentMaxE1RM] = useState<number | null>(null);
  const [rirScheme, setRirScheme] = useState<number[]>([]);

  // The session's muscle groups and the one this exercise sits in. Picking
  // another moves the exercise there on Save. Existing exercises only.
  const [sessionGroups, setSessionGroups] = useState<SessionTemplateMuscleGroupWithMeta[]>([]);
  const [selectedStmgId, setSelectedStmgId] = useState("");

  // Sub-screens. The ?open= deep link is honoured once, after the template
  // and its e1RM have loaded, and never again after the user closes it.
  const [loaded, setLoaded] = useState(false);
  const [subScreen, setSubScreen] = useState<SubScreenKind>("none");
  const [deepLinkConsumed, setDeepLinkConsumed] = useState(false);

  const [allExerciseNames, setAllExerciseNames] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const templates = await getAllExerciseTemplates();
      setAllExerciseNames([...new Set(templates.map((t) => t.exerciseName))].sort());

      const seasonTemplates = await getSeasonTemplates();
      setRirScheme(seasonTemplates[0]?.rirSequence ?? []);

      if (isNew || !exerciseTemplateId) {
        setLoaded(true);
        return;
      }

      const template = await getExerciseTemplateById(exerciseTemplateId);
      if (!template) {
        setLoaded(true);
        return;
      }

      setExerciseName(template.exerciseName);
      setSelectedStmgId(template.sessionTemplateMuscleGroupId);
      setSessionGroups(
        await getSessionTemplateMuscleGroupsForSection(template.sessionTemplateMuscleGroupId)
      );
      const cfg = weightConfigFromTemplate(template);
      const prescribed = template.prescribedWeight ?? null;
      setConfig(cfg);
      setSelectedWeight(prescribed);
      if (cfg.kind !== "bodyweight") {
        lastWeightedRef.current = { config: cfg, selectedWeight: prescribed };
        const { historicalBest, recentMax } = await getEffectiveE1RM(template.exerciseName);
        setHistoricalBestE1RM(historicalBest);
        setRecentMaxE1RM(recentMax);
      }
      setLoaded(true);
    }
    load();
  }, [exerciseTemplateId, isNew]);

  const effectiveE1RM = recentMaxE1RM ?? historicalBestE1RM;

  const fields = useMemo(() => weightFieldsFromConfig(config), [config]);

  const weightOptions = useMemo<WeightOption[]>(
    () =>
      computeWeightOptions({
        effectiveE1RM,
        weightMode: fields.weightMode,
        weightIncrement: fields.weightIncrement ?? DEFAULT_STEP,
        availableWeights: fields.availableWeights ?? [],
        rirScheme,
      }),
    [effectiveE1RM, fields, rirScheme]
  );

  const recommended = useMemo(() => pickBestWeightOption(weightOptions), [weightOptions]);

  const currentGroup = sessionGroups.find(
    (g) => g.sessionTemplateMuscleGroup.id === selectedStmgId
  );

  const isBodyweight = config.kind === "bodyweight";
  const weightsConfigured = isWeightConfigured(config);
  const weightsLabel = describeWeightConfig(config);

  // What Save stores: the explicit choice, else the recommendation.
  const storedWeight = selectedWeight ?? recommended?.weight ?? null;
  const storedOption = weightOptions.find((o) => o.weight === storedWeight);

  const workingWeightCard: CardState = (() => {
    if (!weightsConfigured) {
      return { value: null, desc: "Configure available weights first", tappable: false };
    }
    if (effectiveE1RM == null) {
      return { value: null, desc: "AMRAP until the first session", tappable: false };
    }
    if (weightOptions.length === 0) {
      return {
        value: null,
        desc: "None of the available weights give a rep target between 1 and 30.",
        tappable: false,
      };
    }
    if (storedOption) {
      const min = Math.min(...storedOption.repRange);
      const max = Math.max(...storedOption.repRange);
      return {
        value: `${storedOption.weight}kg`,
        desc:
          selectedWeight == null
            ? `Recommended: closest to ${TARGET_MIN_REPS} to ${TARGET_MAX_REPS} reps, rep range ${min} to ${max}`
            : `0 RIR: ${storedOption.zeroRirReps} reps, rep range ${min} to ${max}`,
        tappable: true,
      };
    }
    return { value: `${storedWeight}kg`, desc: "Not among the current options.", tappable: true };
  })();

  // Deep link: derived rather than set in an effect, so it needs no extra render.
  const autoOpen: SubScreenKind =
    loaded && !deepLinkConsumed
      ? openParam === "weights" && !isBodyweight
        ? "weights"
        : openParam === "working-weight" && weightOptions.length > 0
          ? "working-weight"
          : "none"
      : "none";
  const activeSubScreen: SubScreenKind = subScreen !== "none" ? subScreen : autoOpen;

  function closeSubScreen() {
    setDeepLinkConsumed(true);
    setSubScreen("none");
  }

  function applyWeightConfig(next: WeightConfig) {
    const same = sameWeightFields(next, config);
    if (!same) setSelectedWeight(null);
    setConfig(next);
    if (next.kind !== "bodyweight") {
      lastWeightedRef.current = { config: next, selectedWeight: same ? selectedWeight : null };
    }
  }

  function handleToggleBodyweight() {
    if (isBodyweight) {
      const memory = lastWeightedRef.current;
      setConfig(memory.config);
      setSelectedWeight(memory.selectedWeight);
    } else {
      lastWeightedRef.current = { config, selectedWeight };
      setConfig({ kind: "bodyweight" });
      setSelectedWeight(null);
    }
  }

  async function handleSave() {
    const name = exerciseName.trim();
    if (!name) {
      setError("Exercise name is required.");
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
        // A move to another muscle group changes only the section; like the
        // drag and drop it replaces, it leaves the movement type alone.
        sessionTemplateMuscleGroupId: selectedStmgId || existingStmgId,
        movementTypeId,
        exerciseName: name,
        ...weightFieldsFromConfig(config),
        prescribedWeight: isBodyweight ? null : storedWeight,
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
        {error && (
          <header className="config-exercise-header">
            <p className="config-exercise-error">{error}</p>
          </header>
        )}

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

        <div className="config-exercise__field-group config-exercise__card-list">
          {currentGroup && sessionGroups.length > 1 && (
            <button
              type="button"
              className="config-exercise__card"
              onClick={() => setSubScreen("muscle-group")}
            >
              <span className="config-exercise__card-body">
                <span className="config-exercise__card-title">Muscle group</span>
                <span className="config-exercise__card-desc">
                  The muscle group this exercise counts towards in this session.
                </span>
              </span>
              <span className="config-exercise__card-right">
                <span className="config-exercise__card-value">
                  {currentGroup.muscleGroup.name}
                </span>
                <span className="config-exercise__card-chevron">›</span>
              </span>
            </button>
          )}

          <div className="config-exercise__card config-exercise__card--toggle">
            <span className="config-exercise__card-body">
              <span className="config-exercise__card-title">Bodyweight exercise</span>
              <span className="config-exercise__card-desc">
                Reps only. Rep targets come from your historical best minus the
                week&apos;s RIR.
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isBodyweight}
              aria-label="Bodyweight exercise"
              className={`config-exercise__toggle${
                isBodyweight ? " config-exercise__toggle--on" : ""
              }`}
              onClick={handleToggleBodyweight}
            >
              <span className="config-exercise__toggle-knob" />
            </button>
          </div>

          {!isBodyweight && (
            <>
              <button
                type="button"
                className={`config-exercise__card${
                  workingWeightCard.tappable ? "" : " config-exercise__card--muted"
                }`}
                disabled={!workingWeightCard.tappable}
                onClick={() => setSubScreen("working-weight")}
              >
                <span className="config-exercise__card-body">
                  <span className="config-exercise__card-title">Working weight</span>
                  <span className="config-exercise__card-desc">
                    {workingWeightCard.desc}
                  </span>
                </span>
                <span className="config-exercise__card-right">
                  {workingWeightCard.value && (
                    <span className="config-exercise__card-value">
                      {workingWeightCard.value}
                    </span>
                  )}
                  {workingWeightCard.tappable && (
                    <span className="config-exercise__card-chevron">›</span>
                  )}
                </span>
              </button>

              <button
                type="button"
                className={`config-exercise__card${
                  weightsConfigured ? "" : " config-exercise__card--cta"
                }`}
                onClick={() => setSubScreen("weights")}
              >
                <span className="config-exercise__card-body">
                  <span className="config-exercise__card-title">
                    {weightsConfigured
                      ? "Available weights"
                      : "Configure available weights"}
                  </span>
                  <span className="config-exercise__card-desc">
                    {weightsLabel ??
                      "Tell the app which weights you can load so it prescribes from them."}
                  </span>
                </span>
                <span className="config-exercise__card-right">
                  <span className="config-exercise__card-chevron">›</span>
                </span>
              </button>
            </>
          )}
        </div>

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

      {activeSubScreen === "weights" && (
        <WeightListWizard
          initial={config}
          onApply={(next) => {
            applyWeightConfig(next);
            closeSubScreen();
          }}
          onClose={closeSubScreen}
        />
      )}
      {activeSubScreen === "muscle-group" && (
        <ExerciseGroupPicker
          groups={sessionGroups}
          selectedId={selectedStmgId}
          onSelect={(id) => {
            setSelectedStmgId(id);
            closeSubScreen();
          }}
          onClose={closeSubScreen}
        />
      )}
      {activeSubScreen === "working-weight" && (
        <WorkingWeightPicker
          options={weightOptions}
          selected={selectedWeight}
          recommended={recommended?.weight ?? null}
          recencyNote={recentMaxE1RM != null && historicalBestE1RM != null}
          onSelect={(weight) => {
            setSelectedWeight(weight);
            closeSubScreen();
          }}
          onClose={closeSubScreen}
        />
      )}
    </main>
  );
}
