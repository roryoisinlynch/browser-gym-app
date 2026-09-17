import type { WeightConfig } from "../services/weightConfig";

/**
 * A ready-made configuration the Available weights wizard offers on its first
 * screen. Hard-coded equipment, not user data.
 */
export interface WeightPreset {
  id: string;
  label: string;
  description?: string;
  config: WeightConfig;
}

// Two real machine stacks with uneven increments.
export const CABLE_STACK_WEIGHTS = [2.5, 5, 7.5, 10, 12.5, 15, 17.5, 21.25, 25, 28.75, 32.5, 36.25, 40, 43.75, 47.5];
export const MACHINE_STACK_WEIGHTS = [5, 7.5, 10, 12, 14.5, 17, 19, 21.5, 24, 26, 28.5, 31, 33, 35.5, 38, 40, 42.5, 45, 47, 49.5, 52, 54, 56.5, 59, 61, 63.5, 66, 68, 70.5, 73, 75, 77.5, 80, 82, 84.5, 87];

export const WEIGHT_PRESETS: WeightPreset[] = [
  {
    id: "inc-2.5",
    label: "2.5 kg increments",
    description: "Barbells and plate-loaded machines with 1.25 kg plates.",
    config: { kind: "increment", step: 2.5 },
  },
  {
    id: "inc-5",
    label: "5 kg increments",
    description: "Plate-loaded machines with 2.5 kg plates.",
    config: { kind: "increment", step: 5 },
  },
  {
    id: "machine-stack",
    label: "Machine stack, 5 to 87 kg",
    description: "Alternating 2.5 kg and 2 kg steps.",
    config: { kind: "list", weights: MACHINE_STACK_WEIGHTS },
  },
  {
    id: "cable-stack",
    label: "Cable stack, 2.5 to 47.5 kg",
    description: "2.5 kg steps to 17.5 kg, then 3.75 kg steps.",
    config: { kind: "list", weights: CABLE_STACK_WEIGHTS },
  },
];
