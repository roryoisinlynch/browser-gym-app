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

import {
  STORE_NAMES,
  getAll,
  getById,
  getAllByIndex,
  putItem,
  deleteItem,
} from "../db/db";

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

export interface SessionInstanceListItem {
  sessionInstance: SessionInstance;
  sessionTemplate: SessionTemplate;
  weekInstance: WeekInstance;
}

export async function getWeekTemplates(): Promise<WeekTemplate[]> {
  const weeks = await getAll<WeekTemplate>(STORE_NAMES.weekTemplates);
  return weeks.sort((a, b) => a.order - b.order);
}

export async function getWeekTemplateById(
  weekTemplateId: string
): Promise<WeekTemplate | undefined> {
  return getById<WeekTemplate>(STORE_NAMES.weekTemplates, weekTemplateId);
}

export async function getSessionTemplatesForWeek(
  weekTemplateId: string
): Promise<SessionTemplate[]> {
  const sessions = await getAllByIndex<SessionTemplate>(
    STORE_NAMES.sessionTemplates,
    "byWeekTemplateId",
    weekTemplateId
  );

  return sessions.sort((a, b) => a.order - b.order);
}

export async function getSessionTemplateById(
  sessionTemplateId: string
): Promise<SessionTemplate | undefined> {
  return getById<SessionTemplate>(
    STORE_NAMES.sessionTemplates,
    sessionTemplateId
  );
}

export async function getExerciseTemplateById(
  exerciseTemplateId: string
): Promise<ExerciseTemplate | undefined> {
  return getById<ExerciseTemplate>(
    STORE_NAMES.exerciseTemplates,
    exerciseTemplateId
  );
}

