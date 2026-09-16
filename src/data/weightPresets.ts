import { weightsFromIncrement } from "../services/weightOptions";

/**
 * A ready-made list of available weights the exercise form can fill from.
 * step is the increment the list was generated with, when it has one; it
 * pre-populates the form's Step field so the list is easy to extend.
 */
export interface WeightPreset {
  id: string;
  label: string;
  weights: number[];
  step?: number;
}

// Two real machine stacks with uneven increments. Also used by the seed data.
export const CABLE_STACK_WEIGHTS = [2.5, 5, 7.5, 10, 12.5, 15, 17.5, 21.25, 25, 28.75, 32.5, 36.25, 40, 43.75, 47.5];
export const MACHINE_STACK_WEIGHTS = [5, 7.5, 10, 12, 14.5, 17, 19, 21.5, 24, 26, 28.5, 31, 33, 35.5, 38, 40, 42.5, 45, 47, 49.5, 52, 54, 56.5, 59, 61, 63.5, 66, 68, 70.5, 73, 75, 77.5, 80, 82, 84.5, 87];

export const WEIGHT_PRESETS: WeightPreset[] = [
  { id: "barbell-2.5", label: "Barbell, 20 to 200 kg in 2.5 kg steps", weights: weightsFromIncrement(2.5, 20, 200), step: 2.5 },
  { id: "dumbbell-2", label: "Dumbbells, 2 to 50 kg in 2 kg steps", weights: weightsFromIncrement(2, 2, 50), step: 2 },
  { id: "dumbbell-2.5", label: "Dumbbells, 2.5 to 50 kg in 2.5 kg steps", weights: weightsFromIncrement(2.5, 2.5, 50), step: 2.5 },
  { id: "kettlebell-4", label: "Kettlebells, 4 to 48 kg in 4 kg steps", weights: weightsFromIncrement(4, 4, 48), step: 4 },
  { id: "cable-stack", label: "Cable stack, 2.5 to 47.5 kg", weights: CABLE_STACK_WEIGHTS },
  { id: "machine-stack", label: "Machine stack, 5 to 87 kg", weights: MACHINE_STACK_WEIGHTS },
];
