import type { WeekInstance } from "../domain/models";
import { mockSeasonInstances } from "./mockSeasonInstances";
import { mockWeekTemplates } from "./mockWeekTemplates";

const seasonInstance = mockSeasonInstances[0]!;

const week1 = mockWeekTemplates.find((week) => week.id === "week-1")!;
const week2 = mockWeekTemplates.find((week) => week.id === "week-2")!;
const week3 = mockWeekTemplates.find((week) => week.id === "week-3")!;
const week4 = mockWeekTemplates.find((week) => week.id === "week-4")!;
const week5 = mockWeekTemplates.find((week) => week.id === "week-5")!;

export const mockWeekInstances: WeekInstance[] = [
  {
    id: "week-instance-1",
    seasonInstanceId: seasonInstance.id,
    weekTemplateId: week1.id,
    order: 1,
    status: "completed",
    startedAt: "2026-01-24T09:00:00.000Z",
    completedAt: "2026-01-30T19:00:00.000Z",
    summary: "Solid first week. Good compliance and manageable fatigue.",
    grade: "A-",
  },
  {
    id: "week-instance-2",
    seasonInstanceId: seasonInstance.id,
    weekTemplateId: week2.id,
    order: 2,
    status: "completed",
    startedAt: "2026-01-31T09:00:00.000Z",
    completedAt: "2026-02-06T19:00:00.000Z",
    summary: "Progressed loads on most primary movements.",
    grade: "A",
  },
  {
    id: "week-instance-3",
    seasonInstanceId: seasonInstance.id,
    weekTemplateId: week3.id,
    order: 3,
    status: "in_progress",
    startedAt: "2026-02-07T09:00:00.000Z",
    completedAt: null,
    summary: null,
    grade: null,
  },
  {
    id: "week-instance-4",
    seasonInstanceId: seasonInstance.id,
    weekTemplateId: week4.id,
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
    weekTemplateId: week5.id,
    order: 5,
    status: "not_started",
    startedAt: null,
    completedAt: null,
    summary: null,
    grade: null,
  },
];