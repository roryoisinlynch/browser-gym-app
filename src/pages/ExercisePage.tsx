import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ExerciseInstanceView } from "../repositories/programRepository";
import {
  createExerciseSet,
  deleteExerciseSet,
  getExerciseInstanceView,
  updateExerciseSet,
} from "../repositories/programRepository";
import { calculateEstimatedOneRepMax } from "../services/setAnalysis";
import type { ExerciseSetTableRow } from "../components/ExerciseSetTable.tsx";
import ExerciseSetTable from "../components/ExerciseSetTable.tsx";
import ExerciseSummaryCard from "../components/ExerciseSummaryCard.tsx";
import ExerciseInsights from "../components/ExerciseInsights.tsx";
import TopBar from "../components/TopBar";
import "./ExercisePage.css";
import BottomNav from "../components/BottomNav";

type EditableRow = ExerciseSetTableRow & {
  persistedSetId: string | null;
};

function createDraftRow(index: number, defaultWeight = ""): EditableRow {
  return {
    id: `draft-${Date.now()}-${index}`,
    persistedSetId: null,
    weight: defaultWeight,
    reps: "",
    estimatedOneRepMax: null,
  };
}

function hydrateRows(view: ExerciseInstanceView): EditableRow[] {
  const defaultWeight =
    view.exerciseInstance.prescribedWeight != null
      ? String(view.exerciseInstance.prescribedWeight)
      : "";

  if (view.sets.length === 0) {
    return [createDraftRow(0, defaultWeight)];
  }

  return view.sets.map(({ set, analysis }) => ({
    id: set.id,
    persistedSetId: set.id,
    weight: set.performedWeight == null ? "" : String(set.performedWeight),
    reps: set.performedReps == null ? "" : String(set.performedReps),
    estimatedOneRepMax: analysis.estimatedOneRepMax,
  }));
}

