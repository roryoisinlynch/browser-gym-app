import type { RagStatus } from "../services/sessionMetrics";
import "./Medal.css";

export type { RagStatus };

const RAG_ORDER: RagStatus[] = ["green", "amber", "red"];

const MEDAL_BY_STATUS: Record<RagStatus, string> = {
  green: "🥇",
  amber: "🥈",
  red: "🥉",
};

const LABEL_BY_STATUS: Record<RagStatus, string> = {
  green: "Gold",
  amber: "Silver",
  red: "Bronze",
};

interface MedalProps {
  status: RagStatus | "grey";
  size?: "sm" | "md" | "lg";
  isCurrent?: boolean;
  /** Show all three medals with only the earned one in full colour. */
  showAll?: boolean;
}

export default function Medal({
  status,
  size = "md",
  isCurrent = false,
  showAll = false,
}: MedalProps) {
  if (showAll && status !== "grey") {
    return (
      <div className={`medal medal--${size} medal--stack`}>
        {RAG_ORDER.map((s) => (
          <span
            key={s}
            className={[
              "medal__icon",
              s !== status ? "medal__icon--inactive" : "",
            ].filter(Boolean).join(" ")}
            aria-hidden={s !== status ? true : undefined}
            aria-label={s === status ? `Session score: ${LABEL_BY_STATUS[s]}` : undefined}
          >
            {MEDAL_BY_STATUS[s]}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className={`medal medal--${size}`}>
      {isCurrent && <span className="medal__arrow">▼</span>}
      {status === "grey" ? (
        <span className="medal__placeholder" aria-label="Session not completed" />
      ) : (
        <span className="medal__icon" aria-label={`Session score: ${LABEL_BY_STATUS[status]}`}>
          {MEDAL_BY_STATUS[status]}
        </span>
      )}
    </div>
  );
}
