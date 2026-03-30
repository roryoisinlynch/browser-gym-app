import type { ExerciseTemplate } from "../domain/models";
import { mockSessionTemplateMuscleGroups } from "./mockSessionTemplateMuscleGroups";
import { mockMovementTypes } from "./mockMovementTypes";

const sectionById = (id: string) =>
  mockSessionTemplateMuscleGroups.find((section) => section.id === id)!;

const movementTypeById = (id: string) =>
  mockMovementTypes.find((movementType) => movementType.id === id)!;

/**
 * Reusable exercise templates attached to a session-template muscle-group section.
 */
export const mockExerciseTemplates: ExerciseTemplate[] = [
  // Push 1 -> Chest
  {
    id: "barbell-bench-press",
    sessionTemplateMuscleGroupId: sectionById("push1-chest").id,
    movementTypeId: movementTypeById("chest-flat").id,
    exerciseName: "Barbell Bench Press",
    targetReps: 8,
    repMin: 6,
    repMax: 8,
    rirSequence: [4, 4, 4],
    weightMode: "increment",
    weightIncrement: 2.5,
  },
  {
    id: "incline-dumbbell-press",
    sessionTemplateMuscleGroupId: sectionById("push1-chest").id,
    movementTypeId: movementTypeById("chest-incline").id,
    exerciseName: "Incline Dumbbell Press",
    targetReps: 10,
    repMin: 8,
    repMax: 10,
    rirSequence: [4, 4, 4],
    weightMode: "explicit_list",
    availableWeights: [14, 16, 18, 20, 22, 24, 26, 28, 30],
  },
  {
    id: "cable-fly",
    sessionTemplateMuscleGroupId: sectionById("push1-chest").id,
    movementTypeId: movementTypeById("chest-fly").id,
    exerciseName: "Cable Fly",
    targetReps: 12,
    repMin: 10,
    repMax: 15,
    rirSequence: [4, 4, 4],
    weightMode: "increment",
    weightIncrement: 2.5,
  },

  // Push 1 -> Delts
  {
    id: "seated-dumbbell-shoulder-press",
    sessionTemplateMuscleGroupId: sectionById("push1-delts").id,
    movementTypeId: movementTypeById("chest-incline").id,
    exerciseName: "Seated Dumbbell Shoulder Press",
    targetReps: 10,
    repMin: 8,
    repMax: 10,
    rirSequence: [4, 4, 4],
    weightMode: "explicit_list",
    availableWeights: [12, 14, 16, 18, 20, 22, 24],
  },
  {
    id: "dumbbell-lateral-raise",
    sessionTemplateMuscleGroupId: sectionById("push1-delts").id,
    movementTypeId: movementTypeById("chest-fly").id,
    exerciseName: "Dumbbell Lateral Raise",
    targetReps: 15,
    repMin: 12,
    repMax: 20,
    rirSequence: [4, 4, 4],
    weightMode: "explicit_list",
    availableWeights: [4, 5, 6, 7, 8, 9, 10, 12],
  },

  // Push 1 -> Arms
  {
    id: "tricep-pushdown",
    sessionTemplateMuscleGroupId: sectionById("push1-arms").id,
    movementTypeId: movementTypeById("chest-flat").id,
    exerciseName: "Tricep Pushdown",
    targetReps: 12,
    repMin: 10,
    repMax: 15,
    rirSequence: [4, 4, 4],
    weightMode: "increment",
    weightIncrement: 2.5,
  },

  // Pull 1 -> Back
  {
    id: "lat-pulldown",
    sessionTemplateMuscleGroupId: sectionById("pull1-back").id,
    movementTypeId: movementTypeById("back-vertical-pull").id,
    exerciseName: "Lat Pulldown",
    targetReps: 10,
    repMin: 8,
    repMax: 10,
    rirSequence: [4, 4, 4],
    weightMode: "increment",
    weightIncrement: 5,
  },
  {
    id: "chest-supported-row",
    sessionTemplateMuscleGroupId: sectionById("pull1-back").id,
    movementTypeId: movementTypeById("back-horizontal-row").id,
    exerciseName: "Chest Supported Row",
    targetReps: 10,
    repMin: 8,
    repMax: 10,
    rirSequence: [4, 4, 4],
    weightMode: "increment",
    weightIncrement: 5,
  },

  // Pull 1 -> Arms
  {
    id: "incline-dumbbell-curl",
    sessionTemplateMuscleGroupId: sectionById("pull1-arms").id,
    movementTypeId: movementTypeById("back-horizontal-row").id,
    exerciseName: "Incline Dumbbell Curl",
    targetReps: 12,
    repMin: 10,
    repMax: 15,
    rirSequence: [4, 4, 4],
    weightMode: "explicit_list",
    availableWeights: [8, 10, 12, 14, 16, 18],
  },

  // Legs 1 -> Legs
  {
    id: "hack-squat",
    sessionTemplateMuscleGroupId: sectionById("legs1-legs").id,
    movementTypeId: movementTypeById("legs-squat").id,
    exerciseName: "Hack Squat",
    targetReps: 8,
    repMin: 6,
    repMax: 8,
    rirSequence: [4, 4, 4],
    weightMode: "increment",
    weightIncrement: 5,
  },
  {
    id: "romanian-deadlift",
    sessionTemplateMuscleGroupId: sectionById("legs1-legs").id,
    movementTypeId: movementTypeById("legs-hinge").id,
    exerciseName: "Romanian Deadlift",
    targetReps: 10,
    repMin: 8,
    repMax: 10,
    rirSequence: [4, 4, 4],
    weightMode: "increment",
    weightIncrement: 5,
  },
  {
    id: "standing-calf-raise",
    sessionTemplateMuscleGroupId: sectionById("legs1-legs").id,
    movementTypeId: movementTypeById("legs-calf").id,
    exerciseName: "Standing Calf Raise",
    targetReps: 15,
    repMin: 12,
    repMax: 20,
    rirSequence: [4, 4, 4],
    weightMode: "increment",
    weightIncrement: 5,
  },
];