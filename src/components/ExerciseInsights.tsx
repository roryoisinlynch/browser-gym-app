import { useEffect, useState } from "react";
import type { ExerciseSessionDataPoint } from "../repositories/programRepository";
import { getExerciseSessionHistory } from "../repositories/programRepository";
import "./ExerciseInsights.css";

interface ExerciseInsightsProps {
  exerciseTemplateId: string;
  exerciseName: string;
  currentExerciseInstanceId: string;
}

function formatMetricValue(value: number | null, suffix = ""): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Number.isInteger(value) ? value : value.toFixed(1)}${suffix}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const year = String(d.getFullYear()).slice(2);
  return `${months[d.getMonth()]} '${year}`;
}

const CHART_W = 300;
const CHART_H = 128;
const PAD = { top: 14, right: 10, bottom: 28, left: 38 };
const PLOT_W = CHART_W - PAD.left - PAD.right;
const PLOT_H = CHART_H - PAD.top - PAD.bottom;

function E1RMChart({
  dataPoints,
  currentExerciseInstanceId,
}: {
  dataPoints: ExerciseSessionDataPoint[];
  currentExerciseInstanceId: string;
}) {
  const n = dataPoints.length;
  if (n === 0) return null;

  const e1RMs = dataPoints.map((d) => d.topEstimatedOneRepMax);
  const minVal = Math.min(...e1RMs);
  const maxVal = Math.max(...e1RMs);
  const range = maxVal - minVal || 10;
  const yPadding = range * 0.2;
  const yMin = Math.max(0, minVal - yPadding);
  const yMax = maxVal + yPadding;

  const xScale = (i: number) =>
    PAD.left + (n > 1 ? (i / (n - 1)) * PLOT_W : PLOT_W / 2);
  const yScale = (v: number) =>
    PAD.top + PLOT_H - ((v - yMin) / (yMax - yMin)) * PLOT_H;

  const linePoints = dataPoints
    .map((d, i) => `${xScale(i)},${yScale(d.topEstimatedOneRepMax)}`)
    .join(" ");

  const areaPath =
    n > 1
      ? `M ${xScale(0)},${yScale(dataPoints[0].topEstimatedOneRepMax)} ` +
        dataPoints
          .slice(1)
          .map((d, i) => `L ${xScale(i + 1)},${yScale(d.topEstimatedOneRepMax)}`)
          .join(" ") +
        ` L ${xScale(n - 1)},${PAD.top + PLOT_H} L ${xScale(0)},${PAD.top + PLOT_H} Z`
      : "";

  const yTickValues = [0, 1, 2].map((i) => {
    const v = yMin + (i / 2) * (yMax - yMin);
    return { label: Math.round(v), y: yScale(v) };
  });

  const xLabelIndices =
    n === 1 ? [0] : n > 6 ? [0, Math.floor(n / 2), n - 1] : [0, n - 1];

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

      {areaPath && <path d={areaPath} fill="url(#exercise-insights-fill)" />}

      <polyline
        points={linePoints}
        fill="none"
        stroke="#c4e23c"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {dataPoints.map((d, i) => {
        const isCurrent = d.exerciseInstanceId === currentExerciseInstanceId;
        return (
          <circle
            key={i}
            cx={xScale(i)}
            cy={yScale(d.topEstimatedOneRepMax)}
            r={isCurrent ? 4.5 : 3}
            fill={isCurrent ? "#d8f06a" : "#1a1f26"}
            stroke={isCurrent ? "#d8f06a" : "#c4e23c"}
            strokeWidth="2"
          />
        );
      })}

      {xLabelIndices.map((idx) => {
        const d = dataPoints[idx];
        const x = xScale(idx);
        const anchor = idx === 0 ? "start" : idx === n - 1 ? "end" : "middle";
        return (
          <text
            key={idx}
            x={x}
            y={CHART_H - 4}
            textAnchor={anchor}
            fontSize="9"
            fill="#7e8794"
          >
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
}: ExerciseInsightsProps) {
  const [history, setHistory] = useState<ExerciseSessionDataPoint[] | null>(null);

  useEffect(() => {
    getExerciseSessionHistory(exerciseTemplateId, exerciseName).then(setHistory);
  }, [exerciseTemplateId, exerciseName]);

  if (history === null) {
    return null;
  }

  const historicalSessions = history.filter(
    (d) => d.exerciseInstanceId !== currentExerciseInstanceId
  );

  const previousLift =
    historicalSessions.length > 0
      ? historicalSessions[historicalSessions.length - 1]
      : null;

  const bestLift = historicalSessions.reduce<ExerciseSessionDataPoint | null>((best, d) => {
    if (best == null || d.topEstimatedOneRepMax > best.topEstimatedOneRepMax) return d;
    return best;
  }, null);

  const hasChartData = history.length > 0;
  const hasHistory = historicalSessions.length > 0;

  return (
    <section className="exercise-insights">
      <p className="exercise-insights__eyebrow">Insights</p>

      {hasChartData ? (
        <div className="exercise-insights__chart">
          <p className="exercise-insights__chart-label">e1RM over time (kg)</p>
          <E1RMChart
            dataPoints={history}
            currentExerciseInstanceId={currentExerciseInstanceId}
          />
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
                <strong className="exercise-insights__metric-value">
                  {formatMetricValue(previousLift.topWeight, "kg")} ×{" "}
                  {previousLift.topReps}
                </strong>
                <span className="exercise-insights__metric-e1rm">
                  {formatMetricValue(previousLift.topEstimatedOneRepMax, "kg")} e1RM
                </span>
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
                <strong className="exercise-insights__metric-value">
                  {formatMetricValue(bestLift.topWeight, "kg")} ×{" "}
                  {bestLift.topReps}
                </strong>
                <span className="exercise-insights__metric-e1rm">
                  {formatMetricValue(bestLift.topEstimatedOneRepMax, "kg")} e1RM
                </span>
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
