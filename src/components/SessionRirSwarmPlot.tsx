import type { SessionRirSummary } from "../services/sessionRir";
import "./SessionRirSwarmPlot.css";

/** Trim a trailing ".0" so integer medians read as "3", not "3.0". */
function formatRir(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

// Dot geometry. RIR is integer-valued, so each distinct value is a vertical
// column of dots; the dot size shrinks to keep the densest column near a
// comfortable height, then the plot grows if a column is unusually deep.
const GAP = 3; // vertical space between stacked dots
const IDEAL_H = 112; // target height for the tallest column
const DOT_MIN = 4;
const DOT_MAX = 9;

/**
 * A swarm plot of the session's per-set RIR: one dot per set, stacked into a
 * centred column at each integer RIR value, with a labeled reference line for
 * the RIR target. Working sets carry the effort (accent); warmups ride along as
 * grey context. The axis is flipped so fewer reps in reserve (closer to failure)
 * sits to the right.
 */
export default function SessionRirSwarmPlot({ summary }: { summary: SessionRirSummary }) {
  const { points, target, workingSetCount, warmupSetCount, amrapExcludedCount, median } = summary;

  // The section is about working-set effort against the target; with no working
  // sets there's nothing to compare, so state why rather than hiding it.
  if (workingSetCount === 0) {
    return (
      <p className="rir-swarm__empty sum-reveal">
        {amrapExcludedCount > 0
          ? "Every working set this session was AMRAP, so there is no RIR to measure against a target."
          : "No working sets this session."}
      </p>
    );
  }

  const rirs = points.map((p) => p.rir);
  // Integer axis domain padded half a unit each side, so each column sits on a
  // tick centre. Values are already clamped to ≥ 0 in the service.
  const loInt = Math.floor(Math.min(...rirs, target));
  const hiInt = Math.ceil(Math.max(...rirs, target));
  const axisLo = loInt - 0.5;
  const axisHi = hiInt + 0.5;
  // Flipped: high RIR (easy) on the left, low RIR (near failure) on the right.
  const pos = (v: number) => ((axisHi - v) / (axisHi - axisLo)) * 100;

  const range = hiInt - loInt;
  const step = range <= 8 ? 1 : Math.ceil(range / 8);
  const ticks: number[] = [];
  for (let t = loInt; t <= hiInt; t += step) ticks.push(t);

  // Stack sets sharing a RIR value into a column, preserving each dot's rank so
  // it can be placed symmetrically about the centre line.
  const counts = new Map<number, number>();
  const dots = points.map((p) => {
    const rank = counts.get(p.rir) ?? 0;
    counts.set(p.rir, rank + 1);
    return { ...p, rank };
  });
  const maxStack = Math.max(...counts.values());

  const dotSize = Math.max(
    DOT_MIN,
    Math.min(DOT_MAX, Math.floor((IDEAL_H + GAP) / maxStack) - GAP)
  );
  const cell = dotSize + GAP;
  // Headroom above and below the columns so the target reference line stays
  // visible even where an on-target column would otherwise fully cover it.
  const pad = cell;
  const plotH = maxStack * cell - GAP + pad * 2;
  const centerY = plotH / 2;

  const targetPos = pos(target);
  const targetLabelStyle =
    targetPos <= 55 ? { left: `${targetPos}%` } : { right: `${100 - targetPos}%` };

  const caption =
    `${workingSetCount} working set${workingSetCount === 1 ? "" : "s"}` +
    (warmupSetCount > 0 ? ` · ${warmupSetCount} warmup` : "") +
    (median != null ? ` · median ${formatRir(median)} RIR` : "") +
    (amrapExcludedCount > 0
      ? ` · ${amrapExcludedCount} AMRAP set${amrapExcludedCount === 1 ? "" : "s"} excluded`
      : "");

  return (
    <div className="rir-swarm sum-reveal">
      <div className="rir-swarm__chart" aria-hidden="true">
        <div className="rir-swarm__labelrow">
          <span
            className={`rir-swarm__target-label${targetPos <= 55 ? " rir-swarm__target-label--right" : " rir-swarm__target-label--left"}`}
            style={targetLabelStyle}
          >
            Target {formatRir(target)}
          </span>
        </div>

        <div className="rir-swarm__track" style={{ height: `${plotH}px` }}>
          <span className="rir-swarm__target" style={{ left: `${targetPos}%` }} />
          {dots.map((d, i) => {
            const count = counts.get(d.rir)!;
            const top = centerY + (d.rank - (count - 1) / 2) * cell;
            return (
              <span
                key={i}
                className={`rir-swarm__dot rir-swarm__dot--${d.type}`}
                style={{
                  left: `${pos(d.rir)}%`,
                  top: `${top}px`,
                  width: `${dotSize}px`,
                  height: `${dotSize}px`,
                }}
              />
            );
          })}
        </div>

        <div className="rir-swarm__axis">
          {ticks.map((t) => (
            <span key={t} className="rir-swarm__tick" style={{ left: `${pos(t)}%` }}>
              {t}
            </span>
          ))}
        </div>
      </div>

      {warmupSetCount > 0 && (
        <div className="rir-swarm__legend">
          <span className="rir-swarm__legend-item">
            <span className="rir-swarm__legend-dot rir-swarm__dot--working" />
            Working
          </span>
          <span className="rir-swarm__legend-item">
            <span className="rir-swarm__legend-dot rir-swarm__dot--warmup" />
            Warmup
          </span>
        </div>
      )}

      <p className="rir-swarm__caption">{caption}</p>
    </div>
  );
}
