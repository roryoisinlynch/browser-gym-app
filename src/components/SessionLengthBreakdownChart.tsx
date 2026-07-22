import { Fragment } from "react";
import { formatDuration } from "../services/sessionMetrics";
import type { SessionLengthBreakdown } from "../services/sessionLengthBreakdown";
import "./SessionLengthBreakdownChart.css";

/** Trim a trailing ".0" so integer RIR values read as "2", not "2.0". */
function formatRir(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

// Session length is a first-set-to-last-set span, so a single stray late-logged
// set can balloon one session to many hours. The colour scale caps at 3h so one
// outlier can't wash the whole grid toward the dim end; a longer cell still
// prints its true value and just takes the brightest shade.
const DURATION_CAP_SECONDS = 3 * 60 * 60;

// Sequential shade for session length, on the accent hue: a dim square for the
// shortest session climbing to bright accent lime for the longest.
const SHORT_ANCHOR = [52, 66, 30]; // #34421e
const LONG_ANCHOR = [216, 240, 106]; // #d8f06a (var(--accent))

function shadeFor(t: number): number[] {
  const clamped = Math.max(0, Math.min(1, t));
  return SHORT_ANCHOR.map((s, k) =>
    Math.round(s + (LONG_ANCHOR[k] - s) * clamped)
  );
}

function rgb(c: number[]): string {
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

// Light or dark ink, whichever reads on the cell's shade. A cheap perceived
// luminance is enough for the binary choice.
function inkFor(c: number[]): string {
  const lum = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
  return lum > 0.5 ? "#0f1318" : "#e8edf5"; // --bg-bottom : --text-strong
}

/**
 * A 2-D heatmap of session length across two dimensions: program day (rows) and
 * RIR target (columns, easiest→hardest left to right). Each square is shaded and
 * labelled with the median length of its sessions. Hand-built with a CSS grid,
 * in the same token vocabulary as the rest of the summary.
 */
export default function SessionLengthBreakdownChart({
  breakdown,
}: {
  breakdown: SessionLengthBreakdown;
}) {
  const { programDays, rirTargets, cells, minSeconds, maxSeconds, excludedCount } =
    breakdown;

  const totalSessions = cells.reduce((n, c) => n + c.count, 0);
  // A grid needs at least a couple of sessions to say anything.
  if (totalSessions < 2 || rirTargets.length === 0) {
    return (
      <p className="slbc__empty sum-reveal">
        Not enough completed sessions this season to chart session length yet.
        {excludedCount > 0 &&
          ` ${excludedCount} session${excludedCount === 1 ? "" : "s"} had no set timing to measure.`}
      </p>
    );
  }

  const cellByKey = new Map(
    cells.map((c) => [`${c.programDayId}|${c.rirTarget}`, c])
  );
  const nCols = rirTargets.length;

  const domainMax = Math.min(maxSeconds, DURATION_CAP_SECONDS);
  const hasOverflow = maxSeconds > DURATION_CAP_SECONDS;
  const norm = (v: number) =>
    domainMax > minSeconds
      ? (Math.min(v, domainMax) - minSeconds) / (domainMax - minSeconds)
      : 0.75;

  return (
    <div className="slbc sum-reveal">
      <p className="slbc__xtitle">RIR target</p>

      <div
        className="slbc__grid"
        style={{ gridTemplateColumns: `auto repeat(${nCols}, minmax(0, 1fr))` }}
        aria-hidden="true"
      >
        <span className="slbc__corner" />
        {rirTargets.map((r) => (
          <span key={`head-${r}`} className="slbc__colhead">
            {formatRir(r)}
          </span>
        ))}

        {programDays.map((day, ri) => (
          <Fragment key={day.id}>
            <span className="slbc__rowhead">{day.label}</span>
            {rirTargets.map((r, ci) => {
              const cell = cellByKey.get(`${day.id}|${r}`);
              const i = ri * nCols + ci;
              if (!cell) {
                return (
                  <span
                    key={r}
                    className="slbc__cell slbc__cell--empty"
                    style={{ "--i": i } as React.CSSProperties}
                  >
                    ·
                  </span>
                );
              }
              const shade = shadeFor(norm(cell.medianSeconds));
              return (
                <span
                  key={r}
                  className="slbc__cell"
                  title={`${day.label} · RIR ${formatRir(r)} · ${formatDuration(cell.medianSeconds)}${cell.count > 1 ? ` (median of ${cell.count})` : ""}`}
                  style={
                    {
                      background: rgb(shade),
                      color: inkFor(shade),
                      "--i": i,
                    } as React.CSSProperties
                  }
                >
                  {formatDuration(cell.medianSeconds)}
                </span>
              );
            })}
          </Fragment>
        ))}
      </div>

      <div className="slbc__scale" aria-hidden="true">
        <span className="slbc__scale-end">{formatDuration(minSeconds)}</span>
        <span
          className="slbc__scale-bar"
          style={{
            background: `linear-gradient(to right, ${rgb(SHORT_ANCHOR)}, ${rgb(LONG_ANCHOR)})`,
          }}
        />
        <span className="slbc__scale-end">
          {hasOverflow ? ">3h" : formatDuration(domainMax)}
        </span>
      </div>

      <p className="slbc__caption">
        Rows are program days, columns RIR targets from higher (easier) to lower
        (closer to failure). Each square is the median session length for that
        pairing; brighter ran longer.
        {hasOverflow && (
          <span className="slbc__caption-note">
            {" "}
            The shade scale caps at 3h.
          </span>
        )}
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
