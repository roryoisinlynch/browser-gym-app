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

export const WEIGHT_PRESETS: WeightPreset[] = [
  {
    id: "inc-2.5",
    label: "2.5 kg increments",
    description: "Barbells and plate-loaded machines with 1.25 kg plates.",
    config: { kind: "increment", step: 2.5 },
  },
  {
    id: "inc-2",
    label: "2 kg increments",
    description: "Dumbbells available in 2 kg steps.",
    config: { kind: "increment", step: 2 },
  },
];