function parseNullableNumber(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function withCalculatedEstimatedOneRepMax(row: EditableRow): EditableRow {
  const weight = parseNullableNumber(row.weight);
  const reps = parseNullableNumber(row.reps);

  return {
    ...row,
    estimatedOneRepMax: calculateEstimatedOneRepMax(weight, reps),
  };
}

export default function ExercisePage() {
  const { exerciseInstanceId } = useParams<{ exerciseInstanceId: string }>();
  const navigate = useNavigate();
  const [exerciseView, setExerciseView] = useState<ExerciseInstanceView | null>(
    null
  );
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRowSaving, setIsRowSaving] = useState(false);
  const draftCounterRef = useRef(1);

  useEffect(() => {
    async function loadExercisePage() {
      if (!exerciseInstanceId) {
        setErrorMessage("No exercise was provided.");
        setIsLoading(false);
        return;
      }

      try {
        const view = await getExerciseInstanceView(exerciseInstanceId);

        if (!view) {
          setErrorMessage("Exercise not found.");
          return;
        }

        setExerciseView(view);
        setRows(hydrateRows(view));
      } catch (error) {
        console.error("Failed to load exercise page:", error);
        setErrorMessage("Could not load exercise data.");
      } finally {
        setIsLoading(false);
      }
    }

    loadExercisePage();
  }, [exerciseInstanceId]);

  const isBodyweight = exerciseView?.exerciseTemplate.weightMode === "bodyweight";

  // True AMRAP: no session history at all — user needs to establish an e1RM.
  const isAmrap =
    exerciseView != null &&
    !isBodyweight &&
    exerciseView.historicalBestEstimatedOneRepMax == null;

  // Has history but no working weight configured in settings yet.
  const needsWeightConfig =
    exerciseView != null &&
    !isBodyweight &&
    exerciseView.historicalBestEstimatedOneRepMax != null &&
    exerciseView.exerciseInstance.prescribedWeight == null;

  const topSetEstimatedOneRepMax = useMemo(() => {
    if (isBodyweight) return null;
    return rows.reduce<number | null>((best, row) => {
      const value = row.estimatedOneRepMax;
      if (value == null) return best;
      if (best == null || value > best) return value;
      return best;
    }, null);
  }, [rows, isBodyweight]);

  const topSetReps = useMemo(() => {
    if (!isBodyweight) return null;
    return rows.reduce<number | null>((best, row) => {
      const value = parseNullableNumber(row.reps);
      if (value == null) return best;
      if (best == null || value > best) return value;
      return best;
    }, null);
  }, [rows, isBodyweight]);

  function updateRowValue(
    rowId: string,
    field: "weight" | "reps",
    value: string
  ) {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === rowId
          ? withCalculatedEstimatedOneRepMax({ ...row, [field]: value })
          : row
      )
    );
  }

  async function reloadExerciseView() {
    if (!exerciseInstanceId) {
      return;
    }

    const view = await getExerciseInstanceView(exerciseInstanceId);

    if (view) {
      setExerciseView(view);
      setRows(hydrateRows(view));
    }
  }

  async function handleRowBlur(rowId: string) {
    const row = rows.find((candidate) => candidate.id === rowId);

    if (!row || !exerciseView) {
      return;
    }

    const performedWeight = parseNullableNumber(row.weight);
    const performedReps = parseNullableNumber(row.reps);
    const hasRequiredValues = isBodyweight
      ? performedReps != null
      : performedWeight != null && performedReps != null;

    if (!hasRequiredValues && row.persistedSetId == null) {
      return;
    }

    try {
      setIsRowSaving(true);
      setErrorMessage(null);

      let persistedSetId = row.persistedSetId;

      if (!persistedSetId) {
        const createdSet = await createExerciseSet(exerciseView.exerciseInstance.id);

        if (!createdSet) {
          throw new Error("Could not create exercise set.");
        }

        persistedSetId = createdSet.id;
      }

      await updateExerciseSet(persistedSetId, {
        performedWeight,
        performedReps,
        performedRir: null,
      });

      setRows((currentRows) =>
        currentRows.map((candidate) =>
          candidate.id === rowId
            ? { ...candidate, persistedSetId }
            : candidate
        )
      );
    } catch (error) {
      console.error("Failed to save set row:", error);
      setErrorMessage("Could not save the set.");
    } finally {
      setIsRowSaving(false);
    }
  }

  async function handleRemoveRow(rowId: string) {
    const row = rows.find((candidate) => candidate.id === rowId);
    if (!row) {
      return;
    }

    try {
      setIsRowSaving(true);
      setErrorMessage(null);

      if (row.persistedSetId) {
        await deleteExerciseSet(row.persistedSetId);
      }

      setRows((currentRows) => {
        const nextRows = currentRows.filter((candidate) => candidate.id !== rowId);
        return nextRows.length > 0
          ? nextRows
          : [createDraftRow(draftCounterRef.current++)];
      });

      await reloadExerciseView();
    } catch (error) {
      console.error("Failed to remove set row:", error);
      setErrorMessage("Could not remove the set.");
    } finally {
      setIsRowSaving(false);
    }
  }

  function handleAddRow() {
    const defaultWeight =
      exerciseView?.exerciseInstance.prescribedWeight != null
        ? String(exerciseView.exerciseInstance.prescribedWeight)
        : "";
    setRows((currentRows) => [
      ...currentRows,
      createDraftRow(draftCounterRef.current++, defaultWeight),
    ]);
  }

  function handleConfigureExercise() {
    if (!exerciseView) {
      return;
    }

    const returnTo = `/exercise/${exerciseView.exerciseInstance.id}`;
    navigate(
      `/config/exercises/${exerciseView.exerciseTemplate.id}?returnTo=${encodeURIComponent(
        returnTo
      )}`
    );
  }

  function handleDone() {
    if (!exerciseView) return;
    navigate(`/session/${exerciseView.sessionInstance.id}`);
  }

  if (isLoading) {
    return (
      <main className="exercise-page">
        <TopBar title="Exercise" backTo="/week" backLabel="Back" />
        <section className="exercise-shell">
          <p>Loading exercise...</p>
        </section>
        <BottomNav activeTab="session" />
      </main>
    );
  }

  if (errorMessage && !exerciseView) {
    return (
      <main className="exercise-page">
        <TopBar title="Exercise" backTo="/week" backLabel="Back" />
        <section className="exercise-shell">
          <p>{errorMessage}</p>
        </section>
        <BottomNav activeTab="session" />
      </main>
    );
  }

  if (!exerciseView) {
    return null;
  }

  return (
    <main className="exercise-page">
      <TopBar
        title="Exercise"
        backTo={`/session/${exerciseView.sessionInstance.id}`}
        backLabel="Back to session"
      />

      <section className="exercise-shell">
        <header className="exercise-page__header">
          <h1 className="exercise-page__title">
            {exerciseView.exerciseTemplate.exerciseName}
          </h1>
          <p className="exercise-page__subtitle">
            {exerciseView.sessionTemplate.name} ·{" "}
            {exerciseView.weekTemplate.label ?? exerciseView.weekTemplate.name}
          </p>
          {errorMessage && (
            <p className="exercise-page__message">{errorMessage}</p>
          )}
          {isRowSaving && (
            <p className="exercise-page__message">Saving changes…</p>
          )}
        </header>

        <ExerciseSummaryCard
          movementTypeName={exerciseView.movementType.name}
          targetRir={exerciseView.effectiveRir}
          targetWeight={exerciseView.exerciseInstance.prescribedWeight ?? null}
          targetReps={exerciseView.exerciseInstance.prescribedRepTarget ?? null}
          targetEstimatedOneRepMax={exerciseView.targetEstimatedOneRepMax}
          topSetEstimatedOneRepMax={topSetEstimatedOneRepMax}
          historicalBestEstimatedOneRepMax={
            exerciseView.historicalBestEstimatedOneRepMax
          }
          historicalBestDate={exerciseView.historicalBestDate}
          recentMaxEstimatedOneRepMax={exerciseView.recentMaxEstimatedOneRepMax}
          recentMaxDate={exerciseView.recentMaxDate}
          recentMaxReps={exerciseView.recentMaxReps}
          recentMaxRepsDate={exerciseView.recentMaxRepsDate}
          isBodyweight={isBodyweight}
          historicalBestReps={exerciseView.historicalBestReps}
          topSetReps={topSetReps}
          isAmrap={isAmrap}
          needsWeightConfig={needsWeightConfig}
        />

        {!isBodyweight && (
          <div className="exercise-page__config-cta-wrap">
            <button
              type="button"
              className={`exercise-page__config-cta${
                needsWeightConfig ? " exercise-page__config-cta--emphasised" : ""
              }`}
              onClick={handleConfigureExercise}
            >
              {needsWeightConfig ? "Set working weight" : "Adjust working weight"}
            </button>
          </div>
        )}

        <ExerciseSetTable
          rows={rows}
          targetWeight={exerciseView.exerciseInstance.prescribedWeight ?? null}
          targetReps={exerciseView.exerciseInstance.prescribedRepTarget ?? null}
          onWeightChange={(rowId, value) => updateRowValue(rowId, "weight", value)}
          onRepsChange={(rowId, value) => updateRowValue(rowId, "reps", value)}
          onRowBlur={handleRowBlur}
          onRemoveRow={handleRemoveRow}
          onAddRow={handleAddRow}
          onDone={handleDone}
          isBodyweight={isBodyweight}
        />

        <ExerciseInsights
          exerciseTemplateId={exerciseView.exerciseTemplate.id}
          exerciseName={exerciseView.exerciseTemplate.exerciseName}
          currentExerciseInstanceId={exerciseView.exerciseInstance.id}
          isBodyweight={isBodyweight}
        />
      </section>

      <BottomNav activeTab="session" />
    </main>
  );
}