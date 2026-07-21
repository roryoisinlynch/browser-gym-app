import type { SessionRirSummary } from "../services/sessionRir";
import "./SessionRirBoxPlot.css";

/** Trim a trailing ".0" so integer medians read as "3", not "3.0". */
function formatRir(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

/**
 * Horizontal box-and-whisker plot of the session's working-set RIR, with a
 * labeled reference line for the RIR target. Mirrors the reps box plot in the
 * Year in Review (RepBoxPlot) but on a signed, dynamic axis that always spans
 * the data and the target.
 */
export default function SessionRirBoxPlot({ summary }: { summary: SessionRirSummary }) {
  const { values, target, workingSetCount, amrapExcludedCount, box } = summary;

  // No working sets to plot: state why, rather than hiding the section.
  if (workingSetCount === 0) {
    return (
      <p className="rir-plot__empty sum-reveal">
        {amrapExcludedCount > 0
          ? "Every working set this session was AMRAP, so there is no RIR to measure against a target."
          : "No working sets this session."}
      </p>
    );
  }

  // Integer axis domain padded half a unit each side, so integer RIR values sit
  // on tick centres (the same (v - 0.5)/max spacing the reps box plot uses).
  const loInt = Math.floor(Math.min(...values, target));
  const hiInt = Math.ceil(Math.max(...values, target));
  const axisLo = loInt - 0.5;
  const axisHi = hiInt + 0.5;
  const pos = (v: number) => ((v - axisLo) / (axisHi - axisLo)) * 100;

  const range = hiInt - loInt;
  const step = range <= 8 ? 1 : Math.ceil(range / 8);
  const ticks: number[] = [];
  for (let t = loInt; t <= hiInt; t += step) ticks.push(t);

  const targetPos = pos(target);
  // Anchor the target label to whichever side keeps it inside the plot.
  const targetLabelStyle =
    targetPos <= 55
      ? { left: `${targetPos}%` }
      : { right: `${100 - targetPos}%` };

  const median = box ? box.median : values[0];
  const caption =
    `${workingSetCount} working set${workingSetCount === 1 ? "" : "s"}` +
    ` · median ${formatRir(median)} RIR` +
    (amrapExcludedCount > 0
      ? ` · ${amrapExcludedCount} AMRAP set${amrapExcludedCount === 1 ? "" : "s"} excluded`
      : "");

  return (
    <div className="rir-plot sum-reveal">
      <div className="rir-plot__chart" aria-hidden="true">
        <div className="rir-plot__labelrow">
          <span
            className={`rir-plot__target-label${targetPos <= 55 ? " rir-plot__target-label--right" : " rir-plot__target-label--left"}`}
            style={targetLabelStyle}
          >
            Target {formatRir(target)}
          </span>
        </div>

        <div className="rir-plot__track">
          {box ? (
            <>
              <span
                className="rir-plot__whisker"
                style={{
                  left: `${pos(box.whiskerLow)}%`,
                  width: `${pos(box.whiskerHigh) - pos(box.whiskerLow)}%`,
                }}
              />
              <span className="rir-plot__cap" style={{ left: `${pos(box.whiskerLow)}%` }} />
              <span className="rir-plot__cap" style={{ left: `${pos(box.whiskerHigh)}%` }} />
              <span
                className="rir-plot__box"
                style={{
                  left: `${pos(box.q1)}%`,
                  width: `${Math.max(pos(box.q3) - pos(box.q1), 1)}%`,
                }}
              />
              <span className="rir-plot__median" style={{ left: `${pos(box.median)}%` }} />
            </>
          ) : (
            // Single working set: a lone point, no box or whiskers.
            <span className="rir-plot__point" style={{ left: `${pos(values[0])}%` }} />
          )}
          <span className="rir-plot__target" style={{ left: `${targetPos}%` }} />
        </div>

        <div className="rir-plot__axis">
          {ticks.map((t) => (
            <span key={t} className="rir-plot__tick" style={{ left: `${pos(t)}%` }}>
              {t}
            </span>
          ))}
        </div>
      </div>

      <p className="rir-plot__caption">{caption}</p>
    </div>
  );
}
