import type { SessionTemplateMuscleGroup } from "../domain/models";
import { mockSessionTemplates } from "./mockSessionTemplates";
import { mockMuscleGroups } from "./mockMuscleGroups";

const sessionById = (id: string) =>
  mockSessionTemplates.find((session) => session.id === id)!;

const groupById = (id: string) =>
  mockMuscleGroups.find((group) => group.id === id)!;

export const mockSessionTemplateMuscleGroups: SessionTemplateMuscleGroup[] = [
  {
    id: "chest-back-1-chest",
    sessionTemplateId: sessionById("chest-back-1").id,
    muscleGroupId: groupById("chest").id,
    order: 1,
    targetWorkingSets: 6,
  },
  {
    id: "chest-back-1-back",
    sessionTemplateId: sessionById("chest-back-1").id,
    muscleGroupId: groupById("back").id,
    order: 2,
    targetWorkingSets: 6,
  },
  {
    id: "chest-back-1-arms",
    sessionTemplateId: sessionById("chest-back-1").id,
    muscleGroupId: groupById("arms").id,
    order: 3,
    targetWorkingSets: 3,
  },

  {
    id: "arms-shoulder-1-delts",
    sessionTemplateId: sessionById("arms-shoulder-1").id,
    muscleGroupId: groupById("delts").id,
    order: 1,
    targetWorkingSets: 9,
  },
  {
    id: "arms-shoulder-1-arms",
    sessionTemplateId: sessionById("arms-shoulder-1").id,
    muscleGroupId: groupById("arms").id,
    order: 2,
    targetWorkingSets: 6,
  },
  {
    id: "arms-shoulder-1-forearms",
    sessionTemplateId: sessionById("arms-shoulder-1").id,
    muscleGroupId: groupById("forearms").id,
    order: 3,
    targetWorkingSets: 6,
  },

  {
    id: "legs-1-legs",
    sessionTemplateId: sessionById("legs-1").id,
    muscleGroupId: groupById("legs").id,
    order: 1,
    targetWorkingSets: 6,
  },
  {
    id: "legs-1-core",
    sessionTemplateId: sessionById("legs-1").id,
    muscleGroupId: groupById("core").id,
    order: 2,
    targetWorkingSets: 6,
  },
  {
    id: "legs-1-grip",
    sessionTemplateId: sessionById("legs-1").id,
    muscleGroupId: groupById("grip").id,
    order: 3,
    targetWorkingSets: 3,
  },

  {
    id: "chest-back-2-back",
    sessionTemplateId: sessionById("chest-back-2").id,
    muscleGroupId: groupById("back").id,
    order: 1,
    targetWorkingSets: 6,
  },
  {
    id: "chest-back-2-chest",
    sessionTemplateId: sessionById("chest-back-2").id,
    muscleGroupId: groupById("chest").id,
    order: 2,
    targetWorkingSets: 6,
  },
  {
    id: "chest-back-2-delts",
    sessionTemplateId: sessionById("chest-back-2").id,
    muscleGroupId: groupById("delts").id,
    order: 3,
    targetWorkingSets: 3,
  },

  {
    id: "arms-shoulder-2-delts",
    sessionTemplateId: sessionById("arms-shoulder-2").id,
    muscleGroupId: groupById("delts").id,
    order: 1,
    targetWorkingSets: 9,
  },
  {
    id: "arms-shoulder-2-arms",
    sessionTemplateId: sessionById("arms-shoulder-2").id,
    muscleGroupId: groupById("arms").id,
    order: 2,
    targetWorkingSets: 6,
  },
  {
    id: "arms-shoulder-2-forearms",
    sessionTemplateId: sessionById("arms-shoulder-2").id,
    muscleGroupId: groupById("forearms").id,
    order: 3,
    targetWorkingSets: 6,
  },

  {
    id: "legs-2-legs",
    sessionTemplateId: sessionById("legs-2").id,
    muscleGroupId: groupById("legs").id,
    order: 1,
    targetWorkingSets: 6,
  },
  {
    id: "legs-2-core",
    sessionTemplateId: sessionById("legs-2").id,
    muscleGroupId: groupById("core").id,
    order: 2,
    targetWorkingSets: 6,
  },
  {
    id: "legs-2-grip",
    sessionTemplateId: sessionById("legs-2").id,
    muscleGroupId: groupById("grip").id,
    order: 3,
    targetWorkingSets: 3,
  },
];