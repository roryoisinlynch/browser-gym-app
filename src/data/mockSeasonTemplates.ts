import type { SeasonTemplate } from "../domain/models";

export const mockSeasonTemplates: SeasonTemplate[] = [
  {
    id: "season-template-1",
    name: "Arnold Split",
    plannedWeekCount: 5,
    rirSequence: [3, 2, 1, 0, -1],
  },
];
