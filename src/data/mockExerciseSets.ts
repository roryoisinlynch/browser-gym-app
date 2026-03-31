import type { ExerciseSet } from "../domain/models";
import { mockExerciseInstances } from "./mockExerciseInstances";

const squat = mockExerciseInstances.find(
  (instance) => instance.id === "exercise-instance-w3-legs2-squat"
)!;

const crunch = mockExerciseInstances.find(
  (instance) => instance.id === "exercise-instance-w3-legs2-crunch"
)!;

const bosu = mockExerciseInstances.find(
  (instance) => instance.id === "exercise-instance-w3-legs2-bosu"
)!;

export const mockExerciseSets: ExerciseSet[] = [
  {
    id: "set-w3-legs2-squat-1",
    exerciseInstanceId: squat.id,
    setIndex: 1,
    performedWeight: 100,
    performedReps: 8,
    performedRir: 2,
  },
  {
    id: "set-w3-legs2-squat-2",
    exerciseInstanceId: squat.id,
    setIndex: 2,
    performedWeight: 100,
    performedReps: 8,
    performedRir: 2,
  },
  {
    id: "set-w3-legs2-squat-3",
    exerciseInstanceId: squat.id,
    setIndex: 3,
    performedWeight: 100,
    performedReps: 7,
    performedRir: 1,
  },
  {
    id: "set-w3-legs2-crunch-1",
    exerciseInstanceId: crunch.id,
    setIndex: 1,
    performedWeight: 35,
    performedReps: 15,
    performedRir: 2,
  },
  {
    id: "set-w3-legs2-crunch-2",
    exerciseInstanceId: crunch.id,
    setIndex: 2,
    performedWeight: 35,
    performedReps: 14,
    performedRir: 2,
  },
  {
    id: "set-w3-legs2-crunch-3",
    exerciseInstanceId: crunch.id,
    setIndex: 3,
    performedWeight: 35,
    performedReps: 13,
    performedRir: 1,
  },
  {
    id: "set-w3-legs2-bosu-1",
    exerciseInstanceId: bosu.id,
    setIndex: 1,
    performedWeight: null,
    performedReps: 15,
    performedRir: 2,
  },
  {
    id: "set-w3-legs2-bosu-2",
    exerciseInstanceId: bosu.id,
    setIndex: 2,
    performedWeight: null,
    performedReps: 14,
    performedRir: 2,
  },
];