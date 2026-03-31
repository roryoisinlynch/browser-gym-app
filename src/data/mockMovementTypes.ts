import type { MovementType } from "../domain/models";

export const mockMovementTypes: MovementType[] = [
  { id: "chest-flat", muscleGroupId: "chest", name: "Flat", order: 1 },
  { id: "chest-incline", muscleGroupId: "chest", name: "Incline", order: 2 },
  { id: "chest-fly", muscleGroupId: "chest", name: "Fly", order: 3 },

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

  { id: "delts-press", muscleGroupId: "delts", name: "Press", order: 1 },
  { id: "delts-lateral", muscleGroupId: "delts", name: "Lateral", order: 2 },
  { id: "delts-rear", muscleGroupId: "delts", name: "Rear", order: 3 },

  { id: "arms-bicep", muscleGroupId: "arms", name: "Bicep", order: 1 },
  { id: "arms-tricep", muscleGroupId: "arms", name: "Tricep", order: 2 },

  { id: "legs-squat", muscleGroupId: "legs", name: "Squat", order: 1 },
  { id: "legs-hamstring", muscleGroupId: "legs", name: "Hamstring", order: 2 },

  { id: "core-flexion", muscleGroupId: "core", name: "Flexion", order: 1 },
  { id: "core-leg-raise", muscleGroupId: "core", name: "Leg Raise", order: 2 },

  {
    id: "forearms-flexion",
    muscleGroupId: "forearms",
    name: "Flexion",
    order: 1,
  },
  {
    id: "forearms-extension",
    muscleGroupId: "forearms",
    name: "Extension",
    order: 2,
  },

  { id: "grip-crush", muscleGroupId: "grip", name: "Crush", order: 1 },
];