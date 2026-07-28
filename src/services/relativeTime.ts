// Shared relative-time formatting. The bucketing here is the single source of
// truth for "how long ago" phrasing across the app, so the exercise summary
// card and the insights stats panel always pick the same increment.

function daysSince(isoDate: string): number {
  return Math.round(
    (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24)
  );
}

// Magnitude + unit for an elapsed-day count, with no "ago" suffix. This is the
// shared bucketing core: callers either pass `daysSince(isoDate)` (time since a
// date) or the gap between two arbitrary dates.
// Buckets:
//   < 6 weeks    →  "N days"
//   < 6 months   →  "N weeks" (round to nearest week)
//   < 21 months  →  "N months" (round to nearest 30-day month)
//   ≥ 21 months  →  derive years from months/12 and bucket by quarter:
//                     Q1 [0, 0.25)       → "N years"
//                     Q2/Q3 [0.25, 0.75) → "over N years"
//                     Q4 [0.75, 1)       → "nearly N+1 years"
//                   Driving years off months (not raw days) keeps the
//                   21-month cutoff aligned to the Q4 boundary so 21 mo
//                   rolls cleanly into "nearly 2 years".
export function formatDayCount(days: number): string {
  if (days < 42) {
    return `${days} ${days === 1 ? "day" : "days"}`;
  }
  if (days < 180) {
    const weeks = Math.round(days / 7);
    return `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
  }
  const months = Math.round(days / 30);
  if (months < 21) return `${months} months`;
  const floorYears = Math.floor(months / 12);
  const fraction = (months % 12) / 12;
  if (fraction < 0.25) return `${floorYears} years`;
  if (fraction < 0.75) return `over ${floorYears} years`;
  return `nearly ${floorYears + 1} years`;
}

// Magnitude + unit of elapsed time since `isoDate`, with no "ago" suffix.
export function formatDurationSince(isoDate: string): string {
  return formatDayCount(daysSince(isoDate));
}

export function formatTimeAgo(isoDate: string): string {
  return `${formatDurationSince(isoDate)} ago`;
}
