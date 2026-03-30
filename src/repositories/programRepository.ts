import type {
  ExerciseInstance,
  ExerciseSet,
  ExerciseTemplate,
  SeasonInstance,
  SessionInstance,
  SessionTemplate,
  SessionTemplateMuscleGroup,
  WeekInstance,
  WeekTemplate,
  MuscleGroup,
  MovementType,
} from "../domain/models";

import { mockWeekTemplates } from "../data/mockWeekTemplates";
import { mockSessionTemplates } from "../data/mockSessionTemplates";
import { mockSessionTemplateMuscleGroups } from "../data/mockSessionTemplateMuscleGroups";
import { mockExerciseTemplates } from "../data/mockExerciseTemplates";
import { mockMuscleGroups } from "../data/mockMuscleGroups";
import { mockMovementTypes } from "../data/mockMovementTypes";
import { mockSeasonInstances } from "../data/mockSeasonInstances";
import { mockWeekInstances } from "../data/mockWeekInstances";
import { mockSessionInstances } from "../data/mockSessionInstances";
import { mockExerciseInstances } from "../data/mockExerciseInstances";
import { mockExerciseSets } from "../data/mockExerciseSets";
import {
  analyzeSet,
  calculateEstimatedOneRepMax,
} from "../services/setAnalysis";

export interface SessionTemplateListItem {
  sessionTemplate: SessionTemplate;
  weekTemplate: WeekTemplate;
}

export interface SessionTemplateMuscleGroupWithMeta {
  sessionTemplateMuscleGroup: SessionTemplateMuscleGroup;
  muscleGroup: MuscleGroup;
}

export interface ExerciseTemplateWithMeta {
  exerciseTemplate: ExerciseTemplate;
  movementType: MovementType;
}

export interface SessionTemplateGroupWithExercises {
  sessionTemplateMuscleGroup: SessionTemplateMuscleGroup;
  muscleGroup: MuscleGroup;
  exercises: Array<{
    exerciseTemplate: ExerciseTemplate;
    movementType: MovementType;
  }>;
}

export interface AnalyzedExerciseSet {
  set: ExerciseSet;
  analysis: {
    estimatedOneRepMax: number | null;
    priorBestEstimatedOneRepMax: number | null;
    intensity: number | null;
    setType: "warmup" | "working";
  };
}

export interface SessionInstanceExerciseView {
  exerciseTemplate: ExerciseTemplate;
  movementType: MovementType;
  exerciseInstance: ExerciseInstance | null;
  sets: AnalyzedExerciseSet[];
  workingSetCount: number;
  warmupSetCount: number;
}

export interface SessionInstanceMuscleGroupView {
  sessionTemplateMuscleGroup: SessionTemplateMuscleGroup;
  muscleGroup: MuscleGroup;
  exercises: SessionInstanceExerciseView[];
}

export interface SessionInstanceView {
  seasonInstance: SeasonInstance;
  weekInstance: WeekInstance;
  weekTemplate: WeekTemplate;
  sessionInstance: SessionInstance;
  sessionTemplate: SessionTemplate;
  muscleGroups: SessionInstanceMuscleGroupView[];
}

export interface ExerciseInstanceView {
  seasonInstance: SeasonInstance;
  weekInstance: WeekInstance;
  weekTemplate: WeekTemplate;
  sessionInstance: SessionInstance;
  sessionTemplate: SessionTemplate;
  exerciseInstance: ExerciseInstance;
  exerciseTemplate: ExerciseTemplate;
  movementType: MovementType;
  historicalBestEstimatedOneRepMax: number | null;
  targetEstimatedOneRepMax: number | null;
  sets: AnalyzedExerciseSet[];
}

export async function getWeekTemplates(): Promise<WeekTemplate[]> {
  return [...mockWeekTemplates].sort((a, b) => a.order - b.order);
}

export async function getWeekTemplateById(
  weekTemplateId: string
): Promise<WeekTemplate | undefined> {
  return mockWeekTemplates.find((week) => week.id === weekTemplateId);
}

export async function getSessionTemplatesForWeek(
  weekTemplateId: string
): Promise<SessionTemplate[]> {
  return mockSessionTemplates
    .filter((session) => session.weekTemplateId === weekTemplateId)
    .sort((a, b) => a.order - b.order);
}

export async function getSessionTemplateById(
  sessionTemplateId: string
): Promise<SessionTemplate | undefined> {
  return mockSessionTemplates.find(
    (session) => session.id === sessionTemplateId
  );
}

