import type { MovementType } from "../domain/models";

/**
 * Global movement-type definitions.
 *
 * Movement types belong to a muscle group and are reused across exercises
 * so that stats and prioritisation logic can aggregate reliably.
 */
export const mockMovementTypes: MovementType[] = [
  // Chest
  {
    id: "chest-flat",
    muscleGroupId: "chest",
    name: "Flat",
    order: 1,
  },
  {
    id: "chest-incline",
    muscleGroupId: "chest",
    name: "Incline",
    order: 2,
  },
  {
    id: "chest-fly",
    muscleGroupId: "chest",
    name: "Fly",
    order: 3,
  },

  // Back
  {
    id: "back-vertical-pull",
    muscleGroupId: "back",
    name: "Vertical Pull",
    order: 1,
  },
  {
    id: "back-horizontal-row",
    muscleGroupId: "back",
    name: "Horizontal Row",
    order: 2,
  },

  // Legs
  {
    id: "legs-squat",
    muscleGroupId: "legs",
    name: "Squat",
    order: 1,
  },
  {
    id: "legs-hinge",
    muscleGroupId: "legs",
    name: "Hinge",
    order: 2,
  },
  {
    id: "legs-calf",
    muscleGroupId: "legs",
    name: "Calf",
    order: 3,
  },
];