import { useState } from "react";
import type { MuscleGroup } from "../domain/models";
import SubScreen from "./SubScreen";
import "./MuscleGroupPicker.css";

type Step = "list" | "new";

const TITLES: Record<Step, string> = {
  list: "Add muscle group",
  new: "New muscle group",
};

interface MuscleGroupPickerProps {
  muscleGroups: MuscleGroup[];
  /** Groups the session already has. They stay selectable, only tagged. */
  inSessionIds: ReadonlySet<string>;
  /** True while the page is saving a choice; blocks a second tap. */
  busy: boolean;
  onSelect: (muscleGroupId: string) => void;
  onCreate: (name: string) => void;
  onClose: () => void;
}

export default function MuscleGroupPicker({
  muscleGroups,
  inSessionIds,
  busy,
  onSelect,
  onCreate,
  onClose,
}: MuscleGroupPickerProps) {
  const [step, setStep] = useState<Step>("list");
  const [newName, setNewName] = useState("");

  function back() {
    if (step === "list") onClose();
    else setStep("list");
  }

  function handleCreate() {
    const name = newName.trim();
    if (!name || busy) return;
    // A typed name that matches an existing group picks that group rather
    // than creating a second record with the same name.
    const existing = muscleGroups.find(
      (mg) => mg.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (existing) onSelect(existing.id);
    else onCreate(name);
  }

  return (
    <SubScreen title={TITLES[step]} onBack={back}>
      {step === "list" && (
        <>
          <div className="muscle-group-picker__list">
            {muscleGroups.map((mg) => (
              <button
                key={mg.id}
                type="button"
                className="muscle-group-picker__option"
                disabled={busy}
                onClick={() => onSelect(mg.id)}
              >
                <span className="muscle-group-picker__option-name">{mg.name}</span>
                {inSessionIds.has(mg.id) && (
                  <span className="muscle-group-picker__note">In session</span>
                )}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="muscle-group-picker__new-btn"
            onClick={() => setStep("new")}
          >
            + New muscle group
          </button>
        </>
      )}

      {step === "new" && (
        <>
          <label className="muscle-group-picker__label" htmlFor="muscle-group-picker-name">
            Name
          </label>
          <input
            id="muscle-group-picker-name"
            className="muscle-group-picker__input"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              handleCreate();
            }}
            placeholder="e.g. Forearms"
            enterKeyHint="done"
            autoComplete="off"
            autoFocus
          />
          <button
            type="button"
            className="muscle-group-picker__add"
            onClick={handleCreate}
            disabled={busy || !newName.trim()}
          >
            Add
          </button>
        </>
      )}
    </SubScreen>
  );
}
