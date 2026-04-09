import type { WeekTemplate } from "../domain/models";
import { mockSeasonTemplates } from "./mockSeasonTemplates";

const seasonTemplate = mockSeasonTemplates[0]!;

export const mockWeekTemplates: WeekTemplate[] = [
  {
    id: "week-template-1",
    seasonTemplateId: seasonTemplate.id,
    name: "Week Template",
    order: 1,
  },
];
