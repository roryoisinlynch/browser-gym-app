import type { RagStatus } from "../services/sessionMetrics";
import "./TrafficLight.css";

export type { RagStatus };

const RAG_ORDER: RagStatus[] = ["red", "amber", "green"];

interface TrafficLightProps {
  status: RagStatus | "grey";
  size?: "sm" | "md" | "lg";
  isCurrent?: boolean;
  /** Show all three bulbs with only the active one lit. */
  showAll?: boolean;
}

export default function TrafficLight({
  status,
  size = "md",
  isCurrent = false,
  showAll = false,
}: TrafficLightProps) {
  if (showAll && status !== "grey") {
    return (
      <div className={`traffic-light traffic-light--${size} traffic-light--stack`}>
        {RAG_ORDER.map((s) => (
          <span
            key={s}
            className={[
              "traffic-light__bulb",
              `traffic-light__bulb--${s}`,
              s !== status ? "traffic-light__bulb--inactive" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          />
        ))}
      </div>
    );
  }

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
