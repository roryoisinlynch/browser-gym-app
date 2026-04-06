import type { RagStatus } from "../services/sessionMetrics";
import "./TrafficLight.css";

export type { RagStatus };

interface TrafficLightProps {
  status: RagStatus | "grey";
  size?: "sm" | "md" | "lg";
  isCurrent?: boolean;
}

export default function TrafficLight({
  status,
  size = "md",
  isCurrent = false,
}: TrafficLightProps) {
  return (
    <div className={`traffic-light traffic-light--${size}`}>
      {isCurrent && <span className="traffic-light__arrow">▼</span>}
      <span
        className={`traffic-light__bulb traffic-light__bulb--${status}`}
        aria-label={`Session score: ${status}`}
      />
    </div>
  );
}
