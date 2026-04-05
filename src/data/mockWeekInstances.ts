import type { WeekInstance } from "../domain/models";
import { mockSeasonInstances } from "./mockSeasonInstances";
import { mockWeekTemplates } from "./mockWeekTemplates";

const seasonInstance = mockSeasonInstances[0]!;
const canonicalWeekTemplate = mockWeekTemplates[0]!;

// All week instances for a season reference the same canonical WeekTemplate.
// The order field distinguishes them and drives the RIR lookup via
// SeasonTemplate.rirSequence[weekInstance.order - 1].
export const mockWeekInstances: WeekInstance[] = [
  {
    id: "week-instance-1",
    seasonInstanceId: seasonInstance.id,
    weekTemplateId: canonicalWeekTemplate.id,
    order: 1,
    status: "completed",
    startedAt: "2026-01-24T09:00:00.000Z",
    completedAt: "2026-02-01T19:00:00.000Z",
    summary: "Solid first run through the new split.",
    grade: "A-",
  },
  {
    id: "week-instance-2",
    seasonInstanceId: seasonInstance.id,
    weekTemplateId: canonicalWeekTemplate.id,
    order: 2,
    status: "completed",
    startedAt: "2026-02-02T09:00:00.000Z",
    completedAt: "2026-02-10T19:00:00.000Z",
    summary: "Loads progressed cleanly across the split.",
    grade: "A",
  },
  {
    id: "week-instance-3",
    seasonInstanceId: seasonInstance.id,
    weekTemplateId: canonicalWeekTemplate.id,
    order: 3,
    status: "in_progress",
    startedAt: "2026-02-11T09:00:00.000Z",
    completedAt: null,
    summary: null,
    grade: null,
  },
  {
    id: "week-instance-4",
    seasonInstanceId: seasonInstance.id,
    weekTemplateId: canonicalWeekTemplate.id,
    order: 4,
    status: "not_started",
    startedAt: null,
    completedAt: null,
    summary: null,
    grade: null,
  },
  {
    id: "week-instance-5",
    seasonInstanceId: seasonInstance.id,
    weekTemplateId: canonicalWeekTemplate.id,
    order: 5,
    status: "not_started",
    startedAt: null,
    completedAt: null,
    summary: null,
    grade: null,
  },
];