export async function getMovementTypeById(
  movementTypeId: string
): Promise<MovementType | undefined> {
  return getById<MovementType>(STORE_NAMES.movementTypes, movementTypeId);
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
  const sections = await getAllByIndex<SessionTemplateMuscleGroup>(
    STORE_NAMES.sessionTemplateMuscleGroups,
    "bySessionTemplateId",
    sessionTemplateId
  );

  const muscleGroups = await getAll<MuscleGroup>(STORE_NAMES.muscleGroups);
  const groupMap = new Map(muscleGroups.map((group) => [group.id, group]));

  return sections
    .sort((a, b) => a.order - b.order)
    .map((section) => {
      const muscleGroup = groupMap.get(section.muscleGroupId);

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
  const sections = await getAllByIndex<SessionTemplateMuscleGroup>(
    STORE_NAMES.sessionTemplateMuscleGroups,
    "bySessionTemplateId",
    sessionTemplateId
  );

  const sectionIds = new Set(sections.map((section) => section.id));

  const exercises = await getAll<ExerciseTemplate>(STORE_NAMES.exerciseTemplates);
  const filteredExercises = exercises.filter((exercise) =>
    sectionIds.has(exercise.sessionTemplateMuscleGroupId)
  );

  const movementTypes = await getAll<MovementType>(STORE_NAMES.movementTypes);
  const movementTypeMap = new Map(
    movementTypes.map((movementType) => [movementType.id, movementType])
  );

  return filteredExercises
    .map((exerciseTemplate) => {
      const movementType = movementTypeMap.get(exerciseTemplate.movementTypeId);

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
  return getById<SeasonInstance>(STORE_NAMES.seasonInstances, seasonInstanceId);
}

export async function getWeekInstanceById(
  weekInstanceId: string
): Promise<WeekInstance | undefined> {
  return getById<WeekInstance>(STORE_NAMES.weekInstances, weekInstanceId);
}

export async function getSessionInstanceById(
  sessionInstanceId: string
): Promise<SessionInstance | undefined> {
  return getById<SessionInstance>(STORE_NAMES.sessionInstances, sessionInstanceId);
}

export async function getExerciseInstanceById(
  exerciseInstanceId: string
): Promise<ExerciseInstance | undefined> {
  return getById<ExerciseInstance>(
    STORE_NAMES.exerciseInstances,
    exerciseInstanceId
  );
}

export async function getExerciseInstancesForSessionInstance(
  sessionInstanceId: string
): Promise<ExerciseInstance[]> {
  return getAllByIndex<ExerciseInstance>(
    STORE_NAMES.exerciseInstances,
    "bySessionInstanceId",
    sessionInstanceId
  );
}

export async function getExerciseSetsForSessionInstance(
  sessionInstanceId: string
): Promise<ExerciseSet[]> {
  const exerciseInstances = await getExerciseInstancesForSessionInstance(
    sessionInstanceId
  );

  const setsByInstance = await Promise.all(
    exerciseInstances.map((exerciseInstance) =>
      getExerciseSetsForExerciseInstance(exerciseInstance.id)
    )
  );

  return setsByInstance
    .flat()
    .sort((a, b) => {
      if (a.exerciseInstanceId !== b.exerciseInstanceId) {
        return a.exerciseInstanceId.localeCompare(b.exerciseInstanceId);
      }

      return a.setIndex - b.setIndex;
    });
}

export async function getExerciseSetsForExerciseInstance(
  exerciseInstanceId: string
): Promise<ExerciseSet[]> {
  const sets = await getAllByIndex<ExerciseSet>(
    STORE_NAMES.exerciseSets,
    "byExerciseInstanceId",
    exerciseInstanceId
  );

  return sets.sort((a, b) => a.setIndex - b.setIndex);
}

export async function getExerciseSetsForExerciseTemplate(
  exerciseTemplateId: string
): Promise<ExerciseSet[]> {
  const relevantExerciseInstances = await getAllByIndex<ExerciseInstance>(
    STORE_NAMES.exerciseInstances,
    "byExerciseTemplateId",
    exerciseTemplateId
  );

  const setsByInstance = await Promise.all(
    relevantExerciseInstances.map((exerciseInstance) =>
      getExerciseSetsForExerciseInstance(exerciseInstance.id)
    )
  );

  return setsByInstance
    .flat()
    .sort((a, b) => {
      if (a.exerciseInstanceId !== b.exerciseInstanceId) {
        return a.exerciseInstanceId.localeCompare(b.exerciseInstanceId);
      }

      return a.setIndex - b.setIndex;
    });
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

  const sessionInstance = await getSessionInstanceById(
    exerciseInstance.sessionInstanceId
  );
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
            .filter(
              (exerciseSet) => exerciseSet.exerciseInstanceId === exerciseInstance.id
            )
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

export async function getSessionInstancesForWeekInstance(
  weekInstanceId: string
): Promise<SessionInstance[]> {
  const sessions = await getAllByIndex<SessionInstance>(
    STORE_NAMES.sessionInstances,
    "byWeekInstanceId",
    weekInstanceId
  );

  return sessions.sort((a, b) => a.date.localeCompare(b.date));
}

export async function getCurrentWeekInstance(): Promise<WeekInstance | undefined> {
  const weekInstances = await getAllByIndex<WeekInstance>(
    STORE_NAMES.weekInstances,
    "byStatus",
    "in_progress"
  );

  return weekInstances.sort((a, b) => a.order - b.order)[0];
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

  const sessionTemplates = await Promise.all(
    sessionInstances.map((sessionInstance) =>
      getSessionTemplateById(sessionInstance.sessionTemplateId)
    )
  );

  return sessionInstances
    .map((sessionInstance, index) => {
      const sessionTemplate = sessionTemplates[index];

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
  const existing = await getAllByIndex<ExerciseInstance>(
    STORE_NAMES.exerciseInstances,
    "bySessionAndTemplate",
    [sessionInstanceId, exerciseTemplateId]
  );

  if (existing[0]) {
    return existing[0];
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

  await putItem(STORE_NAMES.exerciseInstances, exerciseInstance);
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

  await putItem(STORE_NAMES.exerciseSets, exerciseSet);
  return exerciseSet;
}

export async function updateExerciseSet(
  setId: string,
  changes: Pick<ExerciseSet, "performedWeight" | "performedReps" | "performedRir">
): Promise<ExerciseSet | undefined> {
  const exerciseSet = await getById<ExerciseSet>(STORE_NAMES.exerciseSets, setId);
  if (!exerciseSet) {
    return undefined;
  }

  const updatedSet: ExerciseSet = {
    ...exerciseSet,
    performedWeight: Object.prototype.hasOwnProperty.call(changes, "performedWeight")
      ? (changes.performedWeight ?? null)
      : exerciseSet.performedWeight,
    performedReps: Object.prototype.hasOwnProperty.call(changes, "performedReps")
      ? (changes.performedReps ?? null)
      : exerciseSet.performedReps,
    performedRir: Object.prototype.hasOwnProperty.call(changes, "performedRir")
      ? (changes.performedRir ?? null)
      : exerciseSet.performedRir,
  };

  await putItem(STORE_NAMES.exerciseSets, updatedSet);
  return updatedSet;
}

export async function deleteExerciseSet(setId: string): Promise<boolean> {
  const targetSet = await getById<ExerciseSet>(STORE_NAMES.exerciseSets, setId);
  if (!targetSet) {
    return false;
  }

  await deleteItem(STORE_NAMES.exerciseSets, setId);

  const remainingSets = await getExerciseSetsForExerciseInstance(
    targetSet.exerciseInstanceId
  );

  for (let index = 0; index < remainingSets.length; index += 1) {
    const set = remainingSets[index]!;

    if (set.setIndex !== index + 1) {
      await putItem(STORE_NAMES.exerciseSets, {
        ...set,
        setIndex: index + 1,
      });
    }
  }

  return true;
}

export async function startSessionInstance(
  sessionInstanceId: string
): Promise<SessionInstance | undefined> {
  const sessionInstance = await getSessionInstanceById(sessionInstanceId);

  if (!sessionInstance) {
    return undefined;
  }

  const updatedSession: SessionInstance = {
    ...sessionInstance,
    startedAt: sessionInstance.startedAt ?? new Date().toISOString(),
    status:
      sessionInstance.status === "not_started"
        ? "in_progress"
        : sessionInstance.status,
  };

  await putItem(STORE_NAMES.sessionInstances, updatedSession);
  return updatedSession;
}

export async function stopSessionInstance(
  sessionInstanceId: string
): Promise<SessionInstance | undefined> {
  const sessionInstance = await getSessionInstanceById(sessionInstanceId);

  if (!sessionInstance) {
    return undefined;
  }

  const startedAt = sessionInstance.startedAt ?? new Date().toISOString();
  const completedAt = sessionInstance.completedAt ?? new Date().toISOString();

  let durationSeconds = sessionInstance.durationSeconds ?? null;

  const startedMs = new Date(startedAt).getTime();
  const completedMs = new Date(completedAt).getTime();

  if (
    !Number.isNaN(startedMs) &&
    !Number.isNaN(completedMs) &&
    completedMs >= startedMs
  ) {
    durationSeconds = Math.round((completedMs - startedMs) / 1000);
  }

  const updatedSession: SessionInstance = {
    ...sessionInstance,
    startedAt,
    completedAt,
    durationSeconds,
    status: "completed",
  };

  await putItem(STORE_NAMES.sessionInstances, updatedSession);

  const weekSessions = await getSessionInstancesForWeekInstance(
    sessionInstance.weekInstanceId
  );

  const allSessionsCompleted = weekSessions.every(
    (session) =>
      session.id === updatedSession.id
        ? true
        : session.status === "completed"
  );

  if (allSessionsCompleted) {
    const weekInstance = await getWeekInstanceById(sessionInstance.weekInstanceId);

    if (weekInstance) {
      const completedWeek: WeekInstance = {
        ...weekInstance,
        status: "completed",
        completedAt: weekInstance.completedAt ?? new Date().toISOString(),
      };

      await putItem(STORE_NAMES.weekInstances, completedWeek);

      const allWeeks = await getAllByIndex<WeekInstance>(
        STORE_NAMES.weekInstances,
        "bySeasonInstanceId",
        weekInstance.seasonInstanceId
      );

      const nextWeek = allWeeks
        .filter((candidate) => candidate.order > completedWeek.order)
        .sort((a, b) => a.order - b.order)[0];

      if (nextWeek && nextWeek.status === "not_started") {
        const activatedNextWeek: WeekInstance = {
          ...nextWeek,
          status: "in_progress",
          startedAt: nextWeek.startedAt ?? new Date().toISOString(),
        };

        await putItem(STORE_NAMES.weekInstances, activatedNextWeek);
      }
    }
  }

  return updatedSession;
}