export async function getExerciseTemplateById(
  exerciseTemplateId: string
): Promise<ExerciseTemplate | undefined> {
  return mockExerciseTemplates.find(
    (exercise) => exercise.id === exerciseTemplateId
  );
}

export async function getMovementTypeById(
  movementTypeId: string
): Promise<MovementType | undefined> {
  return mockMovementTypes.find((movement) => movement.id === movementTypeId);
}

export async function getSessionTemplateListItemsForWeek(
  weekTemplateId: string
): Promise<SessionTemplateListItem[]> {
  const weekTemplate = await getWeekTemplateById(weekTemplateId);

  if (!weekTemplate) {
    return [];
  }

  const sessionTemplates = await getSessionTemplatesForWeek(weekTemplateId);

  return sessionTemplates.map((sessionTemplate) => ({
    sessionTemplate,
    weekTemplate,
  }));
}

export async function getSessionTemplateMuscleGroups(
  sessionTemplateId: string
): Promise<SessionTemplateMuscleGroupWithMeta[]> {
  const sections = mockSessionTemplateMuscleGroups
    .filter((section) => section.sessionTemplateId === sessionTemplateId)
    .sort((a, b) => a.order - b.order);

  return sections
    .map((section) => {
      const muscleGroup = mockMuscleGroups.find(
        (group) => group.id === section.muscleGroupId
      );

      if (!muscleGroup) {
        return undefined;
      }

      return {
        sessionTemplateMuscleGroup: section,
        muscleGroup,
      };
    })
    .filter(
      (
        value
      ): value is SessionTemplateMuscleGroupWithMeta => value !== undefined
    );
}

export async function getExerciseTemplatesForSessionTemplate(
  sessionTemplateId: string
): Promise<ExerciseTemplateWithMeta[]> {
  const sections = mockSessionTemplateMuscleGroups.filter(
    (section) => section.sessionTemplateId === sessionTemplateId
  );

  const sectionIds = new Set(sections.map((section) => section.id));

  const exercises = mockExerciseTemplates.filter((exercise) =>
    sectionIds.has(exercise.sessionTemplateMuscleGroupId)
  );

  return exercises
    .map((exerciseTemplate) => {
      const movementType = mockMovementTypes.find(
        (movement) => movement.id === exerciseTemplate.movementTypeId
      );

      if (!movementType) {
        return undefined;
      }

      return {
        exerciseTemplate,
        movementType,
      };
    })
    .filter(
      (value): value is ExerciseTemplateWithMeta => value !== undefined
    );
}

export async function getSessionTemplateGroupsWithExercises(
  sessionTemplateId: string
): Promise<SessionTemplateGroupWithExercises[]> {
  const sections = await getSessionTemplateMuscleGroups(sessionTemplateId);
  const exercises = await getExerciseTemplatesForSessionTemplate(sessionTemplateId);

  return sections.map(({ sessionTemplateMuscleGroup, muscleGroup }) => ({
    sessionTemplateMuscleGroup,
    muscleGroup,
    exercises: exercises.filter(
      ({ exerciseTemplate }) =>
        exerciseTemplate.sessionTemplateMuscleGroupId ===
        sessionTemplateMuscleGroup.id
    ),
  }));
}

export async function getSeasonInstanceById(
  seasonInstanceId: string
): Promise<SeasonInstance | undefined> {
  return mockSeasonInstances.find(
    (seasonInstance) => seasonInstance.id === seasonInstanceId
  );
}

export async function getWeekInstanceById(
  weekInstanceId: string
): Promise<WeekInstance | undefined> {
  return mockWeekInstances.find(
    (weekInstance) => weekInstance.id === weekInstanceId
  );
}

export async function getSessionInstanceById(
  sessionInstanceId: string
): Promise<SessionInstance | undefined> {
  return mockSessionInstances.find(
    (sessionInstance) => sessionInstance.id === sessionInstanceId
  );
}

export async function getExerciseInstanceById(
  exerciseInstanceId: string
): Promise<ExerciseInstance | undefined> {
  return mockExerciseInstances.find(
    (exerciseInstance) => exerciseInstance.id === exerciseInstanceId
  );
}

export async function getExerciseInstancesForSessionInstance(
  sessionInstanceId: string
): Promise<ExerciseInstance[]> {
  return mockExerciseInstances.filter(
    (exerciseInstance) => exerciseInstance.sessionInstanceId === sessionInstanceId
  );
}

