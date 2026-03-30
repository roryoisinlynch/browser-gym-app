import type { MuscleGroup } from "../domain/models";

/**
 * Global muscle-group definitions used across all session templates.
 * Order is only for default display ordering in configuration UIs.
 */
export const mockMuscleGroups: MuscleGroup[] = [
  {
    id: "chest",
    name: "Chest",
    order: 1,
  },
  {
    id: "back",
    name: "Back",
    order: 2,
  },
  {
    id: "legs",
    name: "Legs",
    order: 3,
  },
  {
    id: "delts",
    name: "Delts",
    order: 4,
  },
  {
    id: "arms",
    name: "Arms",
    order: 5,
  },
];