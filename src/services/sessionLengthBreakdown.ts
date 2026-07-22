/**
 * Shapes raw per-session length data into a 2-D grid for the session-length
 * heatmap: program day (rows) crossed with RIR target (columns), each cell the
 * median length of the sessions that fall in it.
 *
 * Pure and I/O-free: the repository does the async gathering (durations, RIR
 * targets) and hands the flat points here to be aggregated. Session length
 * itself is the first-set-to-last-set span computed by getSessionDuration —
 * nothing in this file touches that.
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

/** One (program day × RIR target) square of the heatmap. */
export interface SessionLengthCell {
  programDayId: string;
  rirTarget: number;
  /** Median session length in the cell (equal to the lone value when count is 1). */
  medianSeconds: number;
  /** How many sessions the median is drawn from (usually 1 per season). */
  count: number;
}

export interface SessionLengthBreakdown {
  /** Distinct program days, ordered by first appearance — the heatmap rows. */
  programDays: ProgramDayColumn[];
  /** Distinct RIR targets, ordered easiest→hardest (highest RIR first) — the columns. */
  rirTargets: number[];
  /** Populated squares only; a missing (day, RIR) pair has no cell. */
  cells: SessionLengthCell[];
  /** Smallest / largest cell median, in seconds (0 when there are no cells). */
  minSeconds: number;
  maxSeconds: number;
  /** Completed sessions dropped because no set timing was recoverable. */
  excludedCount: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Group the flat points into a (program day × RIR target) grid, taking the
 * median length per square. Program-day (row) order follows first appearance,
 * so rows read in the order the days occur in a week; RIR (column) order is
 * descending, so the block progresses left→right from easiest to hardest. The
 * caller emits points in week-then-day order (the repository getter does).
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
  // tank = hardest sits last), so columns read easiest→hardest left to right.
  const rirTargets = Array.from(rirSet).sort((a, b) => b - a);

  // Collect durations per (day, RIR) square. Points with no resolvable RIR
  // target can't be placed on the grid and are dropped (rare — a configured
  // season always has a rirSequence).
  const groups = new Map<string, number[]>();
  for (const p of points) {
    if (p.rirTarget == null) continue;
    const key = `${p.programDayId}|${p.rirTarget}`;
    const list = groups.get(key) ?? [];
    list.push(p.durationSeconds);
    groups.set(key, list);
  }

  const cells: SessionLengthCell[] = [];
  for (const [key, durations] of groups) {
    const sep = key.lastIndexOf("|");
    cells.push({
      programDayId: key.slice(0, sep),
      rirTarget: Number(key.slice(sep + 1)),
      medianSeconds: median(durations),
      count: durations.length,
    });
  }

  const medians = cells.map((c) => c.medianSeconds);
  const minSeconds = medians.length ? Math.min(...medians) : 0;
  const maxSeconds = medians.length ? Math.max(...medians) : 0;

  return { programDays, rirTargets, cells, minSeconds, maxSeconds, excludedCount };
}
