import type { ExerciseSet } from "../domain/models";
import { mockExerciseInstances } from "./mockExerciseInstances";

const hackSquat = mockExerciseInstances.find(
  (e) => e.id === "exercise-instance-hack-squat"
)!;

const rdl = mockExerciseInstances.find(
  (e) => e.id === "exercise-instance-rdl"
)!;

const calfRaise = mockExerciseInstances.find(
  (e) => e.id === "exercise-instance-calf-raise"
)!;

export const mockExerciseSets: ExerciseSet[] = [
  {
    id: "set-hack-1",
    exerciseInstanceId: hackSquat.id,
    setIndex: 1,
    performedWeight: 120,
    performedReps: 8,
    performedRir: 2,
  },
  {
    id: "set-hack-2",
    exerciseInstanceId: hackSquat.id,
    setIndex: 2,
    performedWeight: 120,
    performedReps: 8,
    performedRir: 2,
  },
  {
    id: "set-hack-3",
    exerciseInstanceId: hackSquat.id,
    setIndex: 3,
    performedWeight: 120,
    performedReps: 7,
    performedRir: 1,
  },
  {
    id: "set-rdl-1",
    exerciseInstanceId: rdl.id,
    setIndex: 1,
    performedWeight: 100,
    performedReps: 10,
    performedRir: 2,
  },
  {
    id: "set-rdl-2",
    exerciseInstanceId: rdl.id,
    setIndex: 2,
    performedWeight: 100,
    performedReps: 9,
    performedRir: 2,
  },
  {
    id: "set-rdl-3",
    exerciseInstanceId: rdl.id,
    setIndex: 3,
    performedWeight: 100,
    performedReps: 8,
    performedRir: 1,
  },
  {
    id: "set-calf-1",
    exerciseInstanceId: calfRaise.id,
    setIndex: 1,
    performedWeight: 60,
    performedReps: 15,
    performedRir: 2,
  },
  {
    id: "set-calf-2",
    exerciseInstanceId: calfRaise.id,
    setIndex: 2,
    performedWeight: 60,
    performedReps: 14,
    performedRir: 2,
  },
  {
    id: "set-calf-3",
    exerciseInstanceId: calfRaise.id,
    setIndex: 3,
    performedWeight: 60,
    performedReps: 13,
    performedRir: 1,
  },
];