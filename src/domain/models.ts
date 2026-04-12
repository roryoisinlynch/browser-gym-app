export type ID = string;

export type InstanceStatus = "not_started" | "in_progress" | "completed";
export type SeasonStatus = InstanceStatus | "cancelled";
export type WeightMode = "increment" | "explicit_list" | "bodyweight";
export type WeekItemType = "session" | "rest";

/**
 * Reusable definition of a muscle group.
 *
 * Examples:
 * - Chest
 * - Back
 * - Legs
 */
export interface MuscleGroup {
  id: ID;
  name: string;
  order: number;
}

/**
 * Reusable definition of a movement type.
 *
 * A movement type belongs to a parent muscle group so the app can:
 * - aggregate stats consistently
 * - avoid duplicate near-equivalent categories
 * - validate exercise categorisation
 */
export interface MovementType {
  id: ID;
  muscleGroupId: ID;
  name: string;
  order: number;
}

/**
 * Reusable template for an entire training block.
 */
export interface SeasonTemplate {
  id: ID;
  name: string;
  plannedWeekCount: number;
  /** RIR target for each week in order, e.g. [4,3,2,1,0]. Overrides WeekTemplate.targetRir when set. */
  rirSequence?: number[];
}

/**
 * Reusable template for a week within a season template.
 */
export interface WeekTemplate {
  id: ID;
  seasonTemplateId: ID;
  name: string;
  order: number;
  label?: string;
  targetRir?: number;
}

/**
 * Ordered structural item inside a week template.
 *
 * A week can contain either:
 * - a session slot
 * - a rest slot
 */
export interface WeekTemplateItem {
  id: ID;
  weekTemplateId: ID;
  order: number;
  type: WeekItemType;
  sessionTemplateId?: ID;
  label?: string;
}

/**
 * Reusable template for a session/day. Season-scoped — referenced from
 * WeekTemplateItems so the same session definition appears in every week.
 */
export interface SessionTemplate {
  id: ID;
  seasonTemplateId: ID;
  name: string;
  order: number;
}

/**
 * Places a muscle-group section inside a specific session template.
 */
export interface SessionTemplateMuscleGroup {
  id: ID;
  sessionTemplateId: ID;
  muscleGroupId: ID;
  order: number;
  targetWorkingSets: number;
}

/**
 * Snapshot of a muscle-group section captured at the moment a season is
 * started. Isolates each season's session structure from future template edits.
 */
export interface SessionInstanceMuscleGroup {
  id: ID;
  sessionInstanceId: ID;
  muscleGroupId: ID;
  order: number;
  targetWorkingSets: number;
}

/**
 * Snapshot of an exercise captured at the moment a season is started.
 * Carries all attributes needed to prescribe and display the exercise,
 * isolated from future template edits. prescribedWeight is propagated
 * from the template whenever the user adjusts their working weight in
 * settings so that mid-season weight changes still take effect.
 */
export interface SessionInstanceExercise {
  id: ID;
  sessionInstanceMuscleGroupId: ID;
  sessionInstanceId: ID;
  sourceExerciseTemplateId: ID;
  movementTypeId: ID;
  exerciseName: string;
  weightMode: WeightMode;
  prescribedWeight: number | null;
  weightIncrement?: number;
  availableWeights?: number[];
}

/**
 * Reusable template definition of an exercise.
 */
export interface ExerciseTemplate {
  id: ID;
  sessionTemplateMuscleGroupId: ID;
  movementTypeId: ID;
  exerciseName: string;

  // prescribedWeight is the fixed weight anchor chosen in settings.
  // Reps are derived dynamically from e1RM each session.
  prescribedWeight?: number | null;

  // Legacy fields retained for backward-compat with stored records;
  // no longer written or used by the prescription logic.
  targetReps?: number;
  repMin?: number;
  repMax?: number;
  rirSequence?: number[];

  weightMode: WeightMode;
  weightIncrement?: number;
  availableWeights?: number[];
}

/**
 * A real user-facing run through a season template.
 */
export interface SeasonInstance {
  id: ID;
  seasonTemplateId: ID;
  name: string;
  order: number;
  label?: string;

  status: SeasonStatus;

  startedAt?: string | null;
  completedAt?: string | null;
}

/**
 * A performed occurrence of a week inside a season instance.
 */
export interface WeekInstance {
  id: ID;
  seasonInstanceId: ID;
  weekTemplateId: ID;
  order: number;

  status: InstanceStatus;

  /** RIR target snapshotted from the season template's rirSequence at the moment this week was generated. */
  rirTarget?: number | null;

  startedAt?: string | null;
  completedAt?: string | null;

  summary?: string | null;
  grade?: string | null;
}

/**
 * Runtime ordered structural item inside a week instance.
 */
export interface WeekInstanceItem {
  id: ID;
  weekInstanceId: ID;
  weekTemplateItemId: ID;
  order: number;
  type: WeekItemType;
  sessionInstanceId?: ID;
  label?: string | null;
}

/**
 * A performed occurrence of a session template.
 */
export interface SessionInstance {
  id: ID;
  seasonInstanceId: ID;
  weekInstanceId: ID;
  sessionTemplateId: ID;
  /** Snapshot of the session name at season-start, independent of template renames. */
  sessionName: string;

  date: string;

  status: InstanceStatus;

  startedAt?: string | null;
  completedAt?: string | null;
  durationSeconds?: number | null;
}

/**
 * A performed occurrence of an exercise inside a session instance.
 * References a SessionInstanceExercise (season-start snapshot) rather than
 * the live template so historical sessions stay isolated from program edits.
 */
export interface ExerciseInstance {
  id: ID;
  sessionInstanceId: ID;
  sessionInstanceExerciseId: ID;
  exerciseName: string; // denormalized for name-based history lookups

  status: InstanceStatus;

  startedAt?: string | null;
  completedAt?: string | null;

  prescribedWeight?: number | null;
  prescribedRepTarget?: number | null;
  prescribedRir?: number | null;
}

/**
 * A single performed set within an exercise instance.
 */
export interface ExerciseSet {
  id: ID;
  exerciseInstanceId: ID;
  setIndex: number;

  performedWeight?: number | null;
  performedReps?: number | null;
  performedRir?: number | null;
}

/**
 * A user-defined heuristic question (e.g. "Sleep quality").
 */
export interface HeuristicQuestion {
  id: ID;
  label: string;
  order: number;
}

/**
 * A single answer to one heuristic question on one day.
 * Absence of a row means "not yet answered"; value === null means "skipped".
 */
export interface HeuristicEntry {
  id: ID;
  questionId: ID;
  date: string;
  value: number | null;
}