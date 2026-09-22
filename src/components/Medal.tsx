import type { RagStatus } from "../services/sessionMetrics";
import EmojiGlyph from "./EmojiGlyph";
import "./Medal.css";

export type { RagStatus };

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
  status: RagStatus | "grey" | "skipped";
  size?: "sm" | "md" | "lg";
  isCurrent?: boolean;
}

export default function Medal({
  status,
  size = "md",
  isCurrent = false,
}: MedalProps) {
  return (
    <div className={`medal medal--${size}`}>
      {isCurrent && <span className="medal__arrow">▼</span>}
      {status === "grey" ? (
        <span className="medal__placeholder" aria-label="Session not completed" />
      ) : status === "skipped" ? (
        <span className="medal__icon" aria-label="Session skipped">
          <EmojiGlyph emoji="🏳️" />
        </span>
      ) : (
        <span className="medal__icon" aria-label={`Session score: ${LABEL_BY_STATUS[status]}`}>
          <EmojiGlyph emoji={MEDAL_BY_STATUS[status]} />
        </span>
      )}
    </div>
  );
}
