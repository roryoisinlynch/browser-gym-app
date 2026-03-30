export type ID = string;

export type InstanceStatus = "not_started" | "in_progress" | "completed";
export type WeightMode = "increment" | "explicit_list" | "bodyweight";

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
 *
 * Examples:
 * - Chest -> Flat
 * - Chest -> Incline
 * - Chest -> Fly
 * - Back -> Vertical Pull
 * - Back -> Horizontal Row
 */
export interface MovementType {
  id: ID;
  muscleGroupId: ID;
  name: string;
  order: number;
}

/**
 * Reusable template for an entire training block.
 *
 * This is the structural parent of the template hierarchy.
 * A SeasonTemplate defines the intended block design:
 * - how many weeks it contains
 * - the reusable week/session/exercise structure beneath it
 *
 * A user can run this template multiple times as separate SeasonInstances.
 */
export interface SeasonTemplate {
  id: ID;
  name: string;
  plannedWeekCount: number;
  description?: string;
}

/**
 * Reusable template for a week within a season template.
 *
 * Examples:
 * - Week 1
 * - Week 2
 * - Week 3 "3 RIR week"
 *
 * Concrete week-level progression targets live here so the structure remains
 * explicit rather than being generated indirectly.
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
 * Reusable template for a session/day within a week template.
 *
 * Examples:
 * - Push 1
 * - Pull 1
 * - Legs 1
 *
 * This is the template equivalent of a SessionInstance.
 */
export interface SessionTemplate {
  id: ID;
  weekTemplateId: ID;
  name: string;
  order: number;
}

/**
 * Places a muscle-group section inside a specific session template.
 *
 * This lets a session template be structured into ordered muscle-group boxes
 * in the UI, rather than treating muscle group as just a flat tag on exercises.
 *
 * Example:
 * SessionTemplate "Push 1"
 *   -> Chest
 *   -> Delts
 *   -> Triceps
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
 *
 * Exercises belong to a specific muscle-group section within a session template
 * and also reference a reusable movement type.
 *
 * Notes:
 * - movementTypeId is used for grouping, prioritisation, and aggregate stats
 * - weightMode and related fields are backend/config logic and may not be shown
 *   directly in the UI
 */
export interface ExerciseTemplate {
  id: ID;
  sessionTemplateMuscleGroupId: ID;
  movementTypeId: ID;
  exerciseName: string;

  targetReps: number;
  repMin: number;
  repMax: number;
  rirSequence: number[];

  weightMode: WeightMode;
  weightIncrement?: number;
  availableWeights?: number[];
}

/**
 * A real user-facing run through a season template.
 *
 * Examples:
 * - Season 1
 * - Season 2
 * - Jan 24 block
 *
 * A SeasonInstance is the top-level runtime container for performed weeks,
 * sessions, exercises, and sets.
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
 *
 * This exists because weeks have their own runtime meaning in the app:
 * - summaries
 * - grading/evaluation
 * - progress charting
 * - started/completed state
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
 * A performed occurrence of a session template.
 *
 * Example:
 * SessionTemplate: "Legs 1"
 * SessionInstance: "Legs 1 performed on 2026-03-18"
 *
 * Session duration is tracked explicitly so it can be calculated automatically
 * and edited later if needed.
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
 *
 * Completion is explicit and matches the intended UX:
 * - user starts an exercise
 * - records one or more sets
 * - explicitly marks the exercise as done
 *
 * We do not currently infer exercise completion from a prescribed set count.
 */
export interface ExerciseInstance {
  id: ID;
  sessionInstanceId: ID;
  exerciseTemplateId: ID;

  status: InstanceStatus;

  startedAt?: string | null;
  completedAt?: string | null;

  prescribedWeight?: number | null;
  prescribedRepTarget?: number | null;
  prescribedRir?: number | null;
}

/**
 * A single performed set within an exercise instance.
 *
 * Users can create as many set records as needed for an exercise instance.
 * A set is effectively "filled in" when the performed fields are populated.
 */
export interface ExerciseSet {
  id: ID;
  exerciseInstanceId: ID;
  setIndex: number;

  performedWeight?: number | null;
  performedReps?: number | null;
  performedRir?: number | null;
}