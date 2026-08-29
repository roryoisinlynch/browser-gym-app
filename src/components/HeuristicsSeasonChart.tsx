import type { HeuristicDayPoint } from "../services/heuristicsSeasonSummary";
import "./HeuristicsSeasonChart.css";

// Chart geometry. A real viewBox (no preserveAspectRatio="none") because the
// plot carries text labels, which stretching would distort.
const W = 320;
const H = 132;
const PAD = { top: 10, right: 10, bottom: 20, left: 18 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

// Runs of consecutive rated days; a null day breaks the line into segments.
function segmentsOf(series: HeuristicDayPoint[]): number[][] {
  const segs: number[][] = [];
  let run: number[] = [];
  for (let i = 0; i < series.length; i++) {
    if (series[i].mean == null) {
      if (run.length > 0) {
        segs.push(run);
        run = [];
      }
    } else {
      run.push(i);
    }
  }
  if (run.length > 0) segs.push(run);
  return segs;
}

/**
 * Day-by-day heuristic score lines for the dashboard's season comparison:
 * the current season's daily means (accent) over the same day-count window of
 * the previous season (grey context). Both series share a day-index axis, so
 * `previous` is expected pre-truncated to `current`'s length; a previous
 * season shorter than the window just ends early.
 */
export default function HeuristicsSeasonChart({
  current,
  previous,
}: {
  current: HeuristicDayPoint[];
  previous: HeuristicDayPoint[];
}) {
  // The section's >=2-rated-days gate makes N >= 2 in practice; the max() only
  // guards the divide when rendered outside that gate.
  const N = Math.max(current.length, 2);
  const xScale = (i: number) => PAD.left + (i / (N - 1)) * PLOT_W;
  const yScale = (v: number) => PAD.top + PLOT_H - ((v - 1) / 4) * PLOT_H;

  const polyPoints = (series: HeuristicDayPoint[], seg: number[]) =>
    seg.map((i) => `${xScale(i).toFixed(1)},${yScale(series[i].mean!).toFixed(1)}`).join(" ");

  const renderSeries = (series: HeuristicDayPoint[], variant: "previous" | "current") =>
    segmentsOf(series).map((seg) =>
      seg.length >= 2 ? (
        <polyline
          key={`${variant}-${seg[0]}`}
          className={`heuristics-chart__line heuristics-chart__line--${variant}`}
          points={polyPoints(series, seg)}
          pathLength={1}
          fill="none"
          stroke={variant === "current" ? "var(--accent)" : "var(--text-soft)"}
          strokeOpacity={variant === "current" ? 1 : 0.55}
          strokeWidth={variant === "current" ? 2 : 1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : (
        // An isolated rated day has no neighbour to connect to; show it as a dot.
        <circle
          key={`${variant}-${seg[0]}`}
          className="heuristics-chart__pt"
          cx={xScale(seg[0])}
          cy={yScale(series[seg[0]].mean!)}
          r="2"
          fill={variant === "current" ? "var(--accent)" : "var(--text-soft)"}
          fillOpacity={variant === "current" ? 1 : 0.55}
        />
      )
    );

  // Terminal dot on the last rated day. When today has no answers yet it sits
  // short of the right edge, which reads honestly as "no entry yet".
  let lastRated = -1;
  for (let i = current.length - 1; i >= 0; i--) {
    if (current[i].mean != null) {
      lastRated = i;
      break;
    }
  }

  const gridValues = [1, 2, 3, 4, 5];
  const midDay = Math.round((N + 1) / 2);
  const previousHasData = previous.some((p) => p.mean != null);
  const note =
    `Daily average of your answers over the first ${current.length} days of each season.` +
    (previousHasData ? "" : " Last season has no entries in this range.");

  return (
    <div className="heuristics-chart">
      <p className="heuristics-chart__label">Day by day</p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        aria-hidden="true"
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        {gridValues.map((v) => (
          <g key={`grid-${v}`}>
            <line
              x1={PAD.left}
              x2={PAD.left + PLOT_W}
              y1={yScale(v)}
              y2={yScale(v)}
              stroke="var(--panel-border)"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 5}
              y={yScale(v)}
              dy="3"
              textAnchor="end"
              fontSize="9"
              fill="var(--text-soft)"
            >
              {v}
            </text>
          </g>
        ))}
        {renderSeries(previous, "previous")}
        {renderSeries(current, "current")}
        {lastRated >= 0 && (
          <circle
            className="heuristics-chart__enddot"
            cx={xScale(lastRated)}
            cy={yScale(current[lastRated].mean!)}
            r="2.6"
            fill="var(--accent)"
          />
        )}
        <text x={xScale(0)} y={H - 4} textAnchor="start" fontSize="9" fill="var(--text-soft)">
          Day 1
        </text>
        {N > 14 && (
          <text
            x={xScale(midDay - 1)}
            y={H - 4}
            textAnchor="middle"
            fontSize="9"
            fill="var(--text-soft)"
          >
            Day {midDay}
          </text>
        )}
        <text x={xScale(N - 1)} y={H - 4} textAnchor="end" fontSize="9" fill="var(--text-soft)">
          Day {N}
        </text>
      </svg>
      <div className="heuristics-chart__legend">
        <span className="heuristics-chart__legend-item">
          <span className="heuristics-chart__swatch heuristics-chart__swatch--current" />
          This season
        </span>
        {previousHasData && (
          <span className="heuristics-chart__legend-item">
            <span className="heuristics-chart__swatch heuristics-chart__swatch--previous" />
            Last season
          </span>
        )}
      </div>
      <p className="heuristics-chart__note">{note}</p>
    </div>
  );
}
