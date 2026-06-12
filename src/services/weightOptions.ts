import type { WeightMode } from "../domain/models";

export interface WeightOption {
  weight: number;
  zeroRirReps: number;   // floor((e1RM / weight - 1) * 30) — the 0 RIR rep count
  repRange: number[];    // one rep count per week, sorted RIR high→low (fewest first)
}

// Only offer options whose per-week reps land within these absolute bounds.
const MIN_REPS = 1;
const MAX_REPS = 30;

// The band the auto-selector optimises toward when silently picking a weight.
const TARGET_MIN_REPS = 6;
const TARGET_MAX_REPS = 12;

/**
 * Generates the selectable working-weight options for a non-bodyweight
 * exercise: every candidate weight (derived from the increment, or the
 * explicit list) whose per-week rep targets across the RIR scheme stay within
 * [MIN_REPS, MAX_REPS]. Returned heaviest-first. Empty for bodyweight, no
 * e1RM, an empty scheme, or (fixed-list) no available weights.
 */
export function computeWeightOptions(params: {
  effectiveE1RM: number | null;
  weightMode: WeightMode;
  weightIncrement: number;
  availableWeights: number[];
  rirScheme: number[];
}): WeightOption[] {
  const { effectiveE1RM, weightMode, weightIncrement, availableWeights, rirScheme } = params;
  if (!effectiveE1RM || rirScheme.length === 0) return [];
  if (weightMode === "bodyweight") return [];

  const inc = weightIncrement || 2.5;
  const sortedRir = [...rirScheme].sort((a, b) => b - a); // high RIR first → fewest reps first

  let candidates: number[];
  if (weightMode === "explicit_list") {
    candidates = [...availableWeights].sort((a, b) => a - b);
  } else {
    candidates = [];
    for (let w = inc; w < effectiveE1RM; w = Math.round((w + inc) * 1000) / 1000) {
      candidates.push(w);
    }
  }

  const options: WeightOption[] = [];
  for (const weight of candidates) {
    const zeroRirReps = Math.floor((effectiveE1RM / weight - 1) * 30);
    if (zeroRirReps < 1) continue;

    const repRange = sortedRir.map((rir) => zeroRirReps - rir);
    const minRep = Math.min(...repRange);
    const maxRep = Math.max(...repRange);

    if (minRep < 1) continue;
    if (maxRep < MIN_REPS || minRep > MAX_REPS) continue;

    options.push({ weight, zeroRirReps, repRange });
  }

  return options.reverse();
}

// Sum of each weekly rep target's distance outside the 6–12 band (0 if inside).
// Lower is better — the closer every week sits to the band, the smaller the score.
function repRangeScore(repRange: number[]): number {
  return repRange.reduce((sum, rep) => {
    if (rep < TARGET_MIN_REPS) return sum + (TARGET_MIN_REPS - rep);
    if (rep > TARGET_MAX_REPS) return sum + (rep - TARGET_MAX_REPS);
    return sum;
  }, 0);
}

/**
 * Picks the option whose per-week rep targets sit closest to the 6–12 range.
 * Ties break toward the heavier weight (a small progression bias). Returns null
 * for an empty option list.
 */
export function pickBestWeightOption(options: WeightOption[]): WeightOption | null {
  let best: WeightOption | null = null;
  let bestScore = Infinity;
  for (const opt of options) {
    const score = repRangeScore(opt.repRange);
    if (score < bestScore || (score === bestScore && best != null && opt.weight > best.weight)) {
      best = opt;
      bestScore = score;
    }
  }
  return best;
}
