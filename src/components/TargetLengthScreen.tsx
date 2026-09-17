import { useEffect, useRef, useState } from "react";
import SubScreen from "./SubScreen";
import "./TargetLengthScreen.css";

function parseTargetMinutes(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed);
  return rounded >= 1 ? rounded : null;
}

interface TargetLengthScreenProps {
  /** Minutes, or null when the session has no target length. */
  initial: number | null;
  /** Called with the parsed value on Done. Blank or invalid input saves null. */
  onSave: (minutes: number | null) => void;
  /** The back arrow: leaves without saving. */
  onClose: () => void;
}

export default function TargetLengthScreen({
  initial,
  onSave,
  onClose,
}: TargetLengthScreenProps) {
  const [input, setInput] = useState(initial != null ? String(initial) : "");
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Not autoFocus: SubScreen focuses its own container on mount, and records
  // the focused element as the opener to return to. This effect runs after
  // SubScreen's, so the opener stays the page's row and the field still wins.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleDone() {
    onSave(parseTargetMinutes(input));
  }

  return (
    <SubScreen title="Target length" onBack={onClose}>
      <div className="target-length-screen">
        <label className="target-length-screen__label" htmlFor="target-length-minutes">
          Target session length
        </label>
        <div className="target-length-screen__row">
          <input
            id="target-length-minutes"
            ref={inputRef}
            className="target-length-screen__input"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            enterKeyHint="done"
            placeholder="e.g. 60"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              // Closing returns focus to the row that opened this screen. Without
              // this, the same Enter press would then activate that row and
              // reopen the screen.
              e.preventDefault();
              handleDone();
            }}
          />
          <span className="target-length-screen__unit">min</span>
        </div>

        <p className="target-length-screen__help">
          Optional, leave it blank for no target. It does not affect session,
          week, or season scores. During a session it shows a progress bar
          indicating how closely you are tracking your ideal session duration.
        </p>

        <button
          type="button"
          className="target-length-screen__done"
          onClick={handleDone}
        >
          Done
        </button>
      </div>
    </SubScreen>
  );
}
