import type { MovementType } from "../domain/models";

export const mockMovementTypes: MovementType[] = [
  // Chest
  { id: "chest-flat-press", muscleGroupId: "chest", name: "Flat Press", order: 1 },
  { id: "chest-incline-press", muscleGroupId: "chest", name: "Incline Press", order: 2 },
  { id: "chest-dip", muscleGroupId: "chest", name: "Dip", order: 3 },
  { id: "chest-fly", muscleGroupId: "chest", name: "Chest Fly", order: 4 },

  // Back
  { id: "back-vertical-pull", muscleGroupId: "back", name: "Vertical Pull", order: 1 },
  { id: "back-horizontal-row", muscleGroupId: "back", name: "Horizontal Row", order: 2 },
  { id: "back-rear-delts", muscleGroupId: "back", name: "Rear Delts", order: 3 },

  // Shoulder
  { id: "shoulder-vertical-press", muscleGroupId: "shoulder", name: "Vertical Press", order: 1 },
  { id: "shoulder-side-delts", muscleGroupId: "shoulder", name: "Side Delts", order: 2 },

  // Arms
  { id: "arms-bicep", muscleGroupId: "arms", name: "Bicep", order: 1 },
  { id: "arms-tricep", muscleGroupId: "arms", name: "Tricep", order: 2 },

  // Forearms
  { id: "forearms-curl", muscleGroupId: "forearms", name: "Forearm Curl", order: 1 },
  { id: "forearms-extension", muscleGroupId: "forearms", name: "Forearm Extension", order: 2 },
  { id: "forearms-grip", muscleGroupId: "forearms", name: "Grip Strength", order: 3 },

  // Quads
  { id: "quads-squat", muscleGroupId: "quads", name: "Squat", order: 1 },

  // Hamstring
  { id: "hamstring-curl", muscleGroupId: "hamstring", name: "Hamstring", order: 1 },

  // Core
  { id: "core-leg-raise", muscleGroupId: "core", name: "Leg Raise", order: 1 },
  { id: "core-crunch", muscleGroupId: "core", name: "Crunch", order: 2 },
];
