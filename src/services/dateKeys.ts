// Local calendar-date keys ("YYYY-MM-DD") and DST-proof day arithmetic,
// shared by the Year in Review and absence tracking.

/** Local calendar date "YYYY-MM-DD" for an ISO datetime, same rule as sessionCompletedDate. */
export function localDateOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** UTC day count for a local "YYYY-MM-DD" date, so DST shifts can't skew gaps. */
export function utcDayNumber(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/** "YYYY-MM-DD" for a UTC day number (inverse of utcDayNumber). */
export function isoFromDayNumber(dayNumber: number): string {
  const d = new Date(dayNumber * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** True for a well-formed "YYYY-MM-DD" key. */
export function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
