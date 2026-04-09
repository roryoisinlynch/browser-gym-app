import "./ExerciseSetTable.css";

export interface ExerciseSetTableRow {
  id: string;
  weight: string;
  reps: string;
  estimatedOneRepMax: number | null;
}

interface ExerciseSetTableProps {
  rows: ExerciseSetTableRow[];
  targetWeight: number | null;
  targetReps: number | null;
  onWeightChange: (rowId: string, value: string) => void;
  onRepsChange: (rowId: string, value: string) => void;
  onRowBlur: (rowId: string) => void;
  onRemoveRow: (rowId: string) => void;
  onAddRow: () => void;
  onDone: () => void;
  isBodyweight?: boolean;
}

function formatEstimatedOneRepMax(value: number | null) {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }

  return `${value.toFixed(1)}kg`;
}

function getTargetLabel(
  targetWeight: number | null,
  targetReps: number | null,
  isBodyweight: boolean
) {
  if (targetReps == null) return "—";
  if (isBodyweight) return `${targetReps} reps`;
  if (targetWeight == null) return "—";
  return `${targetWeight}kg × ${targetReps}`;
}

export default function ExerciseSetTable({
  rows,
  targetWeight,
  targetReps,
  onWeightChange,
  onRepsChange,
  onRowBlur,
  onRemoveRow,
  onAddRow,
  onDone,
  isBodyweight = false,
}: ExerciseSetTableProps) {
  const targetLabel = getTargetLabel(targetWeight, targetReps, isBodyweight);
  const rowClass = `exercise-set-table__row${isBodyweight ? " exercise-set-table__row--bw" : ""}`;

  return (
    <section className="exercise-set-table-card">
      <div className="exercise-set-table-card__header">
        <h2 className="exercise-set-table-card__title">Sets</h2>
      </div>

      <div className="exercise-set-table">
        <div className={`exercise-set-table__head ${rowClass}`}>
          <span>Target</span>
          {!isBodyweight && <span>Weight</span>}
          <span>Reps</span>
          {!isBodyweight && <span>e1RM</span>}
          <span aria-hidden="true" />
        </div>

        {rows.map((row) => (
          <div key={row.id} className={rowClass}>
            <span className="exercise-set-table__target">{targetLabel}</span>

            {!isBodyweight && (
              <input
                inputMode="decimal"
                type="number"
                enterKeyHint="next"
                className="exercise-set-table__input"
                placeholder={targetWeight == null ? "Weight" : `${targetWeight}`}
                value={row.weight}
                onChange={(event) => onWeightChange(row.id, event.target.value)}
                onBlur={() => onRowBlur(row.id)}
                aria-label="Weight"
              />
            )}

            <input
              inputMode="numeric"
              type="number"
              enterKeyHint="done"
              className="exercise-set-table__input"
              placeholder={targetReps == null ? "Reps" : `${targetReps}`}
              value={row.reps}
              onChange={(event) => onRepsChange(row.id, event.target.value)}
              onBlur={() => onRowBlur(row.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
              aria-label="Reps"
            />

            {!isBodyweight && (
              <span className="exercise-set-table__e1rm">
                {formatEstimatedOneRepMax(row.estimatedOneRepMax)}
              </span>
            )}

            <button
              type="button"
              className="exercise-set-table__remove"
              onClick={() => onRemoveRow(row.id)}
              aria-label="Remove set"
            >
              −
            </button>
          </div>
        ))}
      </div>

      <div className="exercise-set-table-card__footer">
        <button
          type="button"
          className="exercise-set-table-card__add"
          onClick={onAddRow}
        >
          + Add set
        </button>
        <button
          type="button"
          className="exercise-set-table-card__done"
          onClick={onDone}
        >
          Done
        </button>
      </div>
    </section>
  );
}