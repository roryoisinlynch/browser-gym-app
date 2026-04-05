import type {
  ExerciseInstance,
  ExerciseSet,
  ExerciseTemplate,
  SeasonInstance,
  SeasonTemplate,
  SessionInstance,
  SessionTemplate,
  SessionTemplateMuscleGroup,
  WeekInstance,
  WeekInstanceItem,
  WeekTemplate,
  WeekTemplateItem,
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

import { mergeWithImportedSets } from "../services/importMerge";
import { loadAllImportedSets } from "../services/importedSetStore";

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
  historicalBestReps: number | null;
  targetEstimatedOneRepMax: number | null;
  sets: AnalyzedExerciseSet[];
}

export interface SessionInstanceListItem {
  sessionInstance: SessionInstance;
  sessionTemplate: SessionTemplate;
  weekInstance: WeekInstance;
}

export interface WeekInstanceItemView {
  weekInstanceItem: WeekInstanceItem;
  sessionInstance: SessionInstance | null;
  sessionTemplate: SessionTemplate | null;
  weekInstance: WeekInstance;
}

export interface SetRecord {
  id: string;
  source: "native" | "imported";
  exerciseName: string;
  weight: number | null;
  reps: number | null;
  date: string;
}

export async function getAllSetRecords(): Promise<SetRecord[]> {
  const [exerciseSets, exerciseInstances, exerciseTemplates, sessionInstances, importedSets] =
    await Promise.all([
      getAll<ExerciseSet>(STORE_NAMES.exerciseSets),
      getAll<ExerciseInstance>(STORE_NAMES.exerciseInstances),
      getAll<ExerciseTemplate>(STORE_NAMES.exerciseTemplates),
      getAll<SessionInstance>(STORE_NAMES.sessionInstances),
      loadAllImportedSets(),
    ]);

  const exerciseInstanceMap = new Map(exerciseInstances.map((i) => [i.id, i]));
  const exerciseTemplateMap = new Map(exerciseTemplates.map((t) => [t.id, t]));
  const sessionInstanceMap = new Map(sessionInstances.map((s) => [s.id, s]));

  const nativeRecords: SetRecord[] = exerciseSets
    .map((set): SetRecord | null => {
      const instance = exerciseInstanceMap.get(set.exerciseInstanceId);
      if (!instance) return null;
      const template = exerciseTemplateMap.get(instance.exerciseTemplateId);
      if (!template) return null;
      const session = sessionInstanceMap.get(instance.sessionInstanceId);
      if (!session) return null;
      return {
        id: set.id,
        source: "native" as const,
        exerciseName: template.exerciseName,
        weight: set.performedWeight ?? null,
        reps: set.performedReps ?? null,
        date: session.date,
      };
    })
    .filter((r): r is SetRecord => r !== null);

  const importedRecords: SetRecord[] = importedSets.map((s) => ({
    id: s.id,
    source: "imported" as const,
    exerciseName: s.exerciseName,
    weight: s.weight,
    reps: s.reps,
    date: s.date,
  }));

  return [...nativeRecords, ...importedRecords].sort((a, b) =>
    b.date.localeCompare(a.date)
  );
}

export async function getSeasonTemplates(): Promise<SeasonTemplate[]> {
  return getAll<SeasonTemplate>(STORE_NAMES.seasonTemplates);
}

export async function getSeasonTemplateById(
  seasonTemplateId: string
): Promise<SeasonTemplate | undefined> {
  return getById<SeasonTemplate>(STORE_NAMES.seasonTemplates, seasonTemplateId);
}

/**
 * Replicates the canonical week template N times (once per entry in
 * rirSequence) to create all WeekInstances, SessionInstances, and
 * WeekInstanceItems for a new season instance.
 */
