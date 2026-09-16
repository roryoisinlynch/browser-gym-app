import type { ExerciseTemplate } from "../domain/models";
import { normaliseWeightList, round3 } from "./weightOptions";

/**
 * The exercise form's view of how an exercise is loaded. Maps one-to-one onto
 * the stored weightMode / weightIncrement / availableWeights fields (see
 * weightConfigFromTemplate and weightFieldsFromConfig), so loading a record and
 * saving it untouched reproduces the same fields.
 *
 * - bodyweight: rep-only.
 * - increment: even increments with no upper bound (stored as "increment").
 * - list: a fixed list of weights (stored as "explicit_list"). step is the
 *   constant spacing of the list when it has one, informational only.
 */
export type WeightConfig =
  | { kind: "bodyweight" }
  | { kind: "increment"; step: number }
  | { kind: "list"; weights: number[]; step?: number };

export type WeightFields = Pick<
  ExerciseTemplate,
  "weightMode" | "weightIncrement" | "availableWeights"
>;

export const DEFAULT_STEP = 2.5;

/** A weighted exercise with nothing configured yet. */
export const EMPTY_LIST_CONFIG: WeightConfig = { kind: "list", weights: [] };

export function weightConfigFromTemplate(t: WeightFields): WeightConfig {
  if (t.weightMode === "bodyweight") return { kind: "bodyweight" };
  if (t.weightMode === "explicit_list") {
    const weights = [...(t.availableWeights ?? [])];
    return t.weightIncrement != null
      ? { kind: "list", weights, step: t.weightIncrement }
      : { kind: "list", weights };
  }
  return { kind: "increment", step: t.weightIncrement ?? DEFAULT_STEP };
}

export function weightFieldsFromConfig(c: WeightConfig): WeightFields {
  switch (c.kind) {
    case "bodyweight":
      return { weightMode: "bodyweight" };
    case "increment":
      return { weightMode: "increment", weightIncrement: c.step };
    case "list":
      return {
        weightMode: "explicit_list",
        availableWeights: normaliseWeightList(c.weights),
        ...(c.step != null ? { weightIncrement: c.step } : {}),
      };
  }
}

/** True when the engine can produce candidates: an increment, or a non-empty list. */
export function isWeightConfigured(c: WeightConfig): boolean {
  return c.kind === "increment" || (c.kind === "list" && c.weights.length > 0);
}

/**
 * The constant spacing of a list, or null when it has fewer than two entries
 * or its gaps differ. Differences are compared at 3 dp.
 */
export function detectConstantStep(weights: readonly number[]): number | null {
  const sorted = normaliseWeightList(weights);
  if (sorted.length < 2) return null;
  const step = round3(sorted[1] - sorted[0]);
  if (!(step > 0)) return null;
  for (let i = 2; i < sorted.length; i++) {
    if (round3(sorted[i] - sorted[i - 1]) !== step) return null;
  }
  return step;
}

/**
 * One-line summary for the Available weights card. Null when nothing is
 * configured (bodyweight, or an empty list).
 */
export function describeWeightConfig(c: WeightConfig): string | null {
  if (c.kind === "bodyweight") return null;
  if (c.kind === "increment") return `${c.step} kg increments`;
  const weights = normaliseWeightList(c.weights);
  if (weights.length === 0) return null;
  const step = weights.length >= 3 ? detectConstantStep(weights) : null;
  if (step != null) {
    return `${step} kg increments, ${weights[0]} to ${weights[weights.length - 1]} kg`;
  }
  if (weights.length <= 6) return `Choices from ${weights.join(", ")}`;
  return `Choices from ${weights.slice(0, 3).join(", ")} … ${weights.slice(-2).join(", ")}`;
}

/** True when two configs would be stored as the same fields. */
export function sameWeightFields(a: WeightConfig, b: WeightConfig): boolean {
  return JSON.stringify(weightFieldsFromConfig(a)) === JSON.stringify(weightFieldsFromConfig(b));
}
