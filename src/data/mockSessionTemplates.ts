import type { SessionTemplate } from "../domain/models";
import { mockWeekTemplates } from "./mockWeekTemplates";

const week1 = mockWeekTemplates.find(w => w.id === "week-1")!;

export const mockSessionTemplates: SessionTemplate[] = [
  {
    id: "push-1",
    weekTemplateId: week1.id,
    name: "Push 1",
    order: 1,
  },
  {
    id: "pull-1",
    weekTemplateId: week1.id,
    name: "Pull 1",
    order: 2,
  },
  {
    id: "legs-1",
    weekTemplateId: week1.id,
    name: "Legs 1",
    order: 3,
  },
];