import type { WeekTemplate } from "../domain/models";
import { mockSeasonTemplates } from "./mockSeasonTemplates";

const seasonTemplate = mockSeasonTemplates[0]!;

export const mockWeekTemplates: WeekTemplate[] = [
  {
    id: "week-1",
    seasonTemplateId: seasonTemplate.id,
    name: "Week 1",
    order: 1,
    label: "4 RIR week",
    targetRir: 4,
  },
  {
    id: "week-2",
    seasonTemplateId: seasonTemplate.id,
    name: "Week 2",
    order: 2,
    label: "3 RIR week",
    targetRir: 3,
  },
  {
    id: "week-3",
    seasonTemplateId: seasonTemplate.id,
    name: "Week 3",
    order: 3,
    label: "2 RIR week",
    targetRir: 2,
  },
  {
    id: "week-4",
    seasonTemplateId: seasonTemplate.id,
    name: "Week 4",
    order: 4,
    label: "1 RIR week",
    targetRir: 1,
  },
  {
    id: "week-5",
    seasonTemplateId: seasonTemplate.id,
    name: "Week 5",
    order: 5,
    label: "0 RIR week",
    targetRir: 0,
  },
];