async function replicateSeasonWeeks(
  seasonTemplate: SeasonTemplate,
  newSeasonInstanceId: string,
  startedAt: string
): Promise<void> {
  const allWeekTemplates = await getAll<WeekTemplate>(STORE_NAMES.weekTemplates);
  const canonicalWeekTemplate = allWeekTemplates
    .filter((wt) => wt.seasonTemplateId === seasonTemplate.id)
    .sort((a, b) => a.order - b.order)[0];
  if (!canonicalWeekTemplate) return;

  const weekTemplateItems = (
    await getAllByIndex<WeekTemplateItem>(
      STORE_NAMES.weekTemplateItems,
      "byWeekTemplateId",
      canonicalWeekTemplate.id
    )
  ).sort((a, b) => a.order - b.order);

  const weekCount =
    seasonTemplate.rirSequence?.length ?? seasonTemplate.plannedWeekCount;

  const baseDate = new Date(startedAt);

  for (let weekIndex = 0; weekIndex < weekCount; weekIndex++) {
    const weekOrder = weekIndex + 1;
    const weekInstanceId = `week-instance-${newSeasonInstanceId}-${weekOrder}`;

    const newWeekInstance: WeekInstance = {
      id: weekInstanceId,
      seasonInstanceId: newSeasonInstanceId,
      weekTemplateId: canonicalWeekTemplate.id,
      order: weekOrder,
      status: weekOrder === 1 ? "in_progress" : "not_started",
      startedAt: weekOrder === 1 ? startedAt : null,
      completedAt: null,
      summary: null,
      grade: null,
    };

    await putItem(STORE_NAMES.weekInstances, newWeekInstance);

    const sessionInstancesByTemplateItemId = new Map<string, SessionInstance>();

    for (const weekTemplateItem of weekTemplateItems) {
      if (
        weekTemplateItem.type !== "session" ||
        !weekTemplateItem.sessionTemplateId
      ) {
        continue;
      }

      const sessionDate = new Date(baseDate);
      const offsetDays = weekIndex * 9 + (weekTemplateItem.order - 1);
      sessionDate.setUTCDate(sessionDate.getUTCDate() + offsetDays);

      const newSessionInstance: SessionInstance = {
        id: `session-instance-${newSeasonInstanceId}-${weekOrder}-${weekTemplateItem.id}`,
        seasonInstanceId: newSeasonInstanceId,
        weekInstanceId,
        sessionTemplateId: weekTemplateItem.sessionTemplateId,
        date: sessionDate.toISOString(),
        status: "not_started",
        startedAt: null,
        completedAt: null,
        durationSeconds: null,
      };

      await putItem(STORE_NAMES.sessionInstances, newSessionInstance);
      sessionInstancesByTemplateItemId.set(weekTemplateItem.id, newSessionInstance);
    }

    for (const weekTemplateItem of weekTemplateItems) {
      const linkedSessionInstance =
        weekTemplateItem.type === "session"
          ? sessionInstancesByTemplateItemId.get(weekTemplateItem.id) ?? null
          : null;

      const newWeekInstanceItem: WeekInstanceItem = {
        id: `week-instance-item-${weekInstanceId}-${weekTemplateItem.id}`,
        weekInstanceId,
        weekTemplateItemId: weekTemplateItem.id,
        order: weekTemplateItem.order,
        type: weekTemplateItem.type,
        sessionInstanceId: linkedSessionInstance?.id,
        label: weekTemplateItem.label ?? null,
      };

      await putItem(STORE_NAMES.weekInstanceItems, newWeekInstanceItem);
    }
  }
}

export async function startSeasonFromTemplate(
  seasonTemplateId: string
): Promise<SeasonInstance | undefined> {
  const seasonTemplate = await getById<SeasonTemplate>(
    STORE_NAMES.seasonTemplates,
    seasonTemplateId
  );
  if (!seasonTemplate) return undefined;

  const existingSeasons = await getAll<SeasonInstance>(STORE_NAMES.seasonInstances);
  const lastOrder = existingSeasons
    .filter((s) => s.seasonTemplateId === seasonTemplateId)
    .reduce((max, s) => Math.max(max, s.order), 0);

  const nowIso = new Date().toISOString();
  const newOrder = lastOrder + 1;
  const newSeasonInstanceId = `season-instance-${seasonTemplateId}-${Date.now()}`;

  const newSeasonInstance: SeasonInstance = {
    id: newSeasonInstanceId,
    seasonTemplateId,
    name: `Season ${newOrder}`,
    order: newOrder,
    status: "in_progress",
    startedAt: nowIso,
    completedAt: null,
  };

  await putItem(STORE_NAMES.seasonInstances, newSeasonInstance);
  await replicateSeasonWeeks(seasonTemplate, newSeasonInstanceId, nowIso);

  return newSeasonInstance;
}

