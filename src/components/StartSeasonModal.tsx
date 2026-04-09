import { useState } from "react";
import "./StartSeasonModal.css";

interface StartSeasonModalProps {
  programName: string;
  onConfirm: (startedAt: string) => void;
  onCancel: () => void;
}

function todayLocalIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function StartSeasonModal({
  programName,
  onConfirm,
  onCancel,
}: StartSeasonModalProps) {
  const [dateValue, setDateValue] = useState(todayLocalIso());

  function handleConfirm() {
    // Convert the local date string to an ISO timestamp at local midnight
    const [yyyy, mm, dd] = dateValue.split("-").map(Number);
    const localMidnight = new Date(yyyy, mm - 1, dd);
    onConfirm(localMidnight.toISOString());
  }

  return (
    <div className="start-season-overlay" onClick={onCancel}>
      <div
        className="start-season-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Start season"
      >
        <h2 className="start-season-modal__title">Start {programName}</h2>
        <p className="start-season-modal__body">
          Choose a start date for this season. Session due dates will be
          calculated from this date.
        </p>

        <label className="start-season-modal__label" htmlFor="season-start-date">
          Start date
        </label>
        <input
          id="season-start-date"
          type="date"
          className="start-season-modal__input"
          value={dateValue}
          onChange={(e) => setDateValue(e.target.value)}
        />

        <div className="start-season-modal__actions">
          <button
            type="button"
            className="start-season-modal__btn start-season-modal__btn--cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="start-season-modal__btn start-season-modal__btn--confirm"
            onClick={handleConfirm}
            disabled={!dateValue}
          >
            Start season
          </button>
        </div>
      </div>
    </div>
  );
}
