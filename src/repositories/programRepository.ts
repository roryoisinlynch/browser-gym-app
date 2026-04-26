import type {
  ExerciseInstance,
  ExerciseSet,
  ExerciseTemplate,
  SeasonInstance,
  SeasonTemplate,
  SessionInstance,
  SessionInstanceExercise,
  SessionInstanceMuscleGroup,
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

import { computeSeasonConsistency } from "../services/seasonMetrics";

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

/**
 * Returns the date the session was actually completed, as "YYYY-MM-DD".
 * Falls back to the scheduled date if completedAt is not set.
 */
function sessionCompletedDate(session: SessionInstance): string {
  const d = new Date(session.completedAt ?? session.date);
  // Use local calendar date so "today" matches the user's clock, not UTC.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  /** ID of the SessionInstanceExercise record (season-start snapshot). */
  sessionInstanceExerciseId: string;
  /** ExerciseTemplate-shaped object built from the session instance exercise snapshot. */
  exerciseTemplate: ExerciseTemplate;
  movementType: MovementType;
  exerciseInstance: ExerciseInstance | null;
  sets: AnalyzedExerciseSet[];
  workingSetCount: number;
  warmupSetCount: number;
  effectiveE1RM: number | null;
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
  effectiveRir: number;
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
  /** Date (ISO string) of the all-time PR — null when it came from imported data. */
  historicalBestDate: string | null;
  /**
   * Set when the all-time PR hasn't been matched within the last three seasons
   * that include this exercise. Prescription logic uses this value instead of
   * historicalBestEstimatedOneRepMax so intensity targets stay achievable.
   * Null when the historical best is still current.
   */
  recentMaxEstimatedOneRepMax: number | null;
  /** Date (ISO string) of the recent-max PR. */
  recentMaxDate: string | null;
  /**
   * Set when the all-time rep PR hasn't been matched within the last three
   * seasons. Only populated for bodyweight exercises. Null when the historical
   * best is still current.
   */
  recentMaxReps: number | null;
  /** Date (ISO string) of the recent-max rep PR. */
  recentMaxRepsDate: string | null;
  targetEstimatedOneRepMax: number | null;
  effectiveRir: number;
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
  const [exerciseSets, exerciseInstances, sessionInstances, importedSets] =
    await Promise.all([
      getAll<ExerciseSet>(STORE_NAMES.exerciseSets),
      getAll<ExerciseInstance>(STORE_NAMES.exerciseInstances),
      getAll<SessionInstance>(STORE_NAMES.sessionInstances),
      loadAllImportedSets(),
    ]);

  const exerciseInstanceMap = new Map(exerciseInstances.map((i) => [i.id, i]));
  const sessionInstanceMap = new Map(sessionInstances.map((s) => [s.id, s]));

  const nativeRecords: SetRecord[] = exerciseSets
    .map((set): SetRecord | null => {
      const instance = exerciseInstanceMap.get(set.exerciseInstanceId);
      if (!instance) return null;
      const session = sessionInstanceMap.get(instance.sessionInstanceId);
      if (!session) return null;
      return {
        id: set.id,
        source: "native" as const,
        exerciseName: instance.exerciseName,
        weight: set.performedWeight ?? null,
        reps: set.performedReps ?? null,
        date: sessionCompletedDate(session),
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

export async function getActiveSeasonInstance(): Promise<SeasonInstance | undefined> {
  const instances = await getAllByIndex<SeasonInstance>(
    STORE_NAMES.seasonInstances,
    "byStatus",
    "in_progress"
  );
  return instances[0];
}

export async function activateProgram(
  seasonTemplateId: string,
  startedAt?: string
): Promise<SeasonInstance | undefined> {
  const nowIso = new Date().toISOString();

  // Complete any currently active seasons and their in-progress weeks
  const activeInstances = await getAllByIndex<SeasonInstance>(
    STORE_NAMES.seasonInstances,
    "byStatus",
    "in_progress"
  );
  for (const active of activeInstances) {
    const weeks = await getWeekInstancesForSeasonInstance(active.id);
    for (const week of weeks.filter((w) => w.status === "in_progress")) {
      // Drain any in-progress sessions so they don't pollute
      // getActiveDestinationRoute after the program switch. Sessions with
      // logged sets are promoted to completed (real work was done); sessions
      // with no logged sets are demoted to not_started so they don't inflate
      // the season's completed-session count.
      const weekSessions = await getSessionInstancesForWeekInstance(week.id);
      for (const session of weekSessions.filter((s) => s.status === "in_progress")) {
        const sets = await getExerciseSetsForSessionInstance(session.id);
        const exerciseInstances = await getExerciseInstancesForSessionInstance(session.id);
        if (sets.length === 0) {
          for (const e of exerciseInstances.filter((e) => e.status === "in_progress")) {
            await putItem(STORE_NAMES.exerciseInstances, {
              ...e,
              status: "not_started",
              startedAt: null,
            });
          }
          await putItem(STORE_NAMES.sessionInstances, {
            ...session,
            status: "not_started",
            startedAt: null,
          });
        } else {
          await Promise.all(
            exerciseInstances
              .filter((e) => e.status === "in_progress")
              .map((e) => completeExerciseInstance(e.id))
          );
          await putItem(STORE_NAMES.sessionInstances, {
            ...session,
            status: "completed",
            completedAt: session.completedAt ?? nowIso,
          });
        }
      }
      await putItem(STORE_NAMES.weekInstances, {
        ...week,
        status: "completed",
        completedAt: week.completedAt ?? nowIso,
      });
    }
    await putItem(STORE_NAMES.seasonInstances, {
      ...active,
      status: "cancelled",
      completedAt: nowIso,
    });
  }

  return startSeasonFromTemplate(seasonTemplateId, startedAt);
}

export async function getSeasonTemplateById(
  seasonTemplateId: string
): Promise<SeasonTemplate | undefined> {
  return getById<SeasonTemplate>(STORE_NAMES.seasonTemplates, seasonTemplateId);
}

/**
 * Creates one week's worth of instance records (WeekInstance, WeekInstanceItems,
 * SessionInstances, SessionInstanceMuscleGroups, SessionInstanceExercises) by
 * reading the live template state at call time.
 *
 * Called at season start for week 1, and again at the end of each week for
 * the next week. Reading templates fresh each time means structural changes
 * made to the program mid-season are picked up by subsequent weeks while
 * already-generated weeks remain frozen.
 */
async function populateWeekFromTemplate(
  seasonTemplate: SeasonTemplate,
  seasonInstanceId: string,
  seasonStartedAt: string,
  weekOrder: number
): Promise<WeekInstance> {
  const allWeekTemplates = await getAll<WeekTemplate>(STORE_NAMES.weekTemplates);
  const canonicalWeekTemplate = allWeekTemplates
    .filter((wt) => wt.seasonTemplateId === seasonTemplate.id)
    .sort((a, b) => a.order - b.order)[0];
  if (!canonicalWeekTemplate) throw new Error("No canonical week template found");

  const weekTemplateItems = (
    await getAllByIndex<WeekTemplateItem>(
      STORE_NAMES.weekTemplateItems,
      "byWeekTemplateId",
      canonicalWeekTemplate.id
    )
  ).sort((a, b) => a.order - b.order);

  // Load the current exercise structure for every session template in this week.
  // Reading live templates here is intentional — edits made since the last week
  // was generated are picked up automatically.
  const sessionTemplateIds = [
    ...new Set(
      weekTemplateItems
        .filter((i) => i.type === "session" && i.sessionTemplateId)
        .map((i) => i.sessionTemplateId!)
    ),
  ];

  type TemplateStructure = {
    sessionName: string;
    groups: Array<{
      stmg: SessionTemplateMuscleGroup;
      exercises: ExerciseTemplate[];
    }>;
  };

  const templateStructure = new Map<string, TemplateStructure>();

  for (const stId of sessionTemplateIds) {
    const sessionTemplate = await getById<SessionTemplate>(
      STORE_NAMES.sessionTemplates,
      stId
    );
    if (!sessionTemplate) continue;

    const stmgs = (
      await getAllByIndex<SessionTemplateMuscleGroup>(
        STORE_NAMES.sessionTemplateMuscleGroups,
        "bySessionTemplateId",
        stId
      )
    ).sort((a, b) => a.order - b.order);

    const groups: TemplateStructure["groups"] = [];
    for (const stmg of stmgs) {
      const exercises = (
        await getAllByIndex<ExerciseTemplate>(
          STORE_NAMES.exerciseTemplates,
          "bySessionTemplateMuscleGroupId",
          stmg.id
        )
      ).sort((a, b) => a.id.localeCompare(b.id));
      groups.push({ stmg, exercises });
    }

    templateStructure.set(stId, { sessionName: sessionTemplate.name, groups });
  }

  const weekInstanceId = `week-instance-${seasonInstanceId}-${weekOrder}`;
  const nowIso = new Date().toISOString();
  const weekIndex = weekOrder - 1;
  const baseDate = new Date(seasonStartedAt);

  const newWeekInstance: WeekInstance = {
    id: weekInstanceId,
    seasonInstanceId,
    weekTemplateId: canonicalWeekTemplate.id,
    order: weekOrder,
    status: "in_progress",
    rirTarget: seasonTemplate.rirSequence?.[weekIndex] ?? null,
    startedAt: weekOrder === 1 ? seasonStartedAt : nowIso,
    completedAt: null,
    summary: null,
    grade: null,
  };

  await putItem(STORE_NAMES.weekInstances, newWeekInstance);

  const sessionInstancesByTemplateItemId = new Map<string, SessionInstance>();

  for (const weekTemplateItem of weekTemplateItems) {
    if (weekTemplateItem.type !== "session" || !weekTemplateItem.sessionTemplateId) {
      continue;
    }

    const sessionDate = new Date(baseDate);
    const offsetDays = weekIndex * weekTemplateItems.length + (weekTemplateItem.order - 1);
    sessionDate.setUTCDate(sessionDate.getUTCDate() + offsetDays);

    const structure = templateStructure.get(weekTemplateItem.sessionTemplateId);

    const newSessionInstance: SessionInstance = {
      id: `session-instance-${seasonInstanceId}-${weekOrder}-${weekTemplateItem.id}`,
      seasonInstanceId,
      weekInstanceId,
      sessionTemplateId: weekTemplateItem.sessionTemplateId,
      sessionName: structure?.sessionName ?? "",
      date: sessionDate.toISOString(),
      status: "not_started",
      startedAt: null,
      completedAt: null,
      durationSeconds: null,
    };

    await putItem(STORE_NAMES.sessionInstances, newSessionInstance);
    sessionInstancesByTemplateItemId.set(weekTemplateItem.id, newSessionInstance);

    // Deep-copy the exercise structure into instance-level snapshot records so
    // this session is fully isolated from future template edits.
    if (structure) {
      for (const { stmg, exercises } of structure.groups) {
        const simgId = `simg-${newSessionInstance.id}-${stmg.id}`;
        const simg: SessionInstanceMuscleGroup = {
          id: simgId,
          sessionInstanceId: newSessionInstance.id,
          muscleGroupId: stmg.muscleGroupId,
          order: stmg.order,
          targetWorkingSets: stmg.targetWorkingSets,
        };
        await putItem(STORE_NAMES.sessionInstanceMuscleGroups, simg);

        for (const exercise of exercises) {
          const sie: SessionInstanceExercise = {
            id: `sie-${simgId}-${exercise.id}`,
            sessionInstanceMuscleGroupId: simgId,
            sessionInstanceId: newSessionInstance.id,
            sourceExerciseTemplateId: exercise.id,
            movementTypeId: exercise.movementTypeId,
            exerciseName: exercise.exerciseName,
            weightMode: exercise.weightMode,
            prescribedWeight: exercise.prescribedWeight ?? null,
            weightIncrement: exercise.weightIncrement,
            availableWeights: exercise.availableWeights,
          };
          await putItem(STORE_NAMES.sessionInstanceExercises, sie);
        }
      }
    }
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

  return newWeekInstance;
}

export async function startSeasonFromTemplate(
  seasonTemplateId: string,
  startedAt?: string
): Promise<SeasonInstance | undefined> {
  const seasonTemplate = await getById<SeasonTemplate>(
    STORE_NAMES.seasonTemplates,
    seasonTemplateId
  );
  if (!seasonTemplate) return undefined;

  const existingSeasons = await getAll<SeasonInstance>(STORE_NAMES.seasonInstances);

  // Per-template order: tracks which run of this specific program this is.
  const lastOrder = existingSeasons
    .filter((s) => s.seasonTemplateId === seasonTemplateId)
    .reduce((max, s) => Math.max(max, s.order), 0);

  // Global season number: counts all seasons across all templates so the name
  // increments continuously even when switching programs or after template deletion.
  const globalSeasonNumber = existingSeasons.length + 1;

  const effectiveStartedAt = startedAt ?? new Date().toISOString();
  const newOrder = lastOrder + 1;
  const newSeasonInstanceId = `season-instance-${seasonTemplateId}-${Date.now()}`;

  const newSeasonInstance: SeasonInstance = {
    id: newSeasonInstanceId,
    seasonTemplateId,
    name: `Season ${globalSeasonNumber}`,
    order: newOrder,
    status: "in_progress",
    startedAt: effectiveStartedAt,
    completedAt: null,
  };

  await putItem(STORE_NAMES.seasonInstances, newSeasonInstance);
  await populateWeekFromTemplate(seasonTemplate, newSeasonInstanceId, effectiveStartedAt, 1);

  // Reset prescribed weights on any SessionInstanceExercise records that now
  // exceed the effective e1RM. A new season shifts the three-season window, so
  // an older PR that was previously within range may no longer be "recent",
  // lowering the effective e1RM below the configured working weight. Clear those
  // weights so the user is prompted to re-select on the next session.
  // Also reset the canonical template so the next season start starts clean.
  // Load all SIE records for the new season's sessions
  const allNewSessionInstances = (await getAll<SessionInstance>(STORE_NAMES.sessionInstances))
    .filter((s) => s.seasonInstanceId === newSeasonInstanceId);
  const newSessionIds = new Set(allNewSessionInstances.map((s) => s.id));

  const allNewSies = (
    await Promise.all(
      [...newSessionIds].map((sid) =>
        getAllByIndex<SessionInstanceExercise>(
          STORE_NAMES.sessionInstanceExercises,
          "bySessionInstanceId",
          sid
        )
      )
    )
  ).flat();

  const weightedNewSies = allNewSies.filter(
    (s) => s.weightMode !== "bodyweight" && s.prescribedWeight != null && s.prescribedWeight > 0
  );

  const uniqueExerciseNames = [...new Set(weightedNewSies.map((s) => s.exerciseName))];
  const e1rmByName = new Map<string, number | null>();
  await Promise.all(
    uniqueExerciseNames.map(async (name) => {
      const { historicalBest, recentMax } = await getEffectiveE1RM(name, newSeasonInstanceId);
      e1rmByName.set(name, recentMax ?? historicalBest);
    })
  );

  await Promise.all(
    weightedNewSies.map(async (sie) => {
      const effectiveE1RM = e1rmByName.get(sie.exerciseName);
      if (effectiveE1RM == null || sie.prescribedWeight! >= effectiveE1RM) {
        await putItem(STORE_NAMES.sessionInstanceExercises, {
          ...sie,
          prescribedWeight: null,
        });
        // Also reset the canonical template so future seasons start clean.
        const template = await getById<ExerciseTemplate>(
          STORE_NAMES.exerciseTemplates,
          sie.sourceExerciseTemplateId
        );
        if (template && template.prescribedWeight != null) {
          await putItem(STORE_NAMES.exerciseTemplates, {
            ...template,
            prescribedWeight: null,
          });
        }
      }
    })
  );

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

export async function getAllSeasonInstances(): Promise<SeasonInstance[]> {
  const all = await getAll<SeasonInstance>(STORE_NAMES.seasonInstances);
  return all.sort((a, b) => a.order - b.order);
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

/**
 * Returns all exercise sets ever performed for the given template, by:
 * 1. Finding all SessionInstanceExercise snapshots referencing this template
 * 2. Finding all ExerciseInstances linked to those snapshots
 * 3. Collecting all sets for those instances
 */
export async function getExerciseSetsForExerciseTemplate(
  exerciseTemplateId: string
): Promise<ExerciseSet[]> {
  const sies = await getAllByIndex<SessionInstanceExercise>(
    STORE_NAMES.sessionInstanceExercises,
    "bySourceExerciseTemplateId",
    exerciseTemplateId
  );

  const sieIds = new Set(sies.map((s) => s.id));
  const allInstances = await getAll<ExerciseInstance>(STORE_NAMES.exerciseInstances);
  const relevantInstances = allInstances.filter((i) =>
    sieIds.has(i.sessionInstanceExerciseId)
  );

  const setsByInstance = await Promise.all(
    relevantInstances.map((i) => getExerciseSetsForExerciseInstance(i.id))
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

/**
 * Returns all exercise sets ever performed for a given exercise name across
 * all sessions and imported data. Used for name-based PR detection.
 */
async function getExerciseSetsByName(exerciseName: string): Promise<ExerciseSet[]> {
  const normalizedName = exerciseName.trim().toLowerCase();
  const allInstances = await getAll<ExerciseInstance>(STORE_NAMES.exerciseInstances);
  const matching = allInstances.filter(
    (i) => i.exerciseName.trim().toLowerCase() === normalizedName
  );

  const setsByInstance = await Promise.all(
    matching.map((i) => getExerciseSetsForExerciseInstance(i.id))
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

/**
 * Returns a stable key that identifies which "season" a data point belongs to.
 *
 * For real sessions this is the SeasonInstance ID. For imported data (which
 * carries no season membership) it falls back to the calendar month ("YYYY-MM"),
 * mirroring the bucketing used in the ExerciseInsights chart so that both
 * the recent-max prescription logic and the chart treat imported history
 * consistently.
 */
export function resolveExerciseSeasonKey(
  seasonInstanceId: string | null | undefined,
  date: string
): string {
  return seasonInstanceId ?? date.slice(0, 7);
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
        date: sessionCompletedDate(sessionInstance),
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

/**
 * Returns the historical best e1RM and, when the all-time best hasn't been
 * matched in the last three seasons, a "recent max" that reflects current
 * capacity. This mirrors the prescription logic in getExerciseInstanceView so
 * that ConfigExercisePage generates weight options against the same baseline.
 *
 * Pass currentSeasonInstanceId when a new season has just started (e.g. after
 * startSeasonFromTemplate) so its empty bucket is counted among the three most
 * recent seasons before any sets are logged.
 */
export async function getEffectiveE1RM(
  exerciseName: string,
  currentSeasonInstanceId?: string
): Promise<{
  historicalBest: number | null;
  recentMax: number | null;
  historicalBestReps: number | null;
  recentMaxReps: number | null;
}> {
  const history = await getExerciseSessionHistory(exerciseName);

  const historicalBest = history.reduce<number | null>((best, dp) => {
    if (dp.topEstimatedOneRepMax == null) return best;
    return best == null || dp.topEstimatedOneRepMax > best
      ? dp.topEstimatedOneRepMax
      : best;
  }, null);

  const historicalBestReps = history.reduce<number | null>((best, dp) => {
    if (dp.topRepCount == null) return best;
    return best == null || dp.topRepCount > best ? dp.topRepCount : best;
  }, null);

  if (historicalBest == null && historicalBestReps == null) {
    return { historicalBest: null, recentMax: null, historicalBestReps: null, recentMaxReps: null };
  }

  type SeasonBucket = { sortDate: string; bestE1RM: number | null; bestReps: number | null };
  const seasonBuckets = new Map<string, SeasonBucket>();

  if (currentSeasonInstanceId) {
    const nowDate = new Date().toISOString().slice(0, 10);
    seasonBuckets.set(currentSeasonInstanceId, { sortDate: nowDate, bestE1RM: null, bestReps: null });
  }

  for (const dp of history) {
    const key = resolveExerciseSeasonKey(dp.seasonInstanceId, dp.date);
    const existing = seasonBuckets.get(key);
    if (!existing) {
      seasonBuckets.set(key, {
        sortDate: dp.date,
        bestE1RM: dp.topEstimatedOneRepMax,
        bestReps: dp.topRepCount ?? null,
      });
    } else {
      if (dp.date > existing.sortDate) existing.sortDate = dp.date;
      if (
        dp.topEstimatedOneRepMax != null &&
        (existing.bestE1RM == null || dp.topEstimatedOneRepMax > existing.bestE1RM)
      ) {
        existing.bestE1RM = dp.topEstimatedOneRepMax;
      }
      if (
        dp.topRepCount != null &&
        (existing.bestReps == null || dp.topRepCount > existing.bestReps)
      ) {
        existing.bestReps = dp.topRepCount;
      }
    }
  }

  const recentSeasonKeys = new Set(
    [...seasonBuckets.entries()]
      .sort((a, b) => b[1].sortDate.localeCompare(a[1].sortDate))
      .slice(0, 3)
      .map(([key]) => key)
  );

  let recentMax: number | null = null;
  for (const [key, bucket] of seasonBuckets.entries()) {
    if (!recentSeasonKeys.has(key) || bucket.bestE1RM == null) continue;
    if (recentMax == null || bucket.bestE1RM > recentMax) {
      recentMax = bucket.bestE1RM;
    }
  }

  // No substitution needed if recent max matches or exceeds the historical best.
  if (historicalBest != null && recentMax != null && recentMax >= historicalBest) {
    recentMax = null;
  }

  let recentMaxReps: number | null = null;
  for (const [key, bucket] of seasonBuckets.entries()) {
    if (!recentSeasonKeys.has(key) || bucket.bestReps == null) continue;
    if (recentMaxReps == null || bucket.bestReps > recentMaxReps) {
      recentMaxReps = bucket.bestReps;
    }
  }

  // No substitution needed if the all-time rep best was matched recently.
  if (historicalBestReps != null && recentMaxReps != null && recentMaxReps >= historicalBestReps) {
    recentMaxReps = null;
  }

  return { historicalBest, recentMax, historicalBestReps, recentMaxReps };
}

function buildAnalyzedSetList(
  currentSets: ExerciseSet[],
  allHistoricalSets: ExerciseSet[],
  effectiveE1RM: number | null = null,
  effectiveBaselineReps: number | null = null,
  prescribedRepTarget: number | null = null,
  prescribedWeight: number | null = null
): AnalyzedExerciseSet[] {
  return currentSets.map((set) => {
    const priorSets = allHistoricalSets.filter((candidate) => {
      if (candidate.exerciseInstanceId !== set.exerciseInstanceId) {
        // When effectiveE1RM is supplied it replaces cross-session history as the
        // intensity baseline, so there is no need to scan all prior sessions.
        return effectiveE1RM == null;
      }

      return candidate.setIndex < set.setIndex;
    });

    return {
      set,
      analysis: analyzeSet(set, priorSets, effectiveE1RM, effectiveBaselineReps, prescribedRepTarget, prescribedWeight),
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

  // Week template may have been deleted (e.g. season template cascade). Synthesise
  // a minimal stub so historical session views remain readable — targetRir is the
  // only field used in computation and it is superseded by weekInstance.rirTarget.
  const weekTemplate = await getWeekTemplateById(weekInstance.weekTemplateId) ?? {
    id: weekInstance.weekTemplateId,
    seasonTemplateId: "",
    name: "",
    order: weekInstance.order,
  };

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

  // Load the session instance exercise snapshot (the season-start copy).
  const sie = await getById<SessionInstanceExercise>(
    STORE_NAMES.sessionInstanceExercises,
    exerciseInstance.sessionInstanceExerciseId
  );
  if (!sie) {
    return undefined;
  }

  // Build a SessionTemplate-shaped view from the instance's stored session name.
  const sessionTemplate: SessionTemplate = {
    id: sessionInstance.sessionTemplateId,
    seasonTemplateId: seasonInstance.seasonTemplateId,
    name: sessionInstance.sessionName,
    order: 0,
  };

  // Build an ExerciseTemplate-shaped object from the snapshot so all downstream
  // consumers work without changes.
  const exerciseTemplate: ExerciseTemplate = {
    id: sie.sourceExerciseTemplateId,
    sessionTemplateMuscleGroupId: sie.sessionInstanceMuscleGroupId,
    movementTypeId: sie.movementTypeId,
    exerciseName: sie.exerciseName,
    weightMode: sie.weightMode,
    prescribedWeight: sie.prescribedWeight,
    weightIncrement: sie.weightIncrement,
    availableWeights: sie.availableWeights,
  };

  const movementType = await getMovementTypeById(sie.movementTypeId);
  if (!movementType) {
    return undefined;
  }

  const isBodyweight = sie.weightMode === "bodyweight";

  // History is matched by exercise name (not template ID) so that:
  // - Multiple templates for the same exercise (e.g. "Bench Press" in two
  //   different sessions) share a unified history.
  // - Deleted templates don't orphan prior session data — ExerciseInstance
  //   carries a denormalised exerciseName for exactly this purpose.
  const normalizedExerciseName = exerciseTemplate.exerciseName.trim().toLowerCase();
  const allMatchingInstances = (
    await getAll<ExerciseInstance>(STORE_NAMES.exerciseInstances)
  ).filter(
    (inst) => (inst.exerciseName ?? "").trim().toLowerCase() === normalizedExerciseName
  );

  const realSetsByInstance = await Promise.all(
    allMatchingInstances.map((inst) => getExerciseSetsForExerciseInstance(inst.id))
  );
  const realHistoricalSets: ExerciseSet[] = realSetsByInstance.flat().sort((a, b) => {
    if (a.exerciseInstanceId !== b.exerciseInstanceId) {
      return a.exerciseInstanceId.localeCompare(b.exerciseInstanceId);
    }
    return a.setIndex - b.setIndex;
  });

  const allHistoricalSets = await mergeWithImportedSets(
    exerciseTemplate.exerciseName,
    realHistoricalSets,
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

  // ── Recent-max computation ────────────────────────────────────────────────
  // If the all-time best e1RM hasn't been matched within the last three seasons
  // where this exercise was actually attempted, substitute a "recent max" so
  // that intensity targets remain fair and achievable.
  //
  // Season membership uses resolveExerciseSeasonKey — the same logic as the
  // ExerciseInsights chart — so real SeasonInstance IDs and calendar-month
  // pseudo-seasons for imported data are handled identically in both places.

  // Build a session-level map from exerciseInstanceId → { seasonKey, date }.
  // seasonKey = SeasonInstance ID for real sessions; no SeasonInstance lookup
  // needed since SessionInstance already carries seasonInstanceId directly.
  type InstanceMeta = { seasonKey: string; date: string };
  const instanceMetaMap = new Map<string, InstanceMeta>();

  await Promise.all(
    allMatchingInstances
      .filter((inst) => inst.id !== exerciseInstance.id)
      .map(async (inst) => {
        const instSession = await getSessionInstanceById(inst.sessionInstanceId);
        if (!instSession) return;
        instanceMetaMap.set(inst.id, {
          seasonKey: resolveExerciseSeasonKey(instSession.seasonInstanceId, instSession.date),
          date: sessionCompletedDate(instSession),
        });
      })
  );

  // One bucket per season key — tracks the most-recent session date (for
  // chronological ordering) and the best e1RM / best reps with their dates.
  type SeasonBucket = {
    sortDate: string;
    bestE1RM: number | null;
    bestDate: string | null;
    bestReps: number | null;
    bestRepsDate: string | null;
  };
  const seasonBuckets = new Map<string, SeasonBucket>();

  function mergeIntoBucket(
    key: string,
    date: string,
    e1rm: number | null,
    reps: number | null = null
  ): void {
    const existing = seasonBuckets.get(key);
    if (!existing) {
      seasonBuckets.set(key, {
        sortDate: date,
        bestE1RM: e1rm,
        bestDate: e1rm != null ? date : null,
        bestReps: reps,
        bestRepsDate: reps != null ? date : null,
      });
    } else {
      if (date > existing.sortDate) existing.sortDate = date;
      if (e1rm != null && (existing.bestE1RM == null || e1rm > existing.bestE1RM)) {
        existing.bestE1RM = e1rm;
        existing.bestDate = date;
      }
      if (reps != null && (existing.bestReps == null || reps > existing.bestReps)) {
        existing.bestReps = reps;
        existing.bestRepsDate = date;
      }
    }
  }

  // Current season always participates, even on a first attempt.
  mergeIntoBucket(seasonInstance.id, sessionCompletedDate(sessionInstance), null, null);

  // Real prior sets.
  for (const set of priorHistoricalSets) {
    if (set.exerciseInstanceId === "__imported__") continue;
    const meta = instanceMetaMap.get(set.exerciseInstanceId);
    if (!meta) continue;
    mergeIntoBucket(
      meta.seasonKey,
      meta.date,
      calculateEstimatedOneRepMax(set.performedWeight, set.performedReps),
      set.performedReps ?? null
    );
  }

  // Imported sets — grouped into calendar-month pseudo-seasons using raw
  // ImportedSet records (which carry dates, unlike the merged ExerciseSet view).
  const allRawImported = await loadAllImportedSets();
  for (const s of allRawImported) {
    if (s.exerciseName.trim().toLowerCase() !== normalizedExerciseName) continue;
    if (s.reps <= 0) continue;
    const e1rm = !isBodyweight && s.weight > 0
      ? calculateEstimatedOneRepMax(s.weight, s.reps)
      : null;
    mergeIntoBucket(resolveExerciseSeasonKey(null, s.date), s.date, e1rm, s.reps);
  }

  // Sort buckets by most-recent activity (newest first) and take the top 3.
  const recentSeasonKeys = new Set(
    [...seasonBuckets.entries()]
      .sort((a, b) => b[1].sortDate.localeCompare(a[1].sortDate))
      .slice(0, 3)
      .map(([key]) => key)
  );

  // Historical best date — from whichever bucket produced the all-time best e1RM.
  let historicalBestDate: string | null = null;
  for (const bucket of seasonBuckets.values()) {
    if (
      bucket.bestE1RM != null &&
      historicalBestEstimatedOneRepMax != null &&
      bucket.bestE1RM >= historicalBestEstimatedOneRepMax
    ) {
      historicalBestDate = bucket.bestDate;
      break;
    }
  }

  // Recent max — best e1RM across the three most-recent season buckets.
  let recentMaxEstimatedOneRepMax: number | null = null;
  let recentMaxDate: string | null = null;
  for (const [key, bucket] of seasonBuckets.entries()) {
    if (!recentSeasonKeys.has(key) || bucket.bestE1RM == null) continue;
    if (recentMaxEstimatedOneRepMax == null || bucket.bestE1RM > recentMaxEstimatedOneRepMax) {
      recentMaxEstimatedOneRepMax = bucket.bestE1RM;
      recentMaxDate = bucket.bestDate;
    }
  }

  // No substitution needed if the all-time best was already matched within
  // the recent seasons (recentMax ≥ historicalBest).
  if (
    recentMaxEstimatedOneRepMax != null &&
    historicalBestEstimatedOneRepMax != null &&
    recentMaxEstimatedOneRepMax >= historicalBestEstimatedOneRepMax
  ) {
    recentMaxEstimatedOneRepMax = null;
    recentMaxDate = null;
  }

  // Recent max reps — best rep count across the three most-recent season buckets.
  let recentMaxReps: number | null = null;
  let recentMaxRepsDate: string | null = null;
  for (const [key, bucket] of seasonBuckets.entries()) {
    if (!recentSeasonKeys.has(key) || bucket.bestReps == null) continue;
    if (recentMaxReps == null || bucket.bestReps > recentMaxReps) {
      recentMaxReps = bucket.bestReps;
      recentMaxRepsDate = bucket.bestRepsDate;
    }
  }
  // No substitution needed if the all-time rep best was matched recently.
  if (recentMaxReps != null && historicalBestReps != null && recentMaxReps >= historicalBestReps) {
    recentMaxReps = null;
    recentMaxRepsDate = null;
  }
  // ─────────────────────────────────────────────────────────────────────────

  const weekRir =
    weekInstance.rirTarget ??
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
    // Use the recent max when available so targets stay fair after a long gap.
    const effectiveReps = recentMaxReps ?? historicalBestReps;
    if (effectiveReps != null) {
      prescribedRepTarget = Math.max(1, effectiveReps - weekRir);
    }
  } else if (
    historicalBestEstimatedOneRepMax != null &&
    exerciseTemplate.prescribedWeight != null &&
    exerciseTemplate.prescribedWeight > 0
  ) {
    // Weight is fixed by the user's settings choice.
    // Reps float: 0 RIR = max reps at this weight without exceeding e1RM.
    // Use the recent max when available so targets stay fair after a long gap.
    const effectiveOneRepMax = recentMaxEstimatedOneRepMax ?? historicalBestEstimatedOneRepMax;

    // If the configured weight exceeds the effective e1RM the rep formula
    // produces nonsense (negative reps). Leave the target blank until a
    // proper solution is in place.
    if (exerciseTemplate.prescribedWeight < effectiveOneRepMax) {
      prescribedWeight = exerciseTemplate.prescribedWeight;
      const zeroRirReps = Math.floor(
        (effectiveOneRepMax / prescribedWeight - 1) * 30 + 0.0001
      );
      prescribedRepTarget = Math.max(1, zeroRirReps - weekRir);
    }
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
    historicalBestDate,
    recentMaxEstimatedOneRepMax,
    recentMaxDate,
    recentMaxReps,
    recentMaxRepsDate,
    targetEstimatedOneRepMax,
    effectiveRir: weekRir,
    sets: buildAnalyzedSetList(
      currentSets,
      allHistoricalSets,
      recentMaxEstimatedOneRepMax ?? historicalBestEstimatedOneRepMax,
      recentMaxReps ?? historicalBestReps,
      exerciseInstance.prescribedRepTarget ?? null,
      exerciseInstance.prescribedWeight ?? null
    ),
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

  // Week template may have been deleted (e.g. season template cascade). Synthesise
  // a minimal stub so historical session views remain readable — targetRir is the
  // only field used in computation and it is superseded by weekInstance.rirTarget.
  const weekTemplate = await getWeekTemplateById(weekInstance.weekTemplateId) ?? {
    id: weekInstance.weekTemplateId,
    seasonTemplateId: "",
    name: "",
    order: weekInstance.order,
  };

  const seasonInstance = await getSeasonInstanceById(
    sessionInstance.seasonInstanceId
  );
  if (!seasonInstance) {
    return undefined;
  }

  // Build a SessionTemplate-shaped view from the instance's frozen session name
  // so the display stays correct even if the template is later renamed.
  const sessionTemplate: SessionTemplate = {
    id: sessionInstance.sessionTemplateId,
    seasonTemplateId: seasonInstance.seasonTemplateId,
    name: sessionInstance.sessionName,
    order: 0,
  };

  const seasonTemplate = await getSeasonTemplateById(seasonInstance.seasonTemplateId);

  const effectiveRir =
    seasonTemplate?.rirSequence?.[weekInstance.order - 1] ??
    weekTemplate.targetRir ??
    0;

  // Load the season-start snapshots — the source of truth for this session's
  // exercise structure, fully isolated from future template edits.
  const simgs = (
    await getAllByIndex<SessionInstanceMuscleGroup>(
      STORE_NAMES.sessionInstanceMuscleGroups,
      "bySessionInstanceId",
      sessionInstanceId
    )
  ).sort((a, b) => a.order - b.order);

  const allMuscleGroups = await getAll<MuscleGroup>(STORE_NAMES.muscleGroups);
  const muscleGroupMap = new Map(allMuscleGroups.map((g) => [g.id, g]));

  const allMovementTypes = await getAll<MovementType>(STORE_NAMES.movementTypes);
  const movementTypeMap = new Map(allMovementTypes.map((m) => [m.id, m]));

  const exerciseInstances = await getExerciseInstancesForSessionInstance(
    sessionInstance.id
  );
  const instanceBySieId = new Map(
    exerciseInstances.map((ei) => [ei.sessionInstanceExerciseId, ei])
  );

  const muscleGroups: SessionInstanceMuscleGroupView[] = [];

  for (const simg of simgs) {
    const muscleGroup = muscleGroupMap.get(simg.muscleGroupId);
    if (!muscleGroup) continue;

    // Build a SessionTemplateMuscleGroup-shaped object so consumers don't need
    // to know about the instance-level record type.
    const sessionTemplateMuscleGroup: SessionTemplateMuscleGroup = {
      id: simg.id,
      sessionTemplateId: sessionInstance.sessionTemplateId,
      muscleGroupId: simg.muscleGroupId,
      order: simg.order,
      targetWorkingSets: simg.targetWorkingSets,
    };

    const sies = (
      await getAllByIndex<SessionInstanceExercise>(
        STORE_NAMES.sessionInstanceExercises,
        "bySessionInstanceMuscleGroupId",
        simg.id
      )
    ).sort((a, b) => a.id.localeCompare(b.id));

    const hydratedExercises: SessionInstanceExerciseView[] = [];

    for (const sie of sies) {
      const movementType = movementTypeMap.get(sie.movementTypeId);
      if (!movementType) continue;

      // Build ExerciseTemplate-shaped object from the snapshot.
      const exerciseTemplate: ExerciseTemplate = {
        id: sie.sourceExerciseTemplateId,
        sessionTemplateMuscleGroupId: sie.sessionInstanceMuscleGroupId,
        movementTypeId: sie.movementTypeId,
        exerciseName: sie.exerciseName,
        weightMode: sie.weightMode,
        prescribedWeight: sie.prescribedWeight,
        weightIncrement: sie.weightIncrement,
        availableWeights: sie.availableWeights,
      };

      const exerciseInstance = instanceBySieId.get(sie.id) ?? null;

      const allHistoricalSets = await mergeWithImportedSets(
        sie.exerciseName,
        await getExerciseSetsByName(sie.exerciseName)
      );

      const currentRawSets = exerciseInstance
        ? allHistoricalSets
            .filter((s) => s.exerciseInstanceId === exerciseInstance.id)
            .sort((a, b) => a.setIndex - b.setIndex)
        : [];

      const { historicalBest, recentMax, historicalBestReps, recentMaxReps } = await getEffectiveE1RM(
        sie.exerciseName,
        sessionInstance.seasonInstanceId
      );
      const effectiveE1RM = recentMax ?? historicalBest;
      // For bodyweight exercises, use the same recency-adjusted rep baseline as
      // getExerciseInstanceView so stale PRs don't inflate the warmup threshold.
      const effectiveBaselineReps =
        sie.weightMode === "bodyweight" ? (recentMaxReps ?? historicalBestReps) : null;

      const analyzedSets = buildAnalyzedSetList(currentRawSets, allHistoricalSets, effectiveE1RM, effectiveBaselineReps, exerciseInstance?.prescribedRepTarget ?? null, exerciseInstance?.prescribedWeight ?? null);

      const workingSetCount = analyzedSets.filter(
        (item) => item.analysis.setType === "working"
      ).length;

      const warmupSetCount = analyzedSets.filter(
        (item) => item.analysis.setType === "warmup"
      ).length;

      hydratedExercises.push({
        sessionInstanceExerciseId: sie.id,
        exerciseTemplate,
        movementType,
        exerciseInstance,
        sets: analyzedSets,
        workingSetCount,
        warmupSetCount,
        effectiveE1RM,
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
    effectiveRir,
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

export interface SeasonCalendarWeek {
  weekOrder: number;
  /** Present for generated weeks; null for future weeks not yet created. */
  weekInstance: WeekInstance | null;
  sessions: Array<{
    sessionName: string;
    scheduledDate: string;
    /** Present only for generated weeks. */
    sessionInstance: SessionInstance | null;
  }>;
  restDayCount: number;
}

/**
 * Returns a full-season calendar view mixing actual instance data (for
 * generated weeks) with live-template projections (for future weeks).
 *
 * Future-week dates use the current week template item count so the calendar
 * stays accurate after structural edits to the program. They are clearly
 * approximate — the exact dates are fixed only when a week is generated.
 */
export async function getSeasonCalendarWeeks(
  seasonInstanceId: string
): Promise<SeasonCalendarWeek[]> {
  const seasonInstance = await getSeasonInstanceById(seasonInstanceId);
  if (!seasonInstance) return [];

  const seasonTemplate = await getById<SeasonTemplate>(
    STORE_NAMES.seasonTemplates,
    seasonInstance.seasonTemplateId
  );
  if (!seasonTemplate) return [];

  const weekCount = seasonTemplate.rirSequence?.length ?? seasonTemplate.plannedWeekCount ?? 0;

  // Load all generated week instances and their sessions keyed by week order.
  const generatedWeeks = await getWeekInstancesForSeasonInstance(seasonInstanceId);
  const weekByOrder = new Map(generatedWeeks.map((w) => [w.order, w]));

  const sessionsByWeekInstanceId = new Map<string, SessionInstance[]>();
  await Promise.all(
    generatedWeeks.map(async (w) => {
      sessionsByWeekInstanceId.set(w.id, await getSessionInstancesForWeekInstance(w.id));
    })
  );

  // Load current template structure for projecting future weeks.
  const allWeekTemplates = await getAll<WeekTemplate>(STORE_NAMES.weekTemplates);
  const canonicalWeekTemplate = allWeekTemplates
    .filter((wt) => wt.seasonTemplateId === seasonTemplate.id)
    .sort((a, b) => a.order - b.order)[0];

  let weekTemplateItems: WeekTemplateItem[] = [];
  const sessionTemplateById = new Map<string, SessionTemplate>();

  if (canonicalWeekTemplate) {
    weekTemplateItems = (
      await getAllByIndex<WeekTemplateItem>(
        STORE_NAMES.weekTemplateItems,
        "byWeekTemplateId",
        canonicalWeekTemplate.id
      )
    ).sort((a, b) => a.order - b.order);

    const stIds = [
      ...new Set(
        weekTemplateItems
          .filter((i) => i.type === "session" && i.sessionTemplateId)
          .map((i) => i.sessionTemplateId!)
      ),
    ];
    await Promise.all(
      stIds.map(async (id) => {
        const st = await getById<SessionTemplate>(STORE_NAMES.sessionTemplates, id);
        if (st) sessionTemplateById.set(id, st);
      })
    );
  }

  const baseDate = new Date(seasonInstance.startedAt ?? new Date().toISOString());
  const itemCount = weekTemplateItems.length;

  const result: SeasonCalendarWeek[] = [];

  for (let weekOrder = 1; weekOrder <= weekCount; weekOrder++) {
    const weekInstance = weekByOrder.get(weekOrder) ?? null;
    const weekIndex = weekOrder - 1;

    if (weekInstance) {
      const sessions = (sessionsByWeekInstanceId.get(weekInstance.id) ?? []).map(
        (si) => ({
          sessionName: si.sessionName,
          scheduledDate: si.date,
          sessionInstance: si,
        })
      );
      const restDayCount =
        weekTemplateItems.filter((i) => i.type === "rest").length;
      result.push({ weekOrder, weekInstance, sessions, restDayCount });
    } else {
      // Project from the current template — dates are approximate.
      const sessions = weekTemplateItems
        .filter((i) => i.type === "session" && i.sessionTemplateId)
        .map((i) => {
          const projectedDate = new Date(baseDate);
          const offsetDays = weekIndex * itemCount + (i.order - 1);
          projectedDate.setUTCDate(projectedDate.getUTCDate() + offsetDays);
          const st = sessionTemplateById.get(i.sessionTemplateId!);
          return {
            sessionName: st?.name ?? "",
            scheduledDate: projectedDate.toISOString(),
            sessionInstance: null,
          };
        });
      const restDayCount = weekTemplateItems.filter((i) => i.type === "rest").length;
      result.push({ weekOrder, weekInstance: null, sessions, restDayCount });
    }
  }

  return result;
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

export async function getWeekInstanceItemsForWeekInstance(
  weekInstanceId: string
): Promise<WeekInstanceItem[]> {
  const items = await getAllByIndex<WeekInstanceItem>(
    STORE_NAMES.weekInstanceItems,
    "byWeekInstanceId",
    weekInstanceId
  );
  return items.sort((a, b) => a.order - b.order);
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

function createExerciseInstanceId(sessionInstanceExerciseId: string) {
  return `exercise-instance-${sessionInstanceExerciseId}-${Date.now()}`;
}

export async function ensureExerciseInstance(
  sessionInstanceId: string,
  sessionInstanceExerciseId: string
): Promise<ExerciseInstance | undefined> {
  const existing = await getAllByIndex<ExerciseInstance>(
    STORE_NAMES.exerciseInstances,
    "bySessionAndExercise",
    [sessionInstanceId, sessionInstanceExerciseId]
  );

  if (existing[0]) {
    return existing[0];
  }

  const sessionInstance = await getSessionInstanceById(sessionInstanceId);
  if (!sessionInstance) {
    return undefined;
  }

  const sie = await getById<SessionInstanceExercise>(
    STORE_NAMES.sessionInstanceExercises,
    sessionInstanceExerciseId
  );
  if (!sie) {
    return undefined;
  }

  const weekInstance = await getWeekInstanceById(sessionInstance.weekInstanceId);
  const weekTemplate = weekInstance
    ? await getWeekTemplateById(weekInstance.weekTemplateId)
    : undefined;

  const exerciseInstance: ExerciseInstance = {
    id: createExerciseInstanceId(sessionInstanceExerciseId),
    sessionInstanceId,
    sessionInstanceExerciseId,
    exerciseName: sie.exerciseName,
    status: "not_started",
    startedAt: null,
    completedAt: null,
    prescribedWeight: null,
    prescribedRepTarget: null,
    prescribedRir: weekInstance?.rirTarget ?? weekTemplate?.targetRir ?? null,
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

  // Complete any exercise instances that were started but left in_progress.
  // Exercises that were never started (not_started) are left untouched.
  const exerciseInstances = await getExerciseInstancesForSessionInstance(sessionInstanceId);
  await Promise.all(
    exerciseInstances
      .filter((e) => e.status === "in_progress")
      .map((e) => completeExerciseInstance(e.id))
  );

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

  const currentSeasonInstance = await getSeasonInstanceById(
    weekInstance.seasonInstanceId
  );
  if (!currentSeasonInstance) return updatedSession;

  const seasonTemplate = await getById<SeasonTemplate>(
    STORE_NAMES.seasonTemplates,
    currentSeasonInstance.seasonTemplateId
  );
  if (!seasonTemplate) return updatedSession;

  const weekCount = seasonTemplate.rirSequence?.length ?? seasonTemplate.plannedWeekCount;

  if (completedWeek.order < weekCount) {
    // Generate the next week fresh from the current template state. Any edits
    // made to the program since the last week was generated are picked up here.
    await populateWeekFromTemplate(
      seasonTemplate,
      weekInstance.seasonInstanceId,
      currentSeasonInstance.startedAt ?? new Date().toISOString(),
      completedWeek.order + 1
    );
    return updatedSession;
  }

  const completedSeasonInstance: SeasonInstance = {
    ...currentSeasonInstance,
    status: "completed",
    completedAt: currentSeasonInstance.completedAt ?? nowIso,
  };

  await putItem(STORE_NAMES.seasonInstances, completedSeasonInstance);

  return updatedSession;
}

// ─── Session PRs ─────────────────────────────────────────────────────────────

export interface SessionPR {
  prType: "e1rm" | "reps";
  exerciseName: string;
  newE1RM: number | null;   // null for reps-type PRs
  newWeight: number | null; // null for reps-type PRs
  newReps: number;
  previousE1RM: number | null;
  previousWeight: number | null;
  previousReps: number | null;
  previousDate: string | null;
}

/** Resolves the date of the previous best set for PR display. */
async function resolvePreviousDate(
  previousTopSet: ExerciseSet | null,
  priorInstances: ExerciseInstance[]
): Promise<string | null> {
  if (previousTopSet == null || previousTopSet.exerciseInstanceId === "__imported__") return null;
  const prevExInst = priorInstances.find((i) => i.id === previousTopSet.exerciseInstanceId);
  if (!prevExInst) return null;
  const prevSession = await getSessionInstanceById(prevExInst.sessionInstanceId);
  return prevSession ? sessionCompletedDate(prevSession) : null;
}

/**
 * Returns exercises where the session produced a genuine all-time PR.
 *
 * Rules:
 *  - Must have at least 1 prior exercise instance (only the very first is excluded).
 *  - Weighted exercises: top set e1RM must beat all-time prior best e1RM.
 *  - Bodyweight exercises: max reps in a single set must beat all-time prior max reps.
 */
/**
 * Shared PR-detection logic: given a set of exercise instances that are "in
 * scope" (the session/week/season being checked) and the full corpus of all
 * exercise instances for the same exercise name, find new all-time PRs.
 */
async function detectPRsForInstances(
  _scopedInstances: ExerciseInstance[],
  scopedInstanceIds: Set<string>,
  exerciseName: string,
  isBodyweight: boolean,
  priorInstances: ExerciseInstance[]
): Promise<SessionPR[]> {
  const prs: SessionPR[] = [];
  const nativeSets = await getExerciseSetsByName(exerciseName);
  const allSets = await mergeWithImportedSets(exerciseName, nativeSets, isBodyweight);

  const scopedSets = allSets.filter((s) => scopedInstanceIds.has(s.exerciseInstanceId));
  const priorInstanceIds = new Set(priorInstances.map((i) => i.id));
  const priorSets = allSets.filter((s) => priorInstanceIds.has(s.exerciseInstanceId));

  if (isBodyweight) {
    let newMaxReps: number | null = null;
    let newTopSet: ExerciseSet | null = null;
    for (const s of scopedSets) {
      if (s.performedReps != null && (newMaxReps === null || s.performedReps > newMaxReps)) {
        newMaxReps = s.performedReps;
        newTopSet = s;
      }
    }
    if (newMaxReps === null || newTopSet === null) return prs;

    let previousMaxReps: number | null = null;
    let previousTopSet: ExerciseSet | null = null;
    for (const s of priorSets) {
      if (s.performedReps != null && (previousMaxReps === null || s.performedReps > previousMaxReps)) {
        previousMaxReps = s.performedReps;
        previousTopSet = s;
      }
    }

    if (previousMaxReps === null || newMaxReps > previousMaxReps) {
      prs.push({
        prType: "reps",
        exerciseName,
        newE1RM: null,
        newWeight: null,
        newReps: newMaxReps,
        previousE1RM: null,
        previousWeight: null,
        previousReps: previousMaxReps,
        previousDate: await resolvePreviousDate(previousTopSet, priorInstances),
      });
    }
  } else {
    let newE1RM: number | null = null;
    let newTopSet: ExerciseSet | null = null;
    for (const s of scopedSets) {
      const e1rm = calculateEstimatedOneRepMax(s.performedWeight, s.performedReps);
      if (e1rm != null && (newE1RM === null || e1rm > newE1RM)) {
        newE1RM = e1rm;
        newTopSet = s;
      }
    }
    if (newE1RM === null || newTopSet === null) return prs;

    let previousE1RM: number | null = null;
    let previousTopSet: ExerciseSet | null = null;
    for (const s of priorSets) {
      const e1rm = calculateEstimatedOneRepMax(s.performedWeight, s.performedReps);
      if (e1rm != null && (previousE1RM === null || e1rm > previousE1RM)) {
        previousE1RM = e1rm;
        previousTopSet = s;
      }
    }

    if (previousE1RM === null || newE1RM > previousE1RM) {
      prs.push({
        prType: "e1rm",
        exerciseName,
        newE1RM,
        newWeight: newTopSet.performedWeight!,
        newReps: newTopSet.performedReps!,
        previousE1RM,
        previousWeight: previousTopSet?.performedWeight ?? null,
        previousReps: previousTopSet?.performedReps ?? null,
        previousDate: await resolvePreviousDate(previousTopSet, priorInstances),
      });
    }
  }

  return prs;
}

/**
 * Groups exercise instances by normalised exercise name and returns each group
 * alongside the "prior" instances (all instances for that name NOT in the group)
 * and whether the exercise is bodyweight.
 */
async function groupInstancesByName(
  scopedInstances: ExerciseInstance[]
): Promise<
  Array<{
    exerciseName: string;
    scopedInstanceIds: Set<string>;
    priorInstances: ExerciseInstance[];
    isBodyweight: boolean;
  }>
> {
  const byName = new Map<string, ExerciseInstance[]>();
  for (const ei of scopedInstances) {
    const key = ei.exerciseName.trim().toLowerCase();
    const list = byName.get(key) ?? [];
    list.push(ei);
    byName.set(key, list);
  }

  const allInstances = await getAll<ExerciseInstance>(STORE_NAMES.exerciseInstances);

  const groups: Awaited<ReturnType<typeof groupInstancesByName>> = [];

  for (const [, instances] of byName) {
    const exerciseName = instances[0].exerciseName;
    const normalizedName = exerciseName.trim().toLowerCase();
    const scopedInstanceIds = new Set(instances.map((i) => i.id));

    const allForName = allInstances.filter(
      (i) => i.exerciseName.trim().toLowerCase() === normalizedName
    );
    const priorInstances = allForName.filter((i) => !scopedInstanceIds.has(i.id));

    if (priorInstances.length < 1) continue;

    // Determine bodyweight status from the SessionInstanceExercise snapshot.
    const sie = await getById<SessionInstanceExercise>(
      STORE_NAMES.sessionInstanceExercises,
      instances[0].sessionInstanceExerciseId
    );
    // Fall back to template lookup for robustness.
    const isBodyweight = sie
      ? sie.weightMode === "bodyweight"
      : false;

    groups.push({ exerciseName, scopedInstanceIds, priorInstances, isBodyweight });
  }

  return groups;
}

export async function getSessionPRs(sessionInstanceId: string): Promise<SessionPR[]> {
  const exerciseInstances = await getExerciseInstancesForSessionInstance(sessionInstanceId);
  const groups = await groupInstancesByName(exerciseInstances);
  const prs: SessionPR[] = [];
  for (const g of groups) {
    prs.push(...await detectPRsForInstances(
      exerciseInstances.filter((i) => g.scopedInstanceIds.has(i.id)),
      g.scopedInstanceIds,
      g.exerciseName,
      g.isBodyweight,
      g.priorInstances
    ));
  }
  return prs;
}

// ─── Week PRs ─────────────────────────────────────────────────────────────────

/**
 * Returns exercises where the week produced a genuine all-time e1RM PR.
 *
 * Same rules as getSessionPRs, but scoped to the full week:
 *  - Groups all exercise instances across every session in the week by name.
 *  - Must have at least 1 prior instance from OUTSIDE this week.
 *  - The best e1RM achieved anywhere in the week must beat all prior history.
 *  - Multiple PRs for the same exercise within the week collapse into one entry.
 */
export async function getWeekPRs(weekInstanceId: string): Promise<SessionPR[]> {
  const weekSessions = await getSessionInstancesForWeekInstance(weekInstanceId);
  const allWeekExerciseInstances: ExerciseInstance[] = (
    await Promise.all(weekSessions.map((s) => getExerciseInstancesForSessionInstance(s.id)))
  ).flat();

  const groups = await groupInstancesByName(allWeekExerciseInstances);
  const prs: SessionPR[] = [];
  for (const g of groups) {
    prs.push(...await detectPRsForInstances(
      allWeekExerciseInstances.filter((i) => g.scopedInstanceIds.has(i.id)),
      g.scopedInstanceIds,
      g.exerciseName,
      g.isBodyweight,
      g.priorInstances
    ));
  }
  return prs;
}

// ─── Season PRs ───────────────────────────────────────────────────────────────

/**
 * Returns exercises where the season produced a genuine all-time e1RM PR.
 *
 * Same rules as getWeekPRs, but scoped to the full season:
 *  - Groups all exercise instances across every session in every week by name.
 *  - Must have at least 1 prior instance from OUTSIDE this season.
 *  - The best e1RM achieved anywhere in the season must beat all prior history.
 *  - Multiple PRs for the same exercise within the season collapse into one entry.
 *  - previousE1RM is the all-time best BEFORE the season started.
 */
export async function getSeasonPRs(seasonInstanceId: string): Promise<SessionPR[]> {
  const seasonWeeks = await getWeekInstancesForSeasonInstance(seasonInstanceId);
  const allSeasonSessions: SessionInstance[] = (
    await Promise.all(seasonWeeks.map((w) => getSessionInstancesForWeekInstance(w.id)))
  ).flat();
  const allSeasonExerciseInstances: ExerciseInstance[] = (
    await Promise.all(allSeasonSessions.map((s) => getExerciseInstancesForSessionInstance(s.id)))
  ).flat();

  const groups = await groupInstancesByName(allSeasonExerciseInstances);
  const prs: SessionPR[] = [];
  for (const g of groups) {
    prs.push(...await detectPRsForInstances(
      allSeasonExerciseInstances.filter((i) => g.scopedInstanceIds.has(i.id)),
      g.scopedInstanceIds,
      g.exerciseName,
      g.isBodyweight,
      g.priorInstances
    ));
  }
  return prs;
}

// ─── Dashboard helpers ────────────────────────────────────────────────────────

export async function getLastCompletedSessionInstance(): Promise<SessionInstance | null> {
  const all = await getAll<SessionInstance>(STORE_NAMES.sessionInstances);
  const sorted = all
    .filter((s) => s.status === "completed" && s.completedAt != null)
    .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!));
  return sorted[0] ?? null;
}

export async function getLastCompletedWeekInstance(): Promise<WeekInstance | null> {
  const all = await getAll<WeekInstance>(STORE_NAMES.weekInstances);
  const sorted = all
    .filter((w) => w.status === "completed" && w.completedAt != null)
    .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!));
  return sorted[0] ?? null;
}

export async function getLastCompletedSeasonInstance(): Promise<SeasonInstance | null> {
  const all = await getAll<SeasonInstance>(STORE_NAMES.seasonInstances);
  const sorted = all
    .filter((s) => s.status === "completed" && s.completedAt != null)
    .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!));
  return sorted[0] ?? null;
}

/**
 * Computes season-level consistency: working days delivered / working days
 * the program would have prescribed in the elapsed time. Generated weeks use
 * their own snapshot; time past the last generated week extrapolates the
 * live canonical week pattern. Returns null for seasons with no elapsed time
 * or no expected sessions (e.g. cancelled the same day they started).
 */
export async function computeSeasonConsistencyForSeason(
  season: SeasonInstance
): Promise<number | null> {
  if (!season.startedAt || !season.completedAt) return null;

  const [weekInstances, canonicalWeek] = await Promise.all([
    getWeekInstancesForSeasonInstance(season.id),
    getCanonicalWeekTemplateForSeason(season.seasonTemplateId),
  ]);

  const weekData = await Promise.all(
    weekInstances.map(async (week) => {
      const [items, sessions] = await Promise.all([
        getWeekInstanceItemsForWeekInstance(week.id),
        getSessionInstancesForWeekInstance(week.id),
      ]);
      const completedSessionCount = sessions.filter((s) => s.status === "completed").length;
      return { week, items, completedSessionCount };
    })
  );

  const canonicalWeekItems = canonicalWeek
    ? await getWeekTemplateItemsForWeekTemplate(canonicalWeek.id)
    : [];

  return computeSeasonConsistency({
    startedAt: season.startedAt,
    endedAt: season.completedAt,
    weeks: weekData,
    canonicalWeekItems,
  });
}

/**
 * Most recent season that has ended, whether it was finished naturally or
 * cancelled (ended early). Cancelled seasons need an `endedAt` timestamp
 * (`completedAt`) to be ranked; older data without one is treated as completed-only.
 */
export async function getLastEndedSeasonInstance(): Promise<SeasonInstance | null> {
  const all = await getAll<SeasonInstance>(STORE_NAMES.seasonInstances);
  const sorted = all
    .filter(
      (s) =>
        (s.status === "completed" || s.status === "cancelled") &&
        s.completedAt != null
    )
    .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!));
  return sorted[0] ?? null;
}

/**
 * All-time personal-record events across every exercise, in descending date
 * order.  Each entry represents a moment when the user set a new all-time best
 * for an exercise.  Exercises with fewer than 4 logged sessions are excluded
 * so that first-ever lifts do not inflate the list.
 */
export interface PREvent {
  prType: "e1rm" | "reps";
  exerciseName: string;
  isBodyweight: boolean;
  newE1RM: number | null;
  newWeight: number | null;
  newReps: number;
  previousE1RM: number | null;
  previousReps: number | null;
  previousDate: string | null;
  date: string; // YYYY-MM-DD local date when this PR was set
}

export async function getAllTimePREvents(): Promise<PREvent[]> {
  const [allExerciseInstances, allImportedSets] = await Promise.all([
    getAll<ExerciseInstance>(STORE_NAMES.exerciseInstances),
    loadAllImportedSets(),
  ]);
  const exerciseNames = [
    ...new Set([
      ...allExerciseInstances
        .map((ei) => ei.exerciseName)
        .filter((n): n is string => typeof n === "string" && n.length > 0),
      ...allImportedSets
        .map((s) => s.exerciseName)
        .filter((n): n is string => typeof n === "string" && n.length > 0),
    ]),
  ];

  const allTemplates = await getAllExerciseTemplates();
  const templateByName = new Map(
    allTemplates.map((t) => [t.exerciseName.trim().toLowerCase(), t])
  );

  // Load all exercise histories in parallel
  const histories = await Promise.all(
    exerciseNames.map((name) =>
      getExerciseSessionHistory(name).then((h) => ({ name, history: h }))
    )
  );

  const allEvents: PREvent[] = [];

  for (const { name: exerciseName, history } of histories) {
    if (history.length < 2) continue;

    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));

    const templateKey = exerciseName.trim().toLowerCase();
    const template = templateByName.get(templateKey);
    const isBodyweight =
      template?.weightMode === "bodyweight" ||
      (!template && sorted.every((d) => !d.topWeight || d.topWeight === 0));

    let bestValue: number | null = null;
    let prevDate: string | null = null;
    let sessionIndex = 0;

    for (const dataPoint of sorted) {
      sessionIndex++;
      const currentValue = isBodyweight
        ? (dataPoint.topRepCount ?? null)
        : (dataPoint.topEstimatedOneRepMax ?? null);

      if (!currentValue || currentValue <= 0) continue;

      if (bestValue === null || currentValue > bestValue) {
        if (sessionIndex > 1 && bestValue !== null) {
          allEvents.push({
            prType: isBodyweight ? "reps" : "e1rm",
            exerciseName,
            isBodyweight,
            newE1RM: isBodyweight ? null : currentValue,
            newWeight: isBodyweight ? null : (dataPoint.topWeight ?? null),
            newReps: dataPoint.topReps ?? 0,
            previousE1RM: isBodyweight ? null : bestValue,
            previousReps: isBodyweight ? bestValue : null,
            previousDate: prevDate,
            date: dataPoint.date,
          });
        }
        prevDate = dataPoint.date;
        bestValue = currentValue;
      }
    }
  }

  return allEvents.sort((a, b) => b.date.localeCompare(a.date));
}

// ─── Active destination routing ───────────────────────────────────────────────

/**
 * Returns the route of the first active instance, in priority order:
 * in-progress session → /session/:id, active season → /week, else → /season.
 */
export async function getActiveDestinationRoute(): Promise<string> {
  const sessionInstances = await getAll<SessionInstance>(STORE_NAMES.sessionInstances);
  const activeSession = sessionInstances.find((i) => i.status === "in_progress");
  if (activeSession) return `/session/${activeSession.id}`;

  const activeSeason = await getActiveSeasonInstance();
  if (!activeSeason) return "/season";

  return "/week";
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
  // Guard: refuse deletion if any non-completed session instance still references
  // this template. Each session template maps to one day type — once that day is
  // completed its instance is frozen (SIE snapshots, snapshotted session name) and
  // the template is no longer needed. Not-started/in-progress sessions still rely
  // on the template for display and navigation, so block those.
  const allSessionInstances = await getAll<SessionInstance>(STORE_NAMES.sessionInstances);
  const activeRefs = allSessionInstances.filter(
    (s) => s.sessionTemplateId === id && s.status !== "completed"
  );
  if (activeRefs.length > 0) {
    throw new Error(
      "Cannot delete: this session template is used by one or more active sessions. Complete or cancel the current season first."
    );
  }

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
    // Only hard-delete templates that have never been snapshotted into a season.
    // Templates with SessionInstanceExercise records are still referenced by
    // historical session instance data and must be kept.
    const sies = await getAllByIndex<SessionInstanceExercise>(
      STORE_NAMES.sessionInstanceExercises,
      "bySourceExerciseTemplateId",
      exercise.id
    );
    if (sies.length === 0) {
      await deleteItem(STORE_NAMES.exerciseTemplates, exercise.id);
    }
  }
  await deleteItem(STORE_NAMES.sessionTemplateMuscleGroups, id);
}

export async function saveExerciseTemplate(
  template: ExerciseTemplate
): Promise<void> {
  await putItem(STORE_NAMES.exerciseTemplates, template);

  // Propagate weight-related changes to all SessionInstanceExercise snapshots
  // so that mid-season weight adjustments take effect immediately.
  const sies = await getAllByIndex<SessionInstanceExercise>(
    STORE_NAMES.sessionInstanceExercises,
    "bySourceExerciseTemplateId",
    template.id
  );
  for (const sie of sies) {
    const updated: SessionInstanceExercise = {
      ...sie,
      prescribedWeight: template.prescribedWeight ?? null,
      weightMode: template.weightMode,
      weightIncrement: template.weightIncrement,
      availableWeights: template.availableWeights,
    };
    await putItem(STORE_NAMES.sessionInstanceExercises, updated);
  }
}

export async function deleteExerciseTemplateById(id: string): Promise<void> {
  await deleteItem(STORE_NAMES.exerciseTemplates, id);
}

// ─── Session instance exercise store CRUD ────────────────────────────────────

export async function getSessionInstanceExercisesForSession(
  sessionInstanceId: string
): Promise<SessionInstanceExercise[]> {
  return getAllByIndex<SessionInstanceExercise>(
    STORE_NAMES.sessionInstanceExercises,
    "bySessionInstanceId",
    sessionInstanceId
  );
}

export async function saveSessionInstanceExercise(
  sie: SessionInstanceExercise
): Promise<void> {
  await putItem(STORE_NAMES.sessionInstanceExercises, sie);
}
