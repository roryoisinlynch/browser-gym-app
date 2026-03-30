import type { SessionInstance } from "../domain/models";
import { mockWeekInstances } from "./mockWeekInstances";
import { mockSessionTemplates } from "./mockSessionTemplates";

const currentWeekInstance =
  mockWeekInstances.find((week) => week.id === "week-instance-3")!;

const push1 = mockSessionTemplates.find(
  (session) => session.id === "push-1"
)!;
const pull1 = mockSessionTemplates.find(
  (session) => session.id === "pull-1"
)!;
const legs1 = mockSessionTemplates.find(
  (session) => session.id === "legs-1"
)!;

export const mockSessionInstances: SessionInstance[] = [
  {
    id: "session-instance-push-1",
    seasonInstanceId: currentWeekInstance.seasonInstanceId,
    weekInstanceId: currentWeekInstance.id,
    sessionTemplateId: push1.id,
    date: "2026-02-08",
    status: "completed",
    startedAt: "2026-02-08T18:00:00.000Z",
    completedAt: "2026-02-08T19:12:00.000Z",
    durationSeconds: 4320,
  },
  {
    id: "session-instance-pull-1",
    seasonInstanceId: currentWeekInstance.seasonInstanceId,
    weekInstanceId: currentWeekInstance.id,
    sessionTemplateId: pull1.id,
    date: "2026-02-10",
    status: "not_started",
    startedAt: null,
    completedAt: null,
    durationSeconds: null,
  },
  {
    id: "session-instance-legs-1",
    seasonInstanceId: currentWeekInstance.seasonInstanceId,
    weekInstanceId: currentWeekInstance.id,
    sessionTemplateId: legs1.id,
    date: "2026-02-12",
    status: "in_progress",
    startedAt: "2026-02-12T18:15:00.000Z",
    completedAt: null,
    durationSeconds: null,
  },
];