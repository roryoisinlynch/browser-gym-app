import type { SessionInstance } from "../domain/models";
import { mockWeekInstances } from "./mockWeekInstances";
import { mockSessionTemplates } from "./mockSessionTemplates";

const week1Instance = mockWeekInstances.find((week) => week.id === "week-instance-1")!;
const week2Instance = mockWeekInstances.find((week) => week.id === "week-instance-2")!;
const week3Instance = mockWeekInstances.find((week) => week.id === "week-instance-3")!;
const week4Instance = mockWeekInstances.find((week) => week.id === "week-instance-4")!;
const week5Instance = mockWeekInstances.find((week) => week.id === "week-instance-5")!;

const chestBack1 = mockSessionTemplates.find((session) => session.id === "chest-back-1")!;
const armsShoulder1 = mockSessionTemplates.find(
  (session) => session.id === "arms-shoulder-1"
)!;
const legs1 = mockSessionTemplates.find((session) => session.id === "legs-1")!;
const chestBack2 = mockSessionTemplates.find((session) => session.id === "chest-back-2")!;
const armsShoulder2 = mockSessionTemplates.find(
  (session) => session.id === "arms-shoulder-2"
)!;
const legs2 = mockSessionTemplates.find((session) => session.id === "legs-2")!;

const DAY_OFFSETS = {
  "chest-back-1": 0,
  "arms-shoulder-1": 1,
  "legs-1": 3,
  "chest-back-2": 4,
  "arms-shoulder-2": 6,
  "legs-2": 7,
} as const;

function isoDate(baseDate: string, offsetDays: number) {
  const date = new Date(baseDate);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function completedTimes(baseDate: string, offsetDays: number) {
  const started = new Date(`${isoDate(baseDate, offsetDays)}T18:00:00.000Z`);
  const completed = new Date(started);
  completed.setUTCMinutes(started.getUTCMinutes() + 68);
  return {
    startedAt: started.toISOString(),
    completedAt: completed.toISOString(),
    durationSeconds: Math.round((completed.getTime() - started.getTime()) / 1000),
  };
}

function makeWeekSessionInstances(
  weekInstanceId: string,
  seasonInstanceId: string,
  weekNumber: number,
  baseDate: string,
  statuses?: Partial<Record<string, SessionInstance["status"]>>
): SessionInstance[] {
  const templateMap = [
    chestBack1,
    armsShoulder1,
    legs1,
    chestBack2,
    armsShoulder2,
    legs2,
  ];

  return templateMap.map((template) => {
    const offset = DAY_OFFSETS[template.id as keyof typeof DAY_OFFSETS];
    const status = statuses?.[template.id] ?? "not_started";

    const session: SessionInstance = {
      id: `session-instance-w${weekNumber}-${template.id}`,
      seasonInstanceId,
      weekInstanceId,
      sessionTemplateId: template.id,
      date: isoDate(baseDate, offset),
      status,
      startedAt: null,
      completedAt: null,
      durationSeconds: null,
    };

    if (status === "completed") {
      const { startedAt, completedAt, durationSeconds } = completedTimes(
        baseDate,
        offset
      );

      return {
        ...session,
        startedAt,
        completedAt,
        durationSeconds,
      };
    }

    if (status === "in_progress") {
      return {
        ...session,
        startedAt: `${isoDate(baseDate, offset)}T18:15:00.000Z`,
      };
    }

    return session;
  });
}

export const mockSessionInstances: SessionInstance[] = [
  ...makeWeekSessionInstances(
    week1Instance.id,
    week1Instance.seasonInstanceId,
    1,
    "2026-01-24T00:00:00.000Z",
    {
      "chest-back-1": "completed",
      "arms-shoulder-1": "completed",
      "legs-1": "completed",
      "chest-back-2": "completed",
      "arms-shoulder-2": "completed",
      "legs-2": "completed",
    }
  ),
  ...makeWeekSessionInstances(
    week2Instance.id,
    week2Instance.seasonInstanceId,
    2,
    "2026-02-02T00:00:00.000Z",
    {
      "chest-back-1": "completed",
      "arms-shoulder-1": "completed",
      "legs-1": "completed",
      "chest-back-2": "completed",
      "arms-shoulder-2": "completed",
      "legs-2": "completed",
    }
  ),
  ...makeWeekSessionInstances(
    week3Instance.id,
    week3Instance.seasonInstanceId,
    3,
    "2026-02-11T00:00:00.000Z",
    {
      "chest-back-1": "completed",
      "arms-shoulder-1": "completed",
      "legs-1": "completed",
      "chest-back-2": "completed",
      "arms-shoulder-2": "completed",
      "legs-2": "in_progress",
    }
  ),
  ...makeWeekSessionInstances(
    week4Instance.id,
    week4Instance.seasonInstanceId,
    4,
    "2026-02-20T00:00:00.000Z"
  ),
  ...makeWeekSessionInstances(
    week5Instance.id,
    week5Instance.seasonInstanceId,
    5,
    "2026-03-01T00:00:00.000Z"
  ),
];