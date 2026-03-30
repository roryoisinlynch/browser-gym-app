import type { DayState } from "./DayCard";
import "./ProgressTrack.css";

interface ProgressTrackProps {
  states: DayState[];
  ariaLabel: string;
}

export default function ProgressTrack({
  states,
  ariaLabel,
}: ProgressTrackProps) {
  return (
    <div className="progress-track" aria-label={ariaLabel}>
      {states.map((state, index) => (
        <span
          key={index}
          className={`progress-segment progress-segment--${state}`}
        />
      ))}
    </div>
  );
}