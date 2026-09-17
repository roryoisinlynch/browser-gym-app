import type { SessionTemplateMuscleGroupWithMeta } from "../repositories/programRepository";
import SubScreen from "./SubScreen";
import "./MuscleGroupPicker.css";

interface ExerciseGroupPickerProps {
  /** The muscle groups of the exercise's session, in session order. */
  groups: SessionTemplateMuscleGroupWithMeta[];
  /** The section the exercise currently sits in. */
  selectedId: string;
  onSelect: (sessionTemplateMuscleGroupId: string) => void;
  onClose: () => void;
}

/**
 * Moves an exercise to another muscle group of the same session. Replaces the
 * drag and drop the session config page used to carry.
 */
export default function ExerciseGroupPicker({
  groups,
  selectedId,
  onSelect,
  onClose,
}: ExerciseGroupPickerProps) {
  return (
    <SubScreen title="Muscle group" onBack={onClose}>
      <div className="muscle-group-picker__list">
        {groups.map(({ sessionTemplateMuscleGroup: stmg, muscleGroup }) => {
          const selected = stmg.id === selectedId;
          return (
            <button
              key={stmg.id}
              type="button"
              className={`muscle-group-picker__option${
                selected ? " muscle-group-picker__option--selected" : ""
              }`}
              aria-pressed={selected}
              onClick={() => onSelect(stmg.id)}
            >
              <span className="muscle-group-picker__option-name">
                {muscleGroup.name}
              </span>
              {selected && <span className="muscle-group-picker__note">Current</span>}
            </button>
          );
        })}
      </div>
    </SubScreen>
  );
}
