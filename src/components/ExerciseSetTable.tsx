import { useEffect, useRef, useState } from "react";
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
  isAmrap?: boolean;
  isBodyweightAmrap?: boolean;
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
  isBodyweight: boolean,
  isAmrap: boolean,
  isBodyweightAmrap: boolean
) {
  if (isAmrap || isBodyweightAmrap) return "AMRAP";
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
  isAmrap = false,
  isBodyweightAmrap = false,
}: ExerciseSetTableProps) {
  const targetLabel = getTargetLabel(targetWeight, targetReps, isBodyweight, isAmrap, isBodyweightAmrap);
  const rowClass = `exercise-set-table__row${isBodyweight ? " exercise-set-table__row--bw" : ""}`;

  const [e1rmTooltipOpen, setE1rmTooltipOpen] = useState(false);
  const e1rmTooltipRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!e1rmTooltipRef.current?.contains(e.target as Node)) {
        setE1rmTooltipOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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
          {!isBodyweight && (
            <span className="exercise-set-table__e1rm-header" ref={e1rmTooltipRef}>
              e1RM
              <button
                type="button"
                className="exercise-set-table__info-btn"
                aria-expanded={e1rmTooltipOpen}
                onClick={() => setE1rmTooltipOpen((v) => !v)}
              >?</button>
              {e1rmTooltipOpen && (
                <div className="exercise-set-table__info-tooltip">
                  <strong>Estimated 1-Rep Max (e1RM)</strong> is a calculated estimate of the maximum weight you could lift for a single rep, derived from the weight and reps performed in each set. It is used to track strength progress over time and to prescribe your working weights in future sessions.
                </div>
              )}
            </span>
          )}
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
          onMouseDown={(e) => e.preventDefault()}
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