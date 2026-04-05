export type ID = string;

export type InstanceStatus = "not_started" | "in_progress" | "completed";
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
  description?: string;
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

  status: InstanceStatus;

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

  date: string;

  status: InstanceStatus;

  startedAt?: string | null;
  completedAt?: string | null;
  durationSeconds?: number | null;
}

/**
 * A performed occurrence of an exercise template inside a session instance.
 */
export interface ExerciseInstance {
  id: ID;
  sessionInstanceId: ID;
  exerciseTemplateId: ID;
  exerciseName?: string; // denormalized at creation; enables history lookup after template deletion

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