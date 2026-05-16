// Heuristic answers are on a 1–5 scale. Both the summary bar's background
// gradient and the per-row score label colour reference these stops, so the
// label and the bar position stay visually anchored to each other.
const STOPS: ReadonlyArray<{ at: number; rgb: readonly [number, number, number] }> = [
  { at: 1, rgb: [231, 111, 81] },   // #e76f51
  { at: 2, rgb: [244, 162, 97] },   // #f4a261
  { at: 3, rgb: [244, 211, 94] },   // #f4d35e
  { at: 4, rgb: [168, 208, 101] },  // #a8d065
  { at: 5, rgb: [107, 203, 119] },  // #6bcb77
];

export function colorForHeuristicScore(score: number): string {
  const s = Math.max(1, Math.min(5, score));
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i];
    const b = STOPS[i + 1];
    if (s >= a.at && s <= b.at) {
      const t = (s - a.at) / (b.at - a.at);
      const r = Math.round(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * t);
      const g = Math.round(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * t);
      const bch = Math.round(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * t);
      return `rgb(${r}, ${g}, ${bch})`;
    }
  }
  const last = STOPS[STOPS.length - 1].rgb;
  return `rgb(${last[0]}, ${last[1]}, ${last[2]})`;
}

/**
 * Linear-interpolation percentile (also known as the C=1 / "type 7" method,
 * matching Excel's PERCENTILE and numpy's default).
 *
 * Returns `null` when there are fewer than two values, because a one-sample
 * IQR is just the sample itself and would collapse the highlighted band to
 * a zero-width slit on the bar.
 */
export function percentileOrNull(
  sortedValues: ReadonlyArray<number>,
  p: number
): number | null {
  const n = sortedValues.length;
  if (n < 2) return null;
  const idx = p * (n - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedValues[lo];
  return sortedValues[lo] + (sortedValues[hi] - sortedValues[lo]) * (idx - lo);
}
