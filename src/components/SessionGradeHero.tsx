import type { RagStatus } from "../services/sessionMetrics";
import Medal from "./Medal";
import ScoreBlock from "./ScoreBlock";
import useInView from "../hooks/useInView";
import "./SessionGradeHero.css";

interface SessionGradeHeroProps {
  ragStatus: RagStatus | "skipped";
  volumeScore: number;
  intensityScore: number;
}

const SCORE_START_MS = [250, 500];

/**
 * The session's headline: its medal in the middle, with volume and intensity
 * mirrored either side so the three read as one row.
 *
 * Half the height of the week's emoji and two scores rather than three, which is
 * the whole point — this is the quietest report in the chain, and it should look
 * like a lighter version of the one above it rather than a rival to it. Nothing
 * cycles and nothing stamps; only the bars move.
 */
export default function SessionGradeHero({
  ragStatus,
  volumeScore,
  intensityScore,
}: SessionGradeHeroProps) {
  const [ref, inView] = useInView<HTMLDivElement>();

  return (
    <div className="sgh-hero" ref={ref}>
      <ScoreBlock
        score={volumeScore}
        label="Volume"
        delayMs={SCORE_START_MS[0]}
        started={inView}
        align="end"
      />

      {/* A skipped session gets no glow: the white flag is a statement of fact,
          not a result worth lighting up. */}
      <div
        className={`sgh-hero__medal${
          ragStatus === "skipped" ? "" : ` sgh-hero__medal--${ragStatus}`
        }`}
      >
        <Medal status={ragStatus} size="lg" />
      </div>

      <ScoreBlock
        score={intensityScore}
        label="Intensity"
        delayMs={SCORE_START_MS[1]}
        started={inView}
        align="start"
      />
    </div>
  );
}
