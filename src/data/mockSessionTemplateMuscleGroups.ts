import type { SessionTemplateMuscleGroup } from "../domain/models";
import { mockSessionTemplates } from "./mockSessionTemplates";
import { mockMuscleGroups } from "./mockMuscleGroups";

/**
 * Helper lookup to make IDs easier to reference
 */
const sessionById = (id: string) =>
  mockSessionTemplates.find((s) => s.id === id)!;

const groupById = (id: string) =>
  mockMuscleGroups.find((g) => g.id === id)!;

/**
 * Defines which muscle-group sections appear in each session template,
 * their display order, and the target number of working sets for that group.
 */
export const mockSessionTemplateMuscleGroups: SessionTemplateMuscleGroup[] = [
  // Push 1
  {
    id: "push1-chest",
    sessionTemplateId: sessionById("push-1").id,
    muscleGroupId: groupById("chest").id,
    order: 1,
    targetWorkingSets: 9,
  },
  {
    id: "push1-delts",
    sessionTemplateId: sessionById("push-1").id,
    muscleGroupId: groupById("delts").id,
    order: 2,
    targetWorkingSets: 6,
  },
  {
    id: "push1-arms",
    sessionTemplateId: sessionById("push-1").id,
    muscleGroupId: groupById("arms").id,
    order: 3,
    targetWorkingSets: 4,
  },

  // Pull 1
  {
    id: "pull1-back",
    sessionTemplateId: sessionById("pull-1").id,
    muscleGroupId: groupById("back").id,
    order: 1,
    targetWorkingSets: 9,
  },
  {
    id: "pull1-arms",
    sessionTemplateId: sessionById("pull-1").id,
    muscleGroupId: groupById("arms").id,
    order: 2,
    targetWorkingSets: 4,
  },

  // Legs 1
  {
    id: "legs1-legs",
    sessionTemplateId: sessionById("legs-1").id,
    muscleGroupId: groupById("legs").id,
    order: 1,
    targetWorkingSets: 9,
  },
];