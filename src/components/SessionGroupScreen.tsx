import { useState } from "react";
import SubScreen from "./SubScreen";
import "./SessionGroupScreen.css";

interface SessionGroupScreenProps {
  name: string;
  targetWorkingSets: number;
  exerciseCount: number;
  onChangeTarget: (delta: number) => void;
  onRemove: () => void;
  onClose: () => void;
}

/**
 * One muscle group of a session template: its target working sets and the
 * option to remove it. The session config page keeps these controls off its
 * own surface and opens this screen from the group's header instead.
 */
export default function SessionGroupScreen({
  name,
  targetWorkingSets,
  exerciseCount,
  onChangeTarget,
  onRemove,
  onClose,
}: SessionGroupScreenProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <SubScreen title={name} onBack={onClose}>
      <div className="session-group-screen">
        <section className="session-group-screen__target">
          <p className="session-group-screen__label">Target working sets</p>
          <div className="session-group-screen__stepper">
            <button
              type="button"
              className="session-group-screen__stepper-btn"
              onClick={() => onChangeTarget(-1)}
              disabled={targetWorkingSets <= 1}
              aria-label="Decrease target sets"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 12h12" />
              </svg>
            </button>
            <span className="session-group-screen__count" aria-live="polite">
              {targetWorkingSets}
            </span>
            <button
              type="button"
              className="session-group-screen__stepper-btn"
              onClick={() => onChangeTarget(1)}
              aria-label="Increase target sets"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 12h12" />
                <path d="M12 6v12" />
              </svg>
            </button>
          </div>
          <p className="session-group-screen__unit">sets per session</p>
        </section>

        <p className="session-group-screen__help">
          Volume comes from this set target, not from the number of exercises.
          List more exercises than you would do in one session and pick from
          them each time you train.
        </p>

        <div className="session-group-screen__spacer" />

        <section className="session-group-screen__remove">
          {confirming ? (
            <div className="session-group-screen__confirm">
              <button
                type="button"
                className="session-group-screen__btn"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="session-group-screen__btn session-group-screen__btn--danger"
                onClick={onRemove}
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="session-group-screen__btn session-group-screen__btn--danger"
              onClick={() => setConfirming(true)}
            >
              Remove muscle group
            </button>
          )}
          {exerciseCount > 0 && (
            <p className="session-group-screen__remove-note">
              Also removes its {exerciseCount}{" "}
              {exerciseCount === 1 ? "exercise" : "exercises"}.
            </p>
          )}
        </section>
      </div>
    </SubScreen>
  );
}
