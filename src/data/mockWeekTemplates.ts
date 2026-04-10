import type { WeekTemplate } from "../domain/models";
import { mockSeasonTemplates } from "./mockSeasonTemplates";

const arnoldSeason = mockSeasonTemplates[0]!;
const pplSeason = mockSeasonTemplates[1]!;

export const mockWeekTemplates: WeekTemplate[] = [
  {
    id: "week-template-1",
    seasonTemplateId: arnoldSeason.id,
    name: "Week Template",
    order: 1,
  },
  {
    id: "week-template-ppl",
    seasonTemplateId: pplSeason.id,
    name: "Week Template",
    order: 1,
  },
];
