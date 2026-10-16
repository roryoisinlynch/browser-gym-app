import { useEffect, useRef, useState } from "react";
import SubScreen from "./SubScreen";
import type { AbsenceSpan } from "../services/absences";
import { formatAbsenceRange } from "../services/absences";
import { formatDayCount } from "../services/relativeTime";
import "./MuscleGroupPicker.css";
import "./AbsenceReasonWizard.css";

type Step = "intro" | "list" | "new";

const TITLES: Record<Step, string> = {
  intro: "Time away",
  list: "Choose a reason",
  new: "Add a reason",
};

interface AbsenceReasonWizardProps {
  absence: AbsenceSpan;
  /** Prompt opens on the intro step after a session; pick opens on the list. */
  mode: "prompt" | "pick";
  reasons: string[];
  /** Pick mode: the reason the absence already has, marked in the list. */
  currentReason?: string | null;
  /** True while the host is saving; blocks a second tap. */
  busy: boolean;
  onChoose: (reason: string) => void;
  onCreate: (label: string) => void;
  /** Back on the first step, or "Not now" in prompt mode. */
  onDismiss: () => void;
  /** Prompt mode only: "Don't ask again". */
  onDisable?: () => void;
}

function WizardRow({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="absence-wizard__row" onClick={onClick}>
      <span className="absence-wizard__row-body">
        <span className="absence-wizard__row-title">{title}</span>
        <span className="absence-wizard__row-desc">{description}</span>
      </span>
      <span className="absence-wizard__row-chevron">›</span>
    </button>
  );
}

/**
 * Picks a reason for an absence. After a session it opens on an intro step
 * that explains the gap and offers the choices; from the absences list it
 * opens straight on the list of reasons.
 */
export default function AbsenceReasonWizard({
  absence,
  mode,
  reasons,
  currentReason = null,
  busy,
  onChoose,
  onCreate,
  onDismiss,
  onDisable,
}: AbsenceReasonWizardProps) {
  const firstStep: Step = mode === "prompt" ? "intro" : "list";
  const [step, setStep] = useState<Step>(firstStep);
  const [newLabel, setNewLabel] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Not autoFocus: SubScreen focuses its own container on mount and records
  // the focused element as the opener to return to. Focusing from an effect
  // runs after that, so the opener stays the row that opened the wizard.
  useEffect(() => {
    if (step === "new") inputRef.current?.focus();
  }, [step]);

  function back() {
    if (step === firstStep) onDismiss();
    else if (step === "new") setStep("list");
    else setStep("intro");
  }

  function handleCreate() {
    const label = newLabel.trim();
    if (!label || busy) return;
    // A typed label that matches an existing reason picks that reason rather
    // than creating a second one with the same name.
    const existing = reasons.find(
      (r) => r.trim().toLowerCase() === label.toLowerCase()
    );
    if (existing) onChoose(existing);
    else onCreate(label);
  }

  return (
    <SubScreen title={TITLES[step]} onBack={back}>
      {step === "intro" && (
        <div className="absence-wizard">
          <p className="absence-wizard__lead">
            It looks like you haven't been training for a while. Would you like
            to select a reason?
          </p>
          <p className="absence-wizard__detail">
            No training from {formatAbsenceRange(absence.startDate, absence.endDate)},{" "}
            {formatDayCount(absence.dayCount)}.
          </p>
          <div className="absence-wizard__rows">
            <WizardRow
              title="Choose a reason"
              description="Pick from the list"
              onClick={() => setStep("list")}
            />
            <WizardRow
              title="Add a reason"
              description="Write your own"
              onClick={() => setStep("new")}
            />
            <WizardRow
              title="Not now"
              description="You can add one later from the Dashboard"
              onClick={onDismiss}
            />
            {onDisable && (
              <WizardRow
                title="Don't ask again"
                description="Turns off absence tracking. Turn it back on in Settings."
                onClick={onDisable}
              />
            )}
          </div>
        </div>
      )}

      {step === "list" && (
        <>
          <div className="muscle-group-picker__list">
            {reasons.map((reason) => {
              const selected = currentReason != null && reason === currentReason;
              return (
                <button
                  key={reason}
                  type="button"
                  className={`muscle-group-picker__option${
                    selected ? " muscle-group-picker__option--selected" : ""
                  }`}
                  aria-pressed={selected}
                  disabled={busy}
                  onClick={() => onChoose(reason)}
                >
                  <span className="muscle-group-picker__option-name">{reason}</span>
                  {selected && (
                    <span className="muscle-group-picker__note">Current</span>
                  )}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="muscle-group-picker__new-btn"
            onClick={() => setStep("new")}
          >
            + New reason
          </button>
        </>
      )}

      {step === "new" && (
        <>
          <label className="muscle-group-picker__label" htmlFor="absence-reason-label">
            Reason
          </label>
          <input
            id="absence-reason-label"
            ref={inputRef}
            className="muscle-group-picker__input"
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              // Closing returns focus to the row that opened this screen.
              // Without this, the same Enter press would activate that row.
              e.preventDefault();
              handleCreate();
            }}
            placeholder="e.g. Moving house"
            maxLength={40}
            enterKeyHint="done"
            autoComplete="off"
          />
          <button
            type="button"
            className="muscle-group-picker__add"
            onClick={handleCreate}
            disabled={busy || !newLabel.trim()}
          >
            Add
          </button>
        </>
      )}
    </SubScreen>
  );
}
