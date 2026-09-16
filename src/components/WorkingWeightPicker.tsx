import SubScreen from "./SubScreen";
import type { WeightOption } from "../services/weightOptions";
import "./WorkingWeightPicker.css";

interface WorkingWeightPickerProps {
  options: WeightOption[];
  /** The explicit choice, or null to follow the recommendation. */
  selected: number | null;
  /** The option the app would pick on its own (closest to 6 to 12 reps). */
  recommended: number | null;
  recencyNote: boolean;
  onSelect: (weight: number | null) => void;
  onClose: () => void;
}

export default function WorkingWeightPicker({
  options,
  selected,
  recommended,
  recencyNote,
  onSelect,
  onClose,
}: WorkingWeightPickerProps) {
  const highlighted = selected ?? recommended;

  return (
    <SubScreen title="Working weight" onBack={onClose}>
      {recencyNote && (
        <p className="config-exercise__e1rm-recency-note">
          Using recent best instead of all-time PR to keep prescriptions
          realistic.
        </p>
      )}

      <div className="config-exercise__option-list">
        {options.map((opt) => {
          const isSelected = opt.weight === highlighted;
          const isRecommended = opt.weight === recommended;
          return (
            <button
              key={opt.weight}
              type="button"
              className={`config-exercise__option${
                isSelected ? " config-exercise__option--selected" : ""
              }`}
              onClick={() => onSelect(opt.weight)}
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
              {isRecommended && (
                <span className="working-weight-picker__tag">Recommended</span>
              )}
            </button>
          );
        })}
      </div>

      {selected != null && recommended != null && selected !== recommended && (
        <button
          type="button"
          className="working-weight-picker__reset"
          onClick={() => onSelect(null)}
        >
          Use the recommended weight ({recommended}kg)
        </button>
      )}
    </SubScreen>
  );
}