export async function getExerciseSetsForSessionInstance(
  sessionInstanceId: string
): Promise<ExerciseSet[]> {
  const exerciseInstances = await getExerciseInstancesForSessionInstance(
    sessionInstanceId
  );

  const exerciseInstanceIds = new Set(
    exerciseInstances.map((exerciseInstance) => exerciseInstance.id)
  );

  return mockExerciseSets.filter((exerciseSet) =>
    exerciseInstanceIds.has(exerciseSet.exerciseInstanceId)
  );
}

export async function getExerciseSetsForExerciseInstance(
  exerciseInstanceId: string
): Promise<ExerciseSet[]> {
  return mockExerciseSets
    .filter((exerciseSet) => exerciseSet.exerciseInstanceId === exerciseInstanceId)
    .sort((a, b) => a.setIndex - b.setIndex);
}

export async function getExerciseSetsForExerciseTemplate(
  exerciseTemplateId: string
): Promise<ExerciseSet[]> {
  const relevantExerciseInstances = mockExerciseInstances.filter(
    (exerciseInstance) => exerciseInstance.exerciseTemplateId === exerciseTemplateId
  );

  const relevantExerciseInstanceIds = new Set(
    relevantExerciseInstances.map((exerciseInstance) => exerciseInstance.id)
  );

  return mockExerciseSets
    .filter((exerciseSet) =>
      relevantExerciseInstanceIds.has(exerciseSet.exerciseInstanceId)
    )
    .sort((a, b) => a.setIndex - b.setIndex);
}

function buildAnalyzedSetList(
  currentSets: ExerciseSet[],
  allHistoricalSets: ExerciseSet[]
): AnalyzedExerciseSet[] {
  return currentSets.map((set) => {
    const priorSets = allHistoricalSets.filter((candidate) => {
      if (candidate.exerciseInstanceId !== set.exerciseInstanceId) {
        return true;
      }

      return candidate.setIndex < set.setIndex;
    });

    return {
      set,
      analysis: analyzeSet(set, priorSets),
    };
  });
}

export async function getExerciseInstanceView(
  exerciseInstanceId: string
): Promise<ExerciseInstanceView | undefined> {
  const exerciseInstance = await getExerciseInstanceById(exerciseInstanceId);
  if (!exerciseInstance) {
    return undefined;
  }

  const sessionInstance = await getSessionInstanceById(exerciseInstance.sessionInstanceId);
  if (!sessionInstance) {
    return undefined;
  }

  const weekInstance = await getWeekInstanceById(sessionInstance.weekInstanceId);
  if (!weekInstance) {
    return undefined;
  }

  const weekTemplate = await getWeekTemplateById(weekInstance.weekTemplateId);
  if (!weekTemplate) {
    return undefined;
  }

  const seasonInstance = await getSeasonInstanceById(sessionInstance.seasonInstanceId);
  if (!seasonInstance) {
    return undefined;
  }

  const sessionTemplate = await getSessionTemplateById(sessionInstance.sessionTemplateId);
  if (!sessionTemplate) {
    return undefined;
  }

  const exerciseTemplate = await getExerciseTemplateById(
    exerciseInstance.exerciseTemplateId
  );
  if (!exerciseTemplate) {
    return undefined;
  }

  const movementType = await getMovementTypeById(exerciseTemplate.movementTypeId);
  if (!movementType) {
    return undefined;
  }

  const allHistoricalSets = await getExerciseSetsForExerciseTemplate(
    exerciseTemplate.id
  );

  const currentSets = allHistoricalSets.filter(
    (set) => set.exerciseInstanceId === exerciseInstance.id
  );

  const priorHistoricalSets = allHistoricalSets.filter(
    (set) => set.exerciseInstanceId !== exerciseInstance.id
  );

  const historicalBestEstimatedOneRepMax = priorHistoricalSets.reduce<number | null>(
    (best, set) => {
      const estimatedOneRepMax = calculateEstimatedOneRepMax(
        set.performedWeight,
        set.performedReps
      );

      if (estimatedOneRepMax == null) {
        return best;
      }

      if (best == null || estimatedOneRepMax > best) {
        return estimatedOneRepMax;
      }

      return best;
    },
    null
  );

  const targetEstimatedOneRepMax = calculateEstimatedOneRepMax(
    exerciseInstance.prescribedWeight,
    exerciseInstance.prescribedRepTarget
  );

  return {
    seasonInstance,
    weekInstance,
    weekTemplate,
    sessionInstance,
    sessionTemplate,
    exerciseInstance,
    exerciseTemplate,
    movementType,
    historicalBestEstimatedOneRepMax,
    targetEstimatedOneRepMax,
    sets: buildAnalyzedSetList(currentSets, allHistoricalSets),
  };
}

