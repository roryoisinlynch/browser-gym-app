import type { WeekTemplate } from "../domain/models";
import { mockSeasonTemplates } from "./mockSeasonTemplates";

const seasonTemplate = mockSeasonTemplates[0]!;

/**
 * One canonical WeekTemplate per SeasonTemplate defines the structural
 * layout of a week (which sessions and rest days, in what order).
 * When a season instance is started, this template is replicated once
 * per entry in SeasonTemplate.rirSequence to produce WeekInstances.
 */
export const mockWeekTemplates: WeekTemplate[] = [
  {
    id: "week-template-1",
    seasonTemplateId: seasonTemplate.id,
    name: "Week Template",
    order: 1,
  },
];