export async function getWeekTemplates(): Promise<WeekTemplate[]> {
  const weeks = await getAll<WeekTemplate>(STORE_NAMES.weekTemplates);
  return weeks.sort((a, b) => a.order - b.order);
}

export async function getCanonicalWeekTemplateForSeason(
  seasonTemplateId: string
): Promise<WeekTemplate | undefined> {
  const all = await getAllByIndex<WeekTemplate>(
    STORE_NAMES.weekTemplates,
    "bySeasonTemplateId",
    seasonTemplateId
  );
  return all.sort((a, b) => a.order - b.order)[0];
}

export async function getWeekTemplateItemsForWeekTemplate(
  weekTemplateId: string
): Promise<WeekTemplateItem[]> {
  const items = await getAllByIndex<WeekTemplateItem>(
    STORE_NAMES.weekTemplateItems,
    "byWeekTemplateId",
    weekTemplateId
  );
  return items.sort((a, b) => a.order - b.order);
}

export async function getWeekTemplateById(
  weekTemplateId: string
): Promise<WeekTemplate | undefined> {
  return getById<WeekTemplate>(STORE_NAMES.weekTemplates, weekTemplateId);
}

export async function getSessionTemplatesForWeek(
  weekTemplateId: string
): Promise<SessionTemplate[]> {
  const items = await getAllByIndex<WeekTemplateItem>(
    STORE_NAMES.weekTemplateItems,
    "byWeekTemplateId",
    weekTemplateId
  );
  const sessionTemplateIds = items
    .filter((i) => i.type === "session" && i.sessionTemplateId)
    .map((i) => i.sessionTemplateId!);
  const templates = await Promise.all(
    sessionTemplateIds.map((id) =>
      getById<SessionTemplate>(STORE_NAMES.sessionTemplates, id)
    )
  );
  return (templates.filter(Boolean) as SessionTemplate[]).sort(
    (a, b) => a.order - b.order
  );
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

export interface ExerciseSessionDataPoint {
  exerciseInstanceId: string;
  weekInstanceId: string | null;
  seasonInstanceId: string | null;
  date: string;
  topWeight: number | null;
  topReps: number | null;
  topEstimatedOneRepMax: number | null;
  topRepCount: number | null; // raw max reps in session, used for bodyweight exercises
}

export async function getExerciseSessionHistory(
  exerciseName: string
): Promise<ExerciseSessionDataPoint[]> {
  // History is matched by exercise name so that:
  // - Templates with the same name (e.g. Bench Press in two sessions) share history
  // - Hard-deleted templates don't lose history (instances carry the name themselves)
  const normalizedName = exerciseName.trim().toLowerCase();
  const allInstances = await getAll<ExerciseInstance>(STORE_NAMES.exerciseInstances);
  const exerciseInstances = allInstances.filter(
    (inst) => inst.exerciseName?.trim().toLowerCase() === normalizedName
  );

  const dataPoints: ExerciseSessionDataPoint[] = [];

  for (const exerciseInstance of exerciseInstances) {
    const sessionInstance = await getById<SessionInstance>(
      STORE_NAMES.sessionInstances,
      exerciseInstance.sessionInstanceId
    );
    if (!sessionInstance) continue;

    const sets = await getExerciseSetsForExerciseInstance(exerciseInstance.id);

    let topWeight: number | null = null;
    let topReps: number | null = null;
    let topE1RM: number | null = null;
    let topRepCount: number | null = null;

    for (const set of sets) {
      if (set.performedReps != null && set.performedReps > 0) {
        if (topRepCount == null || set.performedReps > topRepCount) {
          topRepCount = set.performedReps;
        }
      }
      if (set.performedWeight != null && set.performedWeight > 0 && set.performedReps != null) {
        const e1RM = calculateEstimatedOneRepMax(set.performedWeight, set.performedReps);
        if (e1RM != null && (topE1RM == null || e1RM > topE1RM)) {
          topWeight = set.performedWeight;
          topReps = set.performedReps;
          topE1RM = e1RM;
        }
      }
    }

    if (topRepCount != null || topE1RM != null) {
      dataPoints.push({
        exerciseInstanceId: exerciseInstance.id,
        weekInstanceId: sessionInstance.weekInstanceId,
        seasonInstanceId: sessionInstance.seasonInstanceId,
        date: sessionInstance.date,
        topWeight,
        topReps: topReps ?? topRepCount,
        topEstimatedOneRepMax: topE1RM,
        topRepCount,
      });
    }
  }

  const importedSets = await loadAllImportedSets();
  const matchingImported = importedSets.filter(
    (s) => s.exerciseName.trim().toLowerCase() === normalizedName
  );

  const importedByDate = new Map<string, {
    weight: number | null; reps: number; e1RM: number | null; topRepCount: number;
  }>();
  for (const s of matchingImported) {
    if (s.reps <= 0) continue;
    const e1RM = s.weight > 0 ? calculateEstimatedOneRepMax(s.weight, s.reps) : null;
    const existing = importedByDate.get(s.date);
    const isBetter = existing == null ||
      (e1RM != null && (existing.e1RM == null || e1RM > existing.e1RM)) ||
      (e1RM == null && existing.e1RM == null && s.reps > existing.reps);
    if (isBetter) {
      importedByDate.set(s.date, {
        weight: s.weight > 0 ? s.weight : null,
        reps: s.reps,
        e1RM,
        topRepCount: existing == null ? s.reps : Math.max(existing.topRepCount, s.reps),
      });
    } else if (existing != null) {
      existing.topRepCount = Math.max(existing.topRepCount, s.reps);
    }
  }

  for (const [date, topSet] of importedByDate) {
    dataPoints.push({
      exerciseInstanceId: "__imported__",
      weekInstanceId: null,
      seasonInstanceId: null,
      date,
      topWeight: topSet.weight,
      topReps: topSet.reps,
      topEstimatedOneRepMax: topSet.e1RM,
      topRepCount: topSet.topRepCount,
    });
  }

  return dataPoints.sort((a, b) => a.date.localeCompare(b.date));
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

  const seasonTemplate = await getSeasonTemplateById(
    seasonInstance.seasonTemplateId
  );
  if (!seasonTemplate) {
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

  const isBodyweight = exerciseTemplate.weightMode === "bodyweight";

  const allHistoricalSets = await mergeWithImportedSets(
    exerciseTemplate.exerciseName,
    await getExerciseSetsForExerciseTemplate(exerciseTemplate.id),
    isBodyweight
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

  const historicalBestReps = priorHistoricalSets.reduce<number | null>((best, set) => {
    if (set.performedReps == null || set.performedReps <= 0) return best;
    return best == null || set.performedReps > best ? set.performedReps : best;
  }, null);

  const weekRir =
    seasonTemplate.rirSequence?.[weekInstance.order - 1] ??
    weekTemplate.targetRir ??
    exerciseInstance.prescribedRir ??
    0;

  // Always recompute from history — never carry over stale stored values.
  // No history → both remain null → AMRAP prompt shown to user.
  let prescribedWeight: number | null = null;
  let prescribedRepTarget: number | null = null;

  if (exerciseTemplate.weightMode === "bodyweight") {
    // Historical best is a 0 RIR effort, so prescription = best - weekRir.
    if (historicalBestReps != null) {
      prescribedRepTarget = Math.max(1, historicalBestReps - weekRir);
    }
  } else if (
    historicalBestEstimatedOneRepMax != null &&
    exerciseTemplate.prescribedWeight != null &&
    exerciseTemplate.prescribedWeight > 0
  ) {
    // Weight is fixed by the user's settings choice.
    // Reps float: 0 RIR = max reps at this weight without exceeding e1RM.
    prescribedWeight = exerciseTemplate.prescribedWeight;
    const zeroRirReps = Math.floor(
      (historicalBestEstimatedOneRepMax / prescribedWeight - 1) * 30
    );
    prescribedRepTarget = Math.max(1, zeroRirReps - weekRir);
  }

  let resolvedExerciseInstance = exerciseInstance;
  if (
    prescribedWeight !== (exerciseInstance.prescribedWeight ?? null) ||
    prescribedRepTarget !== (exerciseInstance.prescribedRepTarget ?? null)
  ) {
    resolvedExerciseInstance = { ...exerciseInstance, prescribedWeight, prescribedRepTarget };
    await putItem(STORE_NAMES.exerciseInstances, resolvedExerciseInstance);
  }

  const targetEstimatedOneRepMax = calculateEstimatedOneRepMax(
    resolvedExerciseInstance.prescribedWeight,
    resolvedExerciseInstance.prescribedRepTarget
  );

  return {
    seasonInstance,
    weekInstance,
    weekTemplate,
    sessionInstance,
    sessionTemplate,
    exerciseInstance: resolvedExerciseInstance,
    exerciseTemplate,
    movementType,
    historicalBestEstimatedOneRepMax,
    historicalBestReps,
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

      const allHistoricalSets = await mergeWithImportedSets(
        exerciseTemplate.exerciseName,
        await getExerciseSetsForExerciseTemplate(exerciseTemplate.id)
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

export async function getWeekInstancesForSeasonInstance(
  seasonInstanceId: string
): Promise<WeekInstance[]> {
  const instances = await getAllByIndex<WeekInstance>(
    STORE_NAMES.weekInstances,
    "bySeasonInstanceId",
    seasonInstanceId
  );
  return instances.sort((a, b) => a.order - b.order);
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

export async function getWeekInstanceItemsForCurrentWeek(): Promise<
  WeekInstanceItemView[]
> {
  const currentWeekInstance = await getCurrentWeekInstance();

  if (!currentWeekInstance) {
    return [];
  }

  const weekItems = await getAllByIndex<WeekInstanceItem>(
    STORE_NAMES.weekInstanceItems,
    "byWeekInstanceId",
    currentWeekInstance.id
  );

  const sortedItems = [...weekItems].sort((a, b) => a.order - b.order);

  const sessionInstances = await getSessionInstancesForWeekInstance(
    currentWeekInstance.id
  );

  const sessionTemplates = await Promise.all(
    sessionInstances.map((session) =>
      getSessionTemplateById(session.sessionTemplateId)
    )
  );

  const templateMap = new Map(
    sessionTemplates
      .filter((t): t is SessionTemplate => t !== undefined)
      .map((template) => [template.id, template])
  );

  const sessionMap = new Map(
    sessionInstances.map((session) => [session.id, session])
  );

  return sortedItems.map((item) => {
    if (item.type === "rest") {
      return {
        weekInstanceItem: item,
        sessionInstance: null,
        sessionTemplate: null,
        weekInstance: currentWeekInstance,
      };
    }

    const sessionInstance = item.sessionInstanceId
      ? sessionMap.get(item.sessionInstanceId) ?? null
      : null;

    const sessionTemplate =
      sessionInstance != null
        ? templateMap.get(sessionInstance.sessionTemplateId) ?? null
        : null;

    return {
      weekInstanceItem: item,
      sessionInstance,
      sessionTemplate,
      weekInstance: currentWeekInstance,
    };
  });
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
    exerciseName: exerciseTemplate.exerciseName,
    status: "not_started",
    startedAt: null,
    completedAt: null,
    prescribedWeight: null,
    prescribedRepTarget: null,
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

  const exerciseInstance = await getExerciseInstanceById(
    updatedSet.exerciseInstanceId
  );

  if (exerciseInstance) {
    const hasMeaningfulInput =
      updatedSet.performedWeight != null ||
      updatedSet.performedReps != null ||
      updatedSet.performedRir != null;

    if (hasMeaningfulInput) {
      if (exerciseInstance.status === "not_started") {
        await startExerciseInstance(exerciseInstance.id);
      } else if (exerciseInstance.status === "completed") {
        const reopenedExerciseInstance: ExerciseInstance = {
          ...exerciseInstance,
          status: "in_progress",
          completedAt: null,
        };

        await putItem(STORE_NAMES.exerciseInstances, reopenedExerciseInstance);
      }
    }
  }

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

export async function startExerciseInstance(
  exerciseInstanceId: string
): Promise<ExerciseInstance | undefined> {
  const exerciseInstance = await getExerciseInstanceById(exerciseInstanceId);

  if (!exerciseInstance) {
    return undefined;
  }

  if (exerciseInstance.status === "completed") {
    return exerciseInstance;
  }

  const updatedExerciseInstance: ExerciseInstance = {
    ...exerciseInstance,
    status: "in_progress",
    startedAt: exerciseInstance.startedAt ?? new Date().toISOString(),
  };

  await putItem(STORE_NAMES.exerciseInstances, updatedExerciseInstance);
  return updatedExerciseInstance;
}

export async function completeExerciseInstance(
  exerciseInstanceId: string
): Promise<ExerciseInstance | undefined> {
  const exerciseInstance = await getExerciseInstanceById(exerciseInstanceId);

  if (!exerciseInstance) {
    return undefined;
  }

  const nowIso = new Date().toISOString();

  const updatedExerciseInstance: ExerciseInstance = {
    ...exerciseInstance,
    status: "completed",
    startedAt: exerciseInstance.startedAt ?? nowIso,
    completedAt: exerciseInstance.completedAt ?? nowIso,
  };

  await putItem(STORE_NAMES.exerciseInstances, updatedExerciseInstance);
  return updatedExerciseInstance;
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

  const nowIso = new Date().toISOString();
  const startedAt = sessionInstance.startedAt ?? nowIso;
  const completedAt = sessionInstance.completedAt ?? nowIso;

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

  const allSessionsCompleted = weekSessions.every((session) =>
    session.id === updatedSession.id ? true : session.status === "completed"
  );

  if (!allSessionsCompleted) {
    return updatedSession;
  }

  const weekInstance = await getWeekInstanceById(sessionInstance.weekInstanceId);

  if (!weekInstance) {
    return updatedSession;
  }

  const completedWeek: WeekInstance = {
    ...weekInstance,
    status: "completed",
    completedAt: weekInstance.completedAt ?? nowIso,
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
      startedAt: nextWeek.startedAt ?? nowIso,
    };

    await putItem(STORE_NAMES.weekInstances, activatedNextWeek);
    return updatedSession;
  }

  const currentSeasonInstance = await getSeasonInstanceById(
    weekInstance.seasonInstanceId
  );

  if (!currentSeasonInstance) {
    return updatedSession;
  }

  const completedSeasonInstance: SeasonInstance = {
    ...currentSeasonInstance,
    status: "completed",
    completedAt: currentSeasonInstance.completedAt ?? nowIso,
  };

  await putItem(STORE_NAMES.seasonInstances, completedSeasonInstance);

  const allSeasonInstances = await getAll<SeasonInstance>(
    STORE_NAMES.seasonInstances
  );

  const nextSeasonOrder =
    allSeasonInstances
      .filter(
        (candidate) =>
          candidate.seasonTemplateId === currentSeasonInstance.seasonTemplateId
      )
      .reduce((maxOrder, candidate) => Math.max(maxOrder, candidate.order), 0) + 1;

  const newSeasonStartedAt = nowIso;
  const newSeasonInstanceId = `season-instance-${currentSeasonInstance.seasonTemplateId}-${Date.now()}`;

  const newSeasonInstance: SeasonInstance = {
    id: newSeasonInstanceId,
    seasonTemplateId: currentSeasonInstance.seasonTemplateId,
    name: `Season ${nextSeasonOrder}`,
    order: nextSeasonOrder,
    label: currentSeasonInstance.label,
    status: "in_progress",
    startedAt: newSeasonStartedAt,
    completedAt: null,
  };

  await putItem(STORE_NAMES.seasonInstances, newSeasonInstance);

  const repeatSeasonTemplate = await getSeasonTemplateById(
    currentSeasonInstance.seasonTemplateId
  );
  if (repeatSeasonTemplate) {
    await replicateSeasonWeeks(
      repeatSeasonTemplate,
      newSeasonInstanceId,
      newSeasonStartedAt
    );
  }

  return updatedSession;
}

// ─── Config: template reads ───────────────────────────────────────────────────

export async function getAllExerciseTemplates(): Promise<ExerciseTemplate[]> {
  return getAll<ExerciseTemplate>(STORE_NAMES.exerciseTemplates);
}

export async function getAllMuscleGroups(): Promise<MuscleGroup[]> {
  const all = await getAll<MuscleGroup>(STORE_NAMES.muscleGroups);
  return all.sort((a, b) => a.order - b.order);
}

export async function getAllMovementTypes(): Promise<MovementType[]> {
  return getAll<MovementType>(STORE_NAMES.movementTypes);
}

export async function getMovementTypesByMuscleGroupId(
  muscleGroupId: string
): Promise<MovementType[]> {
  return getAllByIndex<MovementType>(
    STORE_NAMES.movementTypes,
    "byMuscleGroupId",
    muscleGroupId
  );
}

export async function getAllSessionTemplates(): Promise<SessionTemplate[]> {
  const templates = await getAll<SessionTemplate>(STORE_NAMES.sessionTemplates);
  return templates.sort((a, b) => a.order - b.order);
}

// ─── Config: template writes ──────────────────────────────────────────────────

export async function saveSeasonTemplate(
  template: SeasonTemplate
): Promise<void> {
  await putItem(STORE_NAMES.seasonTemplates, template);
}

export async function deleteSeasonTemplateById(id: string): Promise<void> {
  // Cascade: session templates (and their stmgs + exercises)
  const allSessionTemplates = await getAll<SessionTemplate>(
    STORE_NAMES.sessionTemplates
  );
  for (const st of allSessionTemplates.filter((s) => s.seasonTemplateId === id)) {
    await deleteSessionTemplateById(st.id);
  }
  // Cascade: canonical week template and its items
  const weekTemplate = await getCanonicalWeekTemplateForSeason(id);
  if (weekTemplate) {
    const items = await getWeekTemplateItemsForWeekTemplate(weekTemplate.id);
    for (const item of items) {
      await deleteItem(STORE_NAMES.weekTemplateItems, item.id);
    }
    await deleteItem(STORE_NAMES.weekTemplates, weekTemplate.id);
  }
  await deleteItem(STORE_NAMES.seasonTemplates, id);
}

export async function saveWeekTemplate(
  template: WeekTemplate
): Promise<void> {
  await putItem(STORE_NAMES.weekTemplates, template);
}

export async function saveWeekTemplateItem(
  item: WeekTemplateItem
): Promise<void> {
  await putItem(STORE_NAMES.weekTemplateItems, item);
}

export async function deleteWeekTemplateItemById(id: string): Promise<void> {
  await deleteItem(STORE_NAMES.weekTemplateItems, id);
}

export async function saveSessionTemplate(
  template: SessionTemplate
): Promise<void> {
  await putItem(STORE_NAMES.sessionTemplates, template);
}

export async function deleteSessionTemplateById(id: string): Promise<void> {
  const sections = await getAllByIndex<SessionTemplateMuscleGroup>(
    STORE_NAMES.sessionTemplateMuscleGroups,
    "bySessionTemplateId",
    id
  );
  for (const section of sections) {
    await deleteSessionTemplateMuscleGroupById(section.id);
  }
  await deleteItem(STORE_NAMES.sessionTemplates, id);
}

export async function saveMuscleGroup(muscleGroup: MuscleGroup): Promise<void> {
  await putItem(STORE_NAMES.muscleGroups, muscleGroup);
}

export async function saveMovementType(
  movementType: MovementType
): Promise<void> {
  await putItem(STORE_NAMES.movementTypes, movementType);
}

export async function saveSessionTemplateMuscleGroup(
  stmg: SessionTemplateMuscleGroup
): Promise<void> {
  await putItem(STORE_NAMES.sessionTemplateMuscleGroups, stmg);
}

export async function deleteSessionTemplateMuscleGroupById(
  id: string
): Promise<void> {
  const exercises = await getAllByIndex<ExerciseTemplate>(
    STORE_NAMES.exerciseTemplates,
    "bySessionTemplateMuscleGroupId",
    id
  );
  for (const exercise of exercises) {
    await deleteItem(STORE_NAMES.exerciseTemplates, exercise.id);
  }
  await deleteItem(STORE_NAMES.sessionTemplateMuscleGroups, id);
}

export async function saveExerciseTemplate(
  template: ExerciseTemplate
): Promise<void> {
  await putItem(STORE_NAMES.exerciseTemplates, template);
}

export async function deleteExerciseTemplateById(id: string): Promise<void> {
  await deleteItem(STORE_NAMES.exerciseTemplates, id);
}