export async function getSessionInstanceView(
  sessionInstanceId: string
): Promise<SessionInstanceView | undefined> {
  const sessionInstance = await getSessionInstanceById(sessionInstanceId);

  if (!sessionInstance) {
    return undefined;
  }

  const weekInstance = await getWeekInstanceById(sessionInstance.weekInstanceId);
  if (!weekInstance) {
    return undefined;
  }

  const weekTemplate = await getWeekTemplateById(weekInstance.weekTemplateId);
  if (!weekTemplate) {
    return undefined;
  }

  const seasonInstance = await getSeasonInstanceById(
    sessionInstance.seasonInstanceId
  );
  if (!seasonInstance) {
    return undefined;
  }

  const sessionTemplate = await getSessionTemplateById(
    sessionInstance.sessionTemplateId
  );
  if (!sessionTemplate) {
    return undefined;
  }

  const templateGroups = await getSessionTemplateGroupsWithExercises(
    sessionTemplate.id
  );

  const exerciseInstances = await getExerciseInstancesForSessionInstance(
    sessionInstance.id
  );

  const muscleGroups: SessionInstanceMuscleGroupView[] = [];

  for (const { sessionTemplateMuscleGroup, muscleGroup, exercises } of templateGroups) {
    const hydratedExercises: SessionInstanceExerciseView[] = [];

    for (const { exerciseTemplate, movementType } of exercises) {
      const exerciseInstance =
        exerciseInstances.find(
          (instance) => instance.exerciseTemplateId === exerciseTemplate.id
        ) ?? null;

      const allHistoricalSets = await getExerciseSetsForExerciseTemplate(
        exerciseTemplate.id
      );

      const currentRawSets = exerciseInstance
        ? allHistoricalSets
            .filter((exerciseSet) => exerciseSet.exerciseInstanceId === exerciseInstance.id)
            .sort((a, b) => a.setIndex - b.setIndex)
        : [];

      const analyzedSets = buildAnalyzedSetList(currentRawSets, allHistoricalSets);

      const workingSetCount = analyzedSets.filter(
        (item) => item.analysis.setType === "working"
      ).length;

      const warmupSetCount = analyzedSets.filter(
        (item) => item.analysis.setType === "warmup"
      ).length;

      hydratedExercises.push({
        exerciseTemplate,
        movementType,
        exerciseInstance,
        sets: analyzedSets,
        workingSetCount,
        warmupSetCount,
      });
    }

    muscleGroups.push({
      sessionTemplateMuscleGroup,
      muscleGroup,
      exercises: hydratedExercises,
    });
  }

  return {
    seasonInstance,
    weekInstance,
    weekTemplate,
    sessionInstance,
    sessionTemplate,
    muscleGroups,
  };
}

export interface SessionInstanceListItem {
  sessionInstance: SessionInstance;
  sessionTemplate: SessionTemplate;
  weekInstance: WeekInstance;
}

