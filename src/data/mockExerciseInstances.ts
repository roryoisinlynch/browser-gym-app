import type { ExerciseInstance } from "../domain/models";
import { mockSessionInstances } from "./mockSessionInstances";
import { mockExerciseTemplates } from "./mockExerciseTemplates";

const legsSessionInstance = mockSessionInstances.find(
  (session) => session.id === "session-instance-legs-1"
)!;

const hackSquat = mockExerciseTemplates.find(
  (exercise) => exercise.id === "hack-squat"
)!;
const romanianDeadlift = mockExerciseTemplates.find(
  (exercise) => exercise.id === "romanian-deadlift"
)!;
const standingCalfRaise = mockExerciseTemplates.find(
  (exercise) => exercise.id === "standing-calf-raise"
)!;

export const mockExerciseInstances: ExerciseInstance[] = [
  {
    id: "exercise-instance-hack-squat",
    sessionInstanceId: legsSessionInstance.id,
    exerciseTemplateId: hackSquat.id,
    status: "completed",
    startedAt: "2026-02-12T18:18:00.000Z",
    completedAt: "2026-02-12T18:36:00.000Z",
    prescribedWeight: 120,
    prescribedRepTarget: 8,
    prescribedRir: 2,
  },
  {
    id: "exercise-instance-rdl",
    sessionInstanceId: legsSessionInstance.id,
    exerciseTemplateId: romanianDeadlift.id,
    status: "completed",
    startedAt: "2026-02-12T18:40:00.000Z",
    completedAt: "2026-02-12T18:56:00.000Z",
    prescribedWeight: 100,
    prescribedRepTarget: 10,
    prescribedRir: 2,
  },
  {
    id: "exercise-instance-calf-raise",
    sessionInstanceId: legsSessionInstance.id,
    exerciseTemplateId: standingCalfRaise.id,
    status: "in_progress",
    startedAt: "2026-02-12T18:58:00.000Z",
    completedAt: null,
    prescribedWeight: 60,
    prescribedRepTarget: 15,
    prescribedRir: 2,
  },
];