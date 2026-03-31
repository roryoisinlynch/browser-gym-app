import type { ExerciseInstance } from "../domain/models";
import { mockSessionInstances } from "./mockSessionInstances";
import { mockExerciseTemplates } from "./mockExerciseTemplates";

const currentSession = mockSessionInstances.find(
  (session) => session.id === "session-instance-w3-legs-2"
)!;

const squat = mockExerciseTemplates.find((exercise) => exercise.id === "squat-2")!;
const crunch = mockExerciseTemplates.find(
  (exercise) => exercise.id === "crunch-machine-2"
)!;
const bosu = mockExerciseTemplates.find(
  (exercise) => exercise.id === "bosu-leg-raise-2"
)!;

export const mockExerciseInstances: ExerciseInstance[] = [
  {
    id: "exercise-instance-w3-legs2-squat",
    sessionInstanceId: currentSession.id,
    exerciseTemplateId: squat.id,
    status: "completed",
    startedAt: "2026-02-18T18:18:00.000Z",
    completedAt: "2026-02-18T18:36:00.000Z",
    prescribedWeight: 100,
    prescribedRepTarget: 8,
    prescribedRir: 2,
  },
  {
    id: "exercise-instance-w3-legs2-crunch",
    sessionInstanceId: currentSession.id,
    exerciseTemplateId: crunch.id,
    status: "completed",
    startedAt: "2026-02-18T18:40:00.000Z",
    completedAt: "2026-02-18T18:50:00.000Z",
    prescribedWeight: 35,
    prescribedRepTarget: 15,
    prescribedRir: 2,
  },
  {
    id: "exercise-instance-w3-legs2-bosu",
    sessionInstanceId: currentSession.id,
    exerciseTemplateId: bosu.id,
    status: "in_progress",
    startedAt: "2026-02-18T18:54:00.000Z",
    completedAt: null,
    prescribedWeight: null,
    prescribedRepTarget: 15,
    prescribedRir: 2,
  },
];