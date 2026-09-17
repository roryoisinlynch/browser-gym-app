import type {
  ExerciseTemplate,
  MovementType,
  MuscleGroup,
  SeasonTemplate,
  SessionTemplate,
  SessionTemplateMuscleGroup,
  WeekTemplate,
  WeekTemplateItem,
} from "../domain/models";
import { DEFAULT_MOVEMENT_TYPE_NAME } from "../repositories/programRepository";
import { weightFieldsFromConfig } from "../services/weightConfig";
import type { WeightFields } from "../services/weightConfig";
import { weightsFromIncrement } from "../services/weightOptions";

/**
 * The sample program a blank database starts with: one Push Pull Legs season
 * on a 7-day week (Push A, Pull A, Legs A, Push B, Pull B, Legs B, Rest).
 *
 * Records are built from the blueprint below rather than written out by hand,
 * so the A and B days are copies by construction and every reference resolves.
 * All ids live in the "seed-" namespace, which no earlier seed ever used.
 */
export interface SeedData {
  muscleGroups: MuscleGroup[];
  movementTypes: MovementType[];
  seasonTemplates: SeasonTemplate[];
  weekTemplates: WeekTemplate[];
  weekTemplateItems: WeekTemplateItem[];
  sessionTemplates: SessionTemplate[];
  sessionTemplateMuscleGroups: SessionTemplateMuscleGroup[];
  exerciseTemplates: ExerciseTemplate[];
}

// ── Blueprint ───────────────────────────────────────────────────────────────

const MUSCLE_GROUPS = [
  { key: "chest", name: "Chest" },
  { key: "shoulders", name: "Shoulders" },
  { key: "triceps", name: "Triceps" },
  { key: "vertical-pull", name: "Vertical Pull" },
  { key: "horizontal-row", name: "Horizontal Row" },
  { key: "biceps", name: "Biceps" },
  { key: "quads", name: "Quads" },
  { key: "hamstrings", name: "Hamstrings" },
  { key: "core", name: "Core" },
] as const;

type MuscleGroupKey = (typeof MUSCLE_GROUPS)[number]["key"];

interface ExerciseBlueprint {
  slug: string;
  name: string;
  bodyweight?: boolean;
}

interface GroupBlueprint {
  muscleGroup: MuscleGroupKey;
  targetWorkingSets: number;
  exercises: ExerciseBlueprint[];
}

interface DayBlueprint {
  slug: string;
  name: string;
  groups: GroupBlueprint[];
}

const DAYS: DayBlueprint[] = [
  {
    slug: "push",
    name: "Push",
    groups: [
      {
        muscleGroup: "chest",
        targetWorkingSets: 6,
        exercises: [
          { slug: "bench-press", name: "Bench Press" },
          { slug: "machine-fly", name: "Machine Fly" },
        ],
      },
      {
        muscleGroup: "shoulders",
        targetWorkingSets: 6,
        exercises: [
          { slug: "ohp", name: "OHP" },
          { slug: "lateral-raise", name: "Lateral Raise" },
        ],
      },
      {
        muscleGroup: "triceps",
        targetWorkingSets: 3,
        exercises: [{ slug: "tricep-pushdown", name: "Tricep Pushdown" }],
      },
    ],
  },
  {
    slug: "pull",
    name: "Pull",
    groups: [
      {
        muscleGroup: "vertical-pull",
        targetWorkingSets: 6,
        exercises: [
          { slug: "pull-ups", name: "Pull Ups", bodyweight: true },
          { slug: "lat-pulldown", name: "Lat Pulldown" },
        ],
      },
      {
        muscleGroup: "horizontal-row",
        targetWorkingSets: 6,
        exercises: [
          { slug: "barbell-row", name: "Barbell Row" },
          { slug: "cable-row", name: "Cable Row" },
        ],
      },
      {
        muscleGroup: "biceps",
        targetWorkingSets: 3,
        exercises: [{ slug: "bicep-curl", name: "Bicep Curl" }],
      },
    ],
  },
  {
    slug: "legs",
    name: "Legs",
    groups: [
      {
        muscleGroup: "quads",
        targetWorkingSets: 6,
        exercises: [
          { slug: "barbell-squat", name: "Barbell Squat" },
          { slug: "leg-extension", name: "Leg Extension" },
        ],
      },
      {
        muscleGroup: "hamstrings",
        targetWorkingSets: 6,
        exercises: [
          { slug: "leg-curl", name: "Leg Curl" },
          { slug: "barbell-rdl", name: "Barbell RDL" },
        ],
      },
      {
        muscleGroup: "core",
        targetWorkingSets: 3,
        exercises: [{ slug: "cable-crunch", name: "Cable Crunch" }],
      },
    ],
  },
];

// The week runs every day once as A, then every day again as B, then rests.
const VARIANTS = ["A", "B"] as const;

const RIR_SEQUENCE = [3, 2, 1, 0, -1];

