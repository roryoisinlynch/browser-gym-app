import { formatDuration } from "../services/sessionMetrics";
import type { SessionLengthBreakdown } from "../services/sessionLengthBreakdown";
import "./SessionLengthBreakdownChart.css";

/** Trim a trailing ".0" so integer RIR values read as "2", not "2.0". */
function formatRir(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

// Plot geometry. The track is a fixed height; dots are positioned by percentage
// across (program day, dodged by RIR) and by pixels down (session length).
const TRACK_H = 200; // px
const Y_GUTTER = 50; // px reserved for the duration axis labels
// Fraction of a program-day column's width the dots spread across when a week's
// RIR targets fan out left→right; keeps columns visually distinct.
const BAND_FRACTION = 0.6;

// Sequential RIR ramp on the accent hue: dim olive for the easiest week (highest
// RIR) climbing to bright accent lime for the hardest (lowest RIR), matching the
// swarm plot's "effort = accent" language. RIR is also encoded by column
// position and the legend, so colour is never the only channel.
const EASY_ANCHOR = [96, 110, 68]; // #606e44
const HARD_ANCHOR = [216, 240, 106]; // #d8f06a (var(--accent))

function rirColor(rir: number | null, rirTargets: number[]): string {
  if (rir == null || rirTargets.length === 0) return "var(--text-soft)";
  const i = rirTargets.indexOf(rir);
  if (i < 0) return "var(--text-soft)";
  const t = rirTargets.length > 1 ? i / (rirTargets.length - 1) : 1;
  const c = EASY_ANCHOR.map((e, k) => Math.round(e + (HARD_ANCHOR[k] - e) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/**
 * Round the longest session up to a tidy axis maximum and pick a tick step that
 * yields at most four gridlines. Steps are in minutes; the returned values are
 * in seconds to match formatDuration and the raw durations.
 */
function niceDurationAxis(maxSeconds: number): {
  maxSeconds: number;
  tickStepSeconds: number;
} {
  const maxMin = Math.max(1, maxSeconds / 60);
  const steps = [5, 10, 15, 20, 30, 45, 60, 90, 120];
  let step = steps[steps.length - 1];
  for (const s of steps) {
    if (Math.ceil(maxMin / s) <= 4) {
      step = s;
      break;
    }
  }
  const niceMaxMin = Math.ceil(maxMin / step) * step;
  return { maxSeconds: niceMaxMin * 60, tickStepSeconds: step * 60 };
}

/**
 * Grouped dot plot of session length across two dimensions: program day (the
 * x-axis columns) and RIR target (dot colour and the left→right dodge within a
 * column). Each dot is one completed, timed session, placed vertically by its
 * first-set-to-last-set duration. Hand-built with positioned spans in the same
 * idiom as SessionRirSwarmPlot.
 */
export default function SessionLengthBreakdownChart({
  breakdown,
}: {
  breakdown: SessionLengthBreakdown;
}) {
  const { points, programDays, rirTargets, maxDurationSeconds, excludedCount } =
    breakdown;

  // A distribution needs at least a couple of points to say anything.
  if (points.length < 2) {
    return (
      <p className="slbc__empty sum-reveal">
        Not enough completed sessions this season to chart session length yet.
        {excludedCount > 0 &&
          ` ${excludedCount} session${excludedCount === 1 ? "" : "s"} had no set timing to measure.`}
      </p>
    );
  }

  const { maxSeconds: axisMax, tickStepSeconds } =
    niceDurationAxis(maxDurationSeconds);

  const ticks: number[] = [];
  for (let s = 0; s <= axisMax; s += tickStepSeconds) ticks.push(s);

  const nCols = programDays.length;
  const colIndex = new Map(programDays.map((d, i) => [d.id, i]));
  // Half the pixel-free band a column's dots may fan across, as a percentage of
  // the whole track width.
  const bandHalf = ((100 / nCols) * BAND_FRACTION) / 2;

  function dotLeft(programDayId: string, rir: number | null): number {
    const col = colIndex.get(programDayId) ?? 0;
    const center = ((col + 0.5) / nCols) * 100;
    if (rir == null || rirTargets.length <= 1) return center;
    // Same RIR lands at the same offset in every column, so the hardest week is
    // always rightmost and the ramp reads consistently across days.
    const idx = rirTargets.indexOf(rir);
    const frac = idx < 0 ? 0.5 : idx / (rirTargets.length - 1);
    return center + (frac - 0.5) * bandHalf * 2;
  }

  function dotTop(durationSeconds: number): number {
    return (1 - durationSeconds / axisMax) * TRACK_H;
  }

  return (
    <div className="slbc sum-reveal">
      <div className="slbc__chart">
        <div className="slbc__plot" aria-hidden="true">
          <div className="slbc__yaxis" style={{ height: `${TRACK_H}px` }}>
            {ticks.map((s) => (
              <span
                key={s}
                className="slbc__ytick"
                style={{ top: `${dotTop(s)}px` }}
              >
                {s === 0 ? "0" : formatDuration(s)}
              </span>
            ))}
          </div>

          <div className="slbc__track" style={{ height: `${TRACK_H}px` }}>
            {ticks.map((s) => (
              <span
                key={`grid-${s}`}
                className="slbc__grid"
                style={{ top: `${dotTop(s)}px` }}
              />
            ))}
            {points.map((p, i) => (
              <span
                key={p.sessionId}
                className="slbc__dot"
                title={
                  p.rirTarget != null
                    ? `${p.programDayLabel} · RIR ${formatRir(p.rirTarget)} · ${formatDuration(p.durationSeconds)}`
                    : `${p.programDayLabel} · ${formatDuration(p.durationSeconds)}`
                }
                style={
                  {
                    left: `${dotLeft(p.programDayId, p.rirTarget)}%`,
                    top: `${dotTop(p.durationSeconds)}px`,
                    background: rirColor(p.rirTarget, rirTargets),
                    "--i": i,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        </div>

        <div
          className="slbc__xaxis"
          style={{ marginLeft: `${Y_GUTTER}px` }}
          aria-hidden="true"
        >
          {programDays.map((d) => (
            <span key={d.id} className="slbc__xlabel">
              {d.label}
            </span>
          ))}
        </div>
        <p className="slbc__xtitle" style={{ marginLeft: `${Y_GUTTER}px` }}>
          Program day
        </p>
      </div>

      {rirTargets.length > 0 && (
        <div className="slbc__legend">
          <span className="slbc__legend-title">RIR target</span>
          {rirTargets.map((r) => (
            <span key={r} className="slbc__legend-item">
              <span
                className="slbc__legend-dot"
                style={{ background: rirColor(r, rirTargets) }}
              />
              {formatRir(r)}
            </span>
          ))}
        </div>
      )}

      <p className="slbc__caption">
        Each dot is one completed session, placed by how long it ran between the
        first and last set logged. Columns group sessions by program day; dot
        shade marks the week's RIR target.
        {excludedCount > 0 && (
          <span className="slbc__caption-note">
            {" "}
            {excludedCount} session{excludedCount === 1 ? "" : "s"} without set
            timing {excludedCount === 1 ? "is" : "are"} not shown.
          </span>
        )}
      </p>
    </div>
  );
}
