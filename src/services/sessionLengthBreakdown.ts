/**
 * Shapes raw per-session length data into a chart-ready breakdown across two
 * dimensions: program day (the column) and RIR target (the colour/legend).
 *
 * Pure and I/O-free: the repository does the async gathering (durations, RIR
 * targets) and hands the flat points here to be grouped and ordered for the
 * SessionLengthBreakdownChart. Session length itself is the first-set-to-last-set
 * span computed by getSessionDuration — nothing in this file touches that.
 */

/** One completed, timed session placed by its program day and RIR target. */
export interface SessionLengthPoint {
  sessionId: string;
  /** Stable program-day identity (the session template id). */
  programDayId: string;
  /** Display label for the program day, e.g. "Push 1" (the frozen session name). */
  programDayLabel: string;
  /** Prescribed reps-in-reserve for the session's week; null if not resolvable. */
  rirTarget: number | null;
  /** First-logged-set to last-logged-set span, in seconds. */
  durationSeconds: number;
}

export interface ProgramDayColumn {
  id: string;
  label: string;
}

export interface SessionLengthBreakdown {
  points: SessionLengthPoint[];
  /** Distinct program days, ordered by first appearance (week order, then day order). */
  programDays: ProgramDayColumn[];
  /** Distinct RIR targets present, ordered easiest→hardest (highest RIR first). */
  rirTargets: number[];
  /** Longest plotted session, in seconds (0 when there are no points). */
  maxDurationSeconds: number;
  /** Completed sessions dropped because no set timing was recoverable. */
  excludedCount: number;
}

/**
 * Group the flat points into ordered program-day columns and a distinct,
 * effort-ordered RIR list. Program-day order follows first appearance so the
 * columns read in the order the days occur in a week; the caller is responsible
 * for emitting points in week-then-day order (the repository getter does).
 */
export function buildSessionLengthBreakdown(
  points: SessionLengthPoint[],
  excludedCount: number
): SessionLengthBreakdown {
  const programDays: ProgramDayColumn[] = [];
  const seenDays = new Set<string>();
  for (const p of points) {
    if (!seenDays.has(p.programDayId)) {
      seenDays.add(p.programDayId);
      programDays.push({ id: p.programDayId, label: p.programDayLabel });
    }
  }

  const rirSet = new Set<number>();
  for (const p of points) {
    if (p.rirTarget != null) rirSet.add(p.rirTarget);
  }
  // Descending: the highest RIR is the easiest week (fewest reps left in the
  // tank = hardest sits last), matching the chart's dim→accent colour ramp.
  const rirTargets = Array.from(rirSet).sort((a, b) => b - a);

  const maxDurationSeconds = points.reduce(
    (max, p) => Math.max(max, p.durationSeconds),
    0
  );

  return { points, programDays, rirTargets, maxDurationSeconds, excludedCount };
}