// ── Ids ─────────────────────────────────────────────────────────────────────

const SEASON_TEMPLATE_ID = "seed-ppl";
const WEEK_TEMPLATE_ID = `${SEASON_TEMPLATE_ID}-week`;

function muscleGroupId(key: MuscleGroupKey): string {
  return `seed-mg-${key}`;
}

function movementTypeId(key: MuscleGroupKey): string {
  return `seed-mt-${key}-general`;
}

// Exercise order is never declaration order: the season snapshot sorts by
// id.localeCompare and the config page reads in IndexedDB key order. A shared
// prefix plus a zero-padded position sorts the same way under both.
function exerciseTemplateId(sectionId: string, position: number, slug: string): string {
  return `${sectionId}-${String(position).padStart(2, "0")}-${slug}`;
}

// ── Weights ─────────────────────────────────────────────────────────────────

// The fields the Available weights wizard stores for a filled 2.5 to 200 kg
// range. Built per exercise so no two records share an array.
function weightedFields(): WeightFields {
  return weightFieldsFromConfig({
    kind: "list",
    weights: weightsFromIncrement(2.5, 2.5, 200),
    step: 2.5,
  });
}

// ── Builder ─────────────────────────────────────────────────────────────────

export function buildSeedData(): SeedData {
  const muscleGroups: MuscleGroup[] = MUSCLE_GROUPS.map((group, index) => ({
    id: muscleGroupId(group.key),
    name: group.name,
    order: index + 1,
  }));

  // Movement types are not chosen in the UI. One default per muscle group,
  // named so getOrCreateDefaultMovementType reuses it for new exercises.
  const movementTypes: MovementType[] = MUSCLE_GROUPS.map((group) => ({
    id: movementTypeId(group.key),
    muscleGroupId: muscleGroupId(group.key),
    name: DEFAULT_MOVEMENT_TYPE_NAME,
    order: 1,
  }));

  const seasonTemplates: SeasonTemplate[] = [
    {
      id: SEASON_TEMPLATE_ID,
      name: "Push Pull Legs",
      plannedWeekCount: RIR_SEQUENCE.length,
      rirSequence: [...RIR_SEQUENCE],
    },
  ];

  const weekTemplates: WeekTemplate[] = [
    {
      id: WEEK_TEMPLATE_ID,
      seasonTemplateId: SEASON_TEMPLATE_ID,
      name: "Week Template",
      order: 1,
    },
  ];

  const weekTemplateItems: WeekTemplateItem[] = [];
  const sessionTemplates: SessionTemplate[] = [];
  const sessionTemplateMuscleGroups: SessionTemplateMuscleGroup[] = [];
  const exerciseTemplates: ExerciseTemplate[] = [];

  for (const variant of VARIANTS) {
    for (const day of DAYS) {
      const order = sessionTemplates.length + 1;
      const sessionTemplateId = `${SEASON_TEMPLATE_ID}-${day.slug}-${variant.toLowerCase()}`;

      sessionTemplates.push({
        id: sessionTemplateId,
        seasonTemplateId: SEASON_TEMPLATE_ID,
        name: `${day.name} ${variant}`,
        order,
      });

      weekTemplateItems.push({
        id: `${WEEK_TEMPLATE_ID}-item-${order}`,
        weekTemplateId: WEEK_TEMPLATE_ID,
        order,
        type: "session",
        sessionTemplateId,
      });

      day.groups.forEach((group, groupIndex) => {
        const sectionId = `${sessionTemplateId}-${group.muscleGroup}`;

        sessionTemplateMuscleGroups.push({
          id: sectionId,
          sessionTemplateId,
          muscleGroupId: muscleGroupId(group.muscleGroup),
          order: groupIndex + 1,
          targetWorkingSets: group.targetWorkingSets,
        });

        group.exercises.forEach((exercise, exerciseIndex) => {
          exerciseTemplates.push({
            id: exerciseTemplateId(sectionId, exerciseIndex + 1, exercise.slug),
            sessionTemplateMuscleGroupId: sectionId,
            movementTypeId: movementTypeId(group.muscleGroup),
            exerciseName: exercise.name,
            ...(exercise.bodyweight
              ? weightFieldsFromConfig({ kind: "bodyweight" })
              : weightedFields()),
            prescribedWeight: null,
          });
        });
      });
    }
  }

  const restOrder = weekTemplateItems.length + 1;
  weekTemplateItems.push({
    id: `${WEEK_TEMPLATE_ID}-item-${restOrder}`,
    weekTemplateId: WEEK_TEMPLATE_ID,
    order: restOrder,
    type: "rest",
    label: "Rest",
  });

  return {
    muscleGroups,
    movementTypes,
    seasonTemplates,
    weekTemplates,
    weekTemplateItems,
    sessionTemplates,
    sessionTemplateMuscleGroups,
    exerciseTemplates,
  };
}