export async function getSessionInstancesForWeekInstance(
  weekInstanceId: string
): Promise<SessionInstance[]> {
  return mockSessionInstances
    .filter((sessionInstance) => sessionInstance.weekInstanceId === weekInstanceId)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getCurrentWeekInstance(): Promise<WeekInstance | undefined> {
  return mockWeekInstances.find((weekInstance) => weekInstance.status === "in_progress");
}

export async function getSessionInstanceListItemsForCurrentWeek(): Promise<
  SessionInstanceListItem[]
> {
  const currentWeekInstance = await getCurrentWeekInstance();

  if (!currentWeekInstance) {
    return [];
  }

  const sessionInstances = await getSessionInstancesForWeekInstance(
    currentWeekInstance.id
  );

  return sessionInstances
    .map((sessionInstance) => {
      const sessionTemplate = mockSessionTemplates.find(
        (template) => template.id === sessionInstance.sessionTemplateId
      );

      if (!sessionTemplate) {
        return undefined;
      }

      return {
        sessionInstance,
        sessionTemplate,
        weekInstance: currentWeekInstance,
      };
    })
    .filter(
      (value): value is SessionInstanceListItem => value !== undefined
    );
}

function createExerciseInstanceId(exerciseTemplateId: string) {
  return `exercise-instance-${exerciseTemplateId}-${Date.now()}`;
}

export async function ensureExerciseInstance(
  sessionInstanceId: string,
  exerciseTemplateId: string
): Promise<ExerciseInstance | undefined> {
  const existing = mockExerciseInstances.find(
    (exerciseInstance) =>
      exerciseInstance.sessionInstanceId === sessionInstanceId &&
      exerciseInstance.exerciseTemplateId === exerciseTemplateId
  );

  if (existing) {
    return existing;
  }

  const sessionInstance = await getSessionInstanceById(sessionInstanceId);
  if (!sessionInstance) {
    return undefined;
  }

  const exerciseTemplate = await getExerciseTemplateById(exerciseTemplateId);
  if (!exerciseTemplate) {
    return undefined;
  }

  const weekInstance = await getWeekInstanceById(sessionInstance.weekInstanceId);
  const weekTemplate = weekInstance
    ? await getWeekTemplateById(weekInstance.weekTemplateId)
    : undefined;

  const exerciseInstance: ExerciseInstance = {
    id: createExerciseInstanceId(exerciseTemplateId),
    sessionInstanceId,
    exerciseTemplateId,
    status: "not_started",
    startedAt: null,
    completedAt: null,
    prescribedWeight: null,
    prescribedRepTarget: exerciseTemplate.targetReps,
    prescribedRir: weekTemplate?.targetRir ?? null,
  };

  mockExerciseInstances.push(exerciseInstance);
  return exerciseInstance;
}

export async function createExerciseSet(
  exerciseInstanceId: string
): Promise<ExerciseSet | undefined> {
  const exerciseInstance = await getExerciseInstanceById(exerciseInstanceId);
  if (!exerciseInstance) {
    return undefined;
  }

  const existingSets = await getExerciseSetsForExerciseInstance(exerciseInstanceId);
  const nextSetIndex = existingSets.length + 1;

  const exerciseSet: ExerciseSet = {
    id: `set-${exerciseInstanceId}-${Date.now()}`,
    exerciseInstanceId,
    setIndex: nextSetIndex,
    performedWeight: null,
    performedReps: null,
    performedRir: null,
  };

  mockExerciseSets.push(exerciseSet);
  return exerciseSet;
}

export async function updateExerciseSet(
  setId: string,
  changes: Pick<ExerciseSet, "performedWeight" | "performedReps" | "performedRir">
): Promise<ExerciseSet | undefined> {
  const exerciseSet = mockExerciseSets.find((set) => set.id === setId);
  if (!exerciseSet) {
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(changes, "performedWeight")) {
    exerciseSet.performedWeight = changes.performedWeight ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(changes, "performedReps")) {
    exerciseSet.performedReps = changes.performedReps ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(changes, "performedRir")) {
    exerciseSet.performedRir = changes.performedRir ?? null;
  }

  return exerciseSet;
}

export async function deleteExerciseSet(setId: string): Promise<boolean> {
  const index = mockExerciseSets.findIndex((set) => set.id === setId);
  if (index < 0) {
    return false;
  }

  const [{ exerciseInstanceId }] = mockExerciseSets.splice(index, 1);

  const remainingSets = mockExerciseSets
    .filter((set) => set.exerciseInstanceId === exerciseInstanceId)
    .sort((a, b) => a.setIndex - b.setIndex);

  remainingSets.forEach((set, setIndex) => {
    set.setIndex = setIndex + 1;
  });

  return true;
}

export async function startSessionInstance(
  sessionInstanceId: string
): Promise<SessionInstance | undefined> {
  const sessionInstance = mockSessionInstances.find(
    (session) => session.id === sessionInstanceId
  );

  if (!sessionInstance) {
    return undefined;
  }

  if (!sessionInstance.startedAt) {
    sessionInstance.startedAt = new Date().toISOString();
  }

  if (sessionInstance.status === "not_started") {
    sessionInstance.status = "in_progress";
  }

  return sessionInstance;
}

export async function stopSessionInstance(
  sessionInstanceId: string
): Promise<SessionInstance | undefined> {
  const sessionInstance = mockSessionInstances.find(
    (session) => session.id === sessionInstanceId
  );

  if (!sessionInstance) {
    return undefined;
  }

  if (!sessionInstance.startedAt) {
    sessionInstance.startedAt = new Date().toISOString();
  }

  if (!sessionInstance.completedAt) {
    sessionInstance.completedAt = new Date().toISOString();
  }

  sessionInstance.status = "completed";

  if (sessionInstance.startedAt && sessionInstance.completedAt) {
    const startedMs = new Date(sessionInstance.startedAt).getTime();
    const completedMs = new Date(sessionInstance.completedAt).getTime();

    if (!Number.isNaN(startedMs) && !Number.isNaN(completedMs) && completedMs >= startedMs) {
      sessionInstance.durationSeconds = Math.round((completedMs - startedMs) / 1000);
    }
  }

  return sessionInstance;
}
