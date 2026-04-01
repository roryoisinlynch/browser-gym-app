import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ExerciseInstanceView } from "../repositories/programRepository";
import {
  completeExerciseInstance,
  createExerciseSet,
  deleteExerciseSet,
  getExerciseInstanceView,
  updateExerciseSet,
} from "../repositories/programRepository";
import { calculateEstimatedOneRepMax } from "../services/setAnalysis";
import type { ExerciseSetTableRow } from "../components/ExerciseSetTable.tsx";
import ExerciseSetTable from "../components/ExerciseSetTable.tsx";
import ExerciseSummaryCard from "../components/ExerciseSummaryCard.tsx";
import TopBar from "../components/TopBar";
import "./ExercisePage.css";
import BottomNav from "../components/BottomNav";

type EditableRow = ExerciseSetTableRow & {
  persistedSetId: string | null;
};

function createDraftRow(index: number): EditableRow {
  return {
    id: `draft-${Date.now()}-${index}`,
    persistedSetId: null,
    weight: "",
    reps: "",
    estimatedOneRepMax: null,
  };
}

function hydrateRows(view: ExerciseInstanceView): EditableRow[] {
  if (view.sets.length === 0) {
    return [createDraftRow(0)];
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

function getExerciseStatusLabel(
  status: "not_started" | "in_progress" | "completed"
) {
  if (status === "completed") return "Completed";
  if (status === "in_progress") return "In progress";
  return "Not started";
}

export default function ExercisePage() {
  const { exerciseInstanceId } = useParams<{ exerciseInstanceId: string }>();
  const navigate = useNavigate();
  const [exerciseView, setExerciseView] = useState<ExerciseInstanceView | null>(null);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
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

  const topSetEstimatedOneRepMax = useMemo(() => {
    return rows.reduce<number | null>((best, row) => {
      const value = row.estimatedOneRepMax;

      if (value == null) {
        return best;
      }

      if (best == null || value > best) {
        return value;
      }

      return best;
    }, null);
  }, [rows]);

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
    const hasAnyEnteredValue = performedWeight != null || performedReps != null;

    if (!hasAnyEnteredValue && row.persistedSetId == null) {
      return;
    }

    try {
      setIsSaving(true);
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
            ? {
                ...candidate,
                id: persistedSetId!,
                persistedSetId,
              }
            : candidate
        )
      );


    } catch (error) {
      console.error("Failed to save set row:", error);
      setErrorMessage("Could not save the set.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemoveRow(rowId: string) {
    const row = rows.find((candidate) => candidate.id === rowId);
    if (!row) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);

      if (row.persistedSetId) {
        await deleteExerciseSet(row.persistedSetId);
      }

      setRows((currentRows) => {
        const nextRows = currentRows.filter((candidate) => candidate.id !== rowId);
        return nextRows.length > 0 ? nextRows : [createDraftRow(draftCounterRef.current++)];
      });

      await reloadExerciseView();
    } catch (error) {
      console.error("Failed to remove set row:", error);
      setErrorMessage("Could not remove the set.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleAddRow() {
    setRows((currentRows) => [...currentRows, createDraftRow(draftCounterRef.current++)]);
  }

async function handleFinishExercise() {
  if (!exerciseView) {
    return;
  }

  const populatedSetCount = rows.filter((row) => {
    const weight = parseNullableNumber(row.weight);
    const reps = parseNullableNumber(row.reps);
    return weight != null || reps != null;
  }).length;

  if (populatedSetCount < 3) {
    const confirmed = window.confirm(
      `Only ${populatedSetCount} populated ${
        populatedSetCount === 1 ? "set is" : "sets are"
      } recorded. Finish exercise anyway?`
    );

    if (!confirmed) {
      return;
    }
  }

  try {
    setIsSaving(true);
    setErrorMessage(null);

    await completeExerciseInstance(exerciseView.exerciseInstance.id);
    navigate(`/session/${exerciseView.sessionInstance.id}`);
  } catch (error) {
    console.error("Failed to finish exercise:", error);
    setErrorMessage("Could not finish exercise.");
  } finally {
    setIsSaving(false);
  }
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

  const exerciseStatus = exerciseView.exerciseInstance.status;
  const isCompleted = exerciseStatus === "completed";

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
            {exerciseView.sessionTemplate.name} · {exerciseView.weekTemplate.label ?? exerciseView.weekTemplate.name}
          </p>
          <p className="exercise-page__subtitle">
            Status: {getExerciseStatusLabel(exerciseStatus)}
          </p>
          {errorMessage && <p className="exercise-page__message">{errorMessage}</p>}
          {isSaving && <p className="exercise-page__message">Saving changes…</p>}
        </header>

        <ExerciseSummaryCard
          movementTypeName={exerciseView.movementType.name}
          targetRir={exerciseView.exerciseInstance.prescribedRir ?? null}
          targetWeight={exerciseView.exerciseInstance.prescribedWeight ?? null}
          targetReps={exerciseView.exerciseInstance.prescribedRepTarget ?? null}
          targetEstimatedOneRepMax={exerciseView.targetEstimatedOneRepMax}
          topSetEstimatedOneRepMax={topSetEstimatedOneRepMax}
          historicalBestEstimatedOneRepMax={exerciseView.historicalBestEstimatedOneRepMax}
        />

        <ExerciseSetTable
          rows={rows}
          targetWeight={exerciseView.exerciseInstance.prescribedWeight ?? null}
          targetReps={exerciseView.exerciseInstance.prescribedRepTarget ?? null}
          onWeightChange={(rowId, value) => updateRowValue(rowId, "weight", value)}
          onRepsChange={(rowId, value) => updateRowValue(rowId, "reps", value)}
          onRowBlur={handleRowBlur}
          onRemoveRow={handleRemoveRow}
          onAddRow={handleAddRow}
        />

        <div style={{ margin: "0 14px 16px" }}>
          <button
            type="button"
            onClick={handleFinishExercise}
            disabled={isSaving || isCompleted}
            style={{
              width: "100%",
              minHeight: "42px",
              borderRadius: "14px",
              border: "1px solid rgba(216, 240, 106, 0.32)",
              background: isCompleted ? "var(--panel-bg)" : "rgba(216, 240, 106, 0.08)",
              color: isCompleted ? "var(--text-muted)" : "var(--accent)",
              fontSize: "0.92rem",
              fontWeight: 800,
              cursor: isSaving || isCompleted ? "default" : "pointer",
            }}
          >
            {isCompleted ? "Exercise finished" : "Finish exercise"}
          </button>
        </div>
      </section>

      <BottomNav activeTab="session" />
    </main>
  );
}