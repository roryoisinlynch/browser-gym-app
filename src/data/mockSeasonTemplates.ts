import type { SeasonTemplate } from "../domain/models";

export const mockSeasonTemplates: SeasonTemplate[] = [
  {
    id: "season-template-1",
    name: "Base Hypertrophy",
    plannedWeekCount: 5,
    description: " Default training block",
    rirSequence: [4, 3, 2, 1, 0],
  },
];
