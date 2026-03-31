import type { SessionTemplate } from "../domain/models";
import { mockWeekTemplates } from "./mockWeekTemplates";

const week1 = mockWeekTemplates.find((week) => week.id === "week-1")!;

export const mockSessionTemplates: SessionTemplate[] = [
  {
    id: "chest-back-1",
    weekTemplateId: week1.id,
    name: "Chest Back 1",
    order: 1,
  },
  {
    id: "arms-shoulder-1",
    weekTemplateId: week1.id,
    name: "Arms Shoulder 1",
    order: 2,
  },
  {
    id: "legs-1",
    weekTemplateId: week1.id,
    name: "Legs 1",
    order: 4,
  },
  {
    id: "chest-back-2",
    weekTemplateId: week1.id,
    name: "Chest Back 2",
    order: 5,
  },
  {
    id: "arms-shoulder-2",
    weekTemplateId: week1.id,
    name: "Arms Shoulder 2",
    order: 7,
  },
  {
    id: "legs-2",
    weekTemplateId: week1.id,
    name: "Legs 2",
    order: 8,
  },
];