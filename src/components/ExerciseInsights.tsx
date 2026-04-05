import { useEffect, useState } from "react";
import type { ExerciseSessionDataPoint } from "../repositories/programRepository";
import { getExerciseSessionHistory, resolveExerciseSeasonKey } from "../repositories/programRepository";
import "./ExerciseInsights.css";

interface ExerciseInsightsProps {
  exerciseTemplateId: string;
  exerciseName: string;
  currentExerciseInstanceId: string;
  isBodyweight?: boolean;
}

type BinType = "week" | "season" | "quarter" | "year";

interface ChartPoint {
  key: string;
  date: string;
  topEstimatedOneRepMax: number;
  topWeight: number | null;
  topReps: number | null;
  containsCurrentSession: boolean;
}

function formatMetricValue(value: number | null, suffix = ""): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Number.isInteger(value) ? value : value.toFixed(1)}${suffix}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const year = String(d.getFullYear()).slice(2);
  return `${d.getDate()} ${months[d.getMonth()]} '${year}`;
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const year = String(d.getFullYear()).slice(2);
  return `${months[d.getMonth()]} '${year}`;
}

// Returns the ISO date string of the Monday of the week containing `date`.
function getMondayKey(iso: string): string {
  const d = new Date(iso);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function getQuarterKey(iso: string): string {
  const d = new Date(iso);
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `${d.getUTCFullYear()}-Q${q}`;
}

function getYearKey(iso: string): string {
  return String(new Date(iso).getUTCFullYear());
}

// For calendar-derived keys, returns a stable canonical date (1st of the
// period) so the time-proportional x-axis spaces bins evenly regardless of
// when within the period sessions actually occurred.
// Returns null for program-instance keys (weekInstanceId / seasonInstanceId),
// which fall back to the earliest session date in the group.
function calendarCanonicalDate(key: string, binType: BinType): string | null {
  if (binType === "year") return `${key}-01-01`;
  if (binType === "quarter") {
    const [year, q] = key.split("-Q");
    const month = (parseInt(q) - 1) * 3 + 1;
    return `${year}-${String(month).padStart(2, "0")}-01`;
  }
  if (binType === "season" && /^\d{4}-\d{2}$/.test(key)) return `${key}-01`;
  if (binType === "week" && /^\d{4}-\d{2}-\d{2}$/.test(key)) return key;
  return null;
}

function binDataPoints(
  dataPoints: ExerciseSessionDataPoint[],
  binType: BinType,
  currentExerciseInstanceId: string,
  isBodyweight: boolean
): ChartPoint[] {
  const groups = new Map<
    string,
    { points: ExerciseSessionDataPoint[]; containsCurrent: boolean; canonicalDate: string | null }
  >();

  for (const d of dataPoints) {
    const key =
      binType === "week"
        ? d.weekInstanceId ?? getMondayKey(d.date)
        : binType === "season"
        ? resolveExerciseSeasonKey(d.seasonInstanceId, d.date)
        : binType === "quarter"
        ? getQuarterKey(d.date)
        : getYearKey(d.date);

    if (!groups.has(key)) {
      groups.set(key, { points: [], containsCurrent: false, canonicalDate: calendarCanonicalDate(key, binType) });
    }
    const group = groups.get(key)!;
    group.points.push(d);
    if (d.exerciseInstanceId === currentExerciseInstanceId) {
      group.containsCurrent = true;
    }
  }

  return Array.from(groups.values())
    .map(({ points, containsCurrent, canonicalDate }) => {
      const best = isBodyweight
        ? points.reduce((b, d) => ((d.topRepCount ?? 0) > (b.topRepCount ?? 0) ? d : b))
        : points.reduce((b, d) =>
            (d.topEstimatedOneRepMax ?? 0) > (b.topEstimatedOneRepMax ?? 0) ? d : b
          );
      const date = canonicalDate ?? points.map((p) => p.date).sort().at(-1)!;
      return {
        key: date,
        date,
        topEstimatedOneRepMax: isBodyweight
          ? (best.topRepCount ?? 0)
          : (best.topEstimatedOneRepMax ?? 0),
        topWeight: best.topWeight,
        topReps: best.topReps,
        containsCurrentSession: containsCurrent,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

const CHART_W = 300;
const CHART_H = 128;
const PAD = { top: 14, right: 10, bottom: 28, left: 38 };
const PLOT_W = CHART_W - PAD.left - PAD.right;
const PLOT_H = CHART_H - PAD.top - PAD.bottom;
const DOT_THRESHOLD = 30;

// Splits points into continuous segments. A segment break occurs when the gap
// between two consecutive points exceeds the median gap across all points.
function buildSegments(chartPoints: ChartPoint[]): number[][] {
  const n = chartPoints.length;
  if (n === 0) return [];
  if (n === 1) return [[0]];

  const dates = chartPoints.map((d) => new Date(d.date).getTime());

  const gaps = [];
  for (let i = 1; i < n; i++) {
    gaps.push(dates[i] - dates[i - 1]);
  }

  const sorted = [...gaps].sort((a, b) => a - b);
  const medianGap = sorted[Math.floor(sorted.length / 2)];

  const segments: number[][] = [];
  let current: number[] = [0];

  for (let i = 1; i < n; i++) {
    if (gaps[i - 1] > medianGap * 3) {
      segments.push(current);
      current = [i];
    } else {
      current.push(i);
    }
  }
  segments.push(current);
  return segments;
}

function E1RMChart({
  chartPoints,
}: {
  chartPoints: ChartPoint[];
}) {
  const n = chartPoints.length;
  if (n === 0) return null;

  const e1RMs = chartPoints.map((d) => d.topEstimatedOneRepMax);
  const minVal = Math.min(...e1RMs);
  const maxVal = Math.max(...e1RMs);
  const range = maxVal - minVal || 10;
  const yPadding = range * 0.2;
  const yMin = Math.max(0, minVal - yPadding);
  const yMax = maxVal + yPadding;

  const timestamps = chartPoints.map((d) => new Date(d.date).getTime());
  const minDate = timestamps[0];
  const maxDate = timestamps[n - 1];
  const dateRange = maxDate - minDate || 1;

  const xScale = (i: number) =>
    n > 1
      ? PAD.left + ((timestamps[i] - minDate) / dateRange) * PLOT_W
      : PAD.left + PLOT_W / 2;
  const yScale = (v: number) =>
    PAD.top + PLOT_H - ((v - yMin) / (yMax - yMin)) * PLOT_H;

  const segments = buildSegments(chartPoints);

  const isolatedIndices = new Set(
    segments.filter((seg) => seg.length === 1).map((seg) => seg[0])
  );

  const yTickValues = [0, 1, 2].map((i) => {
    const v = yMin + (i / 2) * (yMax - yMin);
    return { label: Math.round(v), y: yScale(v) };
  });

  const xLabelIndices =
    n === 1 ? [0] : n > 6 ? [0, Math.floor(n / 2), n - 1] : [0, n - 1];

  const showDots = n <= DOT_THRESHOLD;

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="exercise-insights-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d8f06a" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#d8f06a" stopOpacity="0" />
        </linearGradient>
      </defs>

      {yTickValues.map(({ label, y }) => (
        <g key={label}>
          <line
            x1={PAD.left}
            y1={y}
            x2={CHART_W - PAD.right}
            y2={y}
            stroke="#2b313a"
            strokeWidth="1"
          />
          <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize="9" fill="#7e8794">
            {label}
          </text>
        </g>
      ))}

      {segments.map((seg, si) => {
        if (seg.length < 2) return null;
        const first = seg[0];
        const last = seg[seg.length - 1];
        if (xScale(last) - xScale(first) < 4) return null;
        const areaD =
          `M ${xScale(first)},${yScale(chartPoints[first].topEstimatedOneRepMax)} ` +
          seg.slice(1).map((i) => `L ${xScale(i)},${yScale(chartPoints[i].topEstimatedOneRepMax)}`).join(" ") +
          ` L ${xScale(last)},${PAD.top + PLOT_H} L ${xScale(first)},${PAD.top + PLOT_H} Z`;
        return <path key={si} d={areaD} fill="url(#exercise-insights-fill)" />;
      })}

      {segments.map((seg, si) => {
        if (seg.length < 2) return null;
        const points = seg
          .map((i) => `${xScale(i)},${yScale(chartPoints[i].topEstimatedOneRepMax)}`)
          .join(" ");
        return (
          <polyline
            key={si}
            points={points}
            fill="none"
            stroke="#c4e23c"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        );
      })}

      {chartPoints.map((d, i) => {
        if (showDots) {
          return (
            <circle
              key={d.key}
              cx={xScale(i)}
              cy={yScale(d.topEstimatedOneRepMax)}
              r={d.containsCurrentSession ? 4.5 : 3}
              fill={d.containsCurrentSession ? "#d8f06a" : "#1a1f26"}
              stroke={d.containsCurrentSession ? "#d8f06a" : "#c4e23c"}
              strokeWidth="2"
            />
          );
        }
        if (isolatedIndices.has(i) || d.containsCurrentSession) {
          return (
            <circle
              key={d.key}
              cx={xScale(i)}
              cy={yScale(d.topEstimatedOneRepMax)}
              r={d.containsCurrentSession ? 3 : 1.5}
              fill={d.containsCurrentSession ? "#d8f06a" : "#c4e23c"}
            />
          );
        }
        return null;
      })}

      {xLabelIndices.map((idx) => {
        const d = chartPoints[idx];
        const x = xScale(idx);
        const anchor = idx === 0 ? "start" : idx === n - 1 ? "end" : "middle";
        return (
          <text key={idx} x={x} y={CHART_H - 4} textAnchor={anchor} fontSize="9" fill="#7e8794">
            {formatDateShort(d.date)}
          </text>
        );
      })}
    </svg>
  );
}

export default function ExerciseInsights({
  exerciseTemplateId,
  exerciseName,
  currentExerciseInstanceId,
  isBodyweight = false,
}: ExerciseInsightsProps) {
  const [history, setHistory] = useState<ExerciseSessionDataPoint[] | null>(null);
  const [binType, setBinType] = useState<BinType>("week");

  useEffect(() => {
    getExerciseSessionHistory(exerciseName).then(setHistory);
  }, [exerciseTemplateId, exerciseName]);

  if (history === null) {
    return null;
  }

  const chartPoints = binDataPoints(history, binType, currentExerciseInstanceId, isBodyweight);

  const historicalSessions = history.filter(
    (d) => d.exerciseInstanceId !== currentExerciseInstanceId
  );

  const previousLift =
    historicalSessions.length > 0
      ? historicalSessions[historicalSessions.length - 1]
      : null;

  const bestLift = isBodyweight
    ? historicalSessions.reduce<ExerciseSessionDataPoint | null>((best, d) => {
        if (best == null || (d.topRepCount ?? 0) > (best.topRepCount ?? 0)) return d;
        return best;
      }, null)
    : historicalSessions.reduce<ExerciseSessionDataPoint | null>((best, d) => {
        if (best == null || (d.topEstimatedOneRepMax ?? 0) > (best.topEstimatedOneRepMax ?? 0)) return d;
        return best;
      }, null);

  const hasChartData = history.length > 0;
  const hasHistory = historicalSessions.length > 0;

  return (
    <section className="exercise-insights">
      <div className="exercise-insights__header-row">
        <p className="exercise-insights__eyebrow">Insights</p>
        {hasChartData && (
          <div className="exercise-insights__bin-toggle">
            {(["week", "season", "quarter", "year"] as BinType[]).map((b) => (
              <button
                key={b}
                type="button"
                className={`exercise-insights__bin-btn${binType === b ? " exercise-insights__bin-btn--active" : ""}`}
                onClick={() => setBinType(b)}
              >
                {b.charAt(0).toUpperCase() + b.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      {hasChartData ? (
        <div className="exercise-insights__chart">
          <p className="exercise-insights__chart-label">
            {isBodyweight ? "Max reps over time" : "e1RM over time (kg)"}
          </p>
          <E1RMChart key={binType} chartPoints={chartPoints} />
        </div>
      ) : (
        <p className="exercise-insights__empty">No data recorded yet.</p>
      )}

      {hasHistory && (
        <div className="exercise-insights__metrics-grid">
          <div className="exercise-insights__metric">
            <span className="exercise-insights__metric-eyebrow">Previous lift</span>
            {previousLift ? (
              <>
                <span className="exercise-insights__metric-date">
                  {formatDate(previousLift.date)}
                </span>
                {isBodyweight ? (
                  <strong className="exercise-insights__metric-value">
                    {previousLift.topRepCount ?? "—"} reps
                  </strong>
                ) : (
                  <>
                    <strong className="exercise-insights__metric-value">
                      {formatMetricValue(previousLift.topWeight, "kg")} ×{" "}
                      {previousLift.topReps}
                    </strong>
                    <span className="exercise-insights__metric-e1rm">
                      {formatMetricValue(previousLift.topEstimatedOneRepMax, "kg")} e1RM
                    </span>
                  </>
                )}
              </>
            ) : (
              <strong className="exercise-insights__metric-value">—</strong>
            )}
          </div>

          <div className="exercise-insights__metric">
            <span className="exercise-insights__metric-eyebrow">Best lift</span>
            {bestLift ? (
              <>
                <span className="exercise-insights__metric-date">
                  {formatDate(bestLift.date)}
                </span>
                {isBodyweight ? (
                  <strong className="exercise-insights__metric-value">
                    {bestLift.topRepCount ?? "—"} reps
                  </strong>
                ) : (
                  <>
                    <strong className="exercise-insights__metric-value">
                      {formatMetricValue(bestLift.topWeight, "kg")} ×{" "}
                      {bestLift.topReps}
                    </strong>
                    <span className="exercise-insights__metric-e1rm">
                      {formatMetricValue(bestLift.topEstimatedOneRepMax, "kg")} e1RM
                    </span>
                  </>
                )}
              </>
            ) : (
              <strong className="exercise-insights__metric-value">—</strong>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
