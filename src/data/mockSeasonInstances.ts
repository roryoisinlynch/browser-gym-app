import type { SeasonInstance } from "../domain/models";
import { mockSeasonTemplates } from "./mockSeasonTemplates";

const seasonTemplate = mockSeasonTemplates[0]!;

export const mockSeasonInstances: SeasonInstance[] = [
  {
    id: "season-instance-1",
    seasonTemplateId: seasonTemplate.id,
    name: "Season 2",
    order: 2,
    label: "Jan 24",
    status: "in_progress",
    startedAt: "2026-01-24T09:00:00.000Z",
    completedAt: null,
  },
];