import type { SessionInstance } from "../domain/models";
import { mockWeekInstances } from "./mockWeekInstances";
import { mockSessionTemplates } from "./mockSessionTemplates";

const week1Instance = mockWeekInstances.find((week) => week.id === "week-instance-1")!;
const week2Instance = mockWeekInstances.find((week) => week.id === "week-instance-2")!;
const week3Instance = mockWeekInstances.find((week) => week.id === "week-instance-3")!;
const week4Instance = mockWeekInstances.find((week) => week.id === "week-instance-4")!;
const week5Instance = mockWeekInstances.find((week) => week.id === "week-instance-5")!;

const push1 = mockSessionTemplates.find((session) => session.id === "push-1")!;
const pull1 = mockSessionTemplates.find((session) => session.id === "pull-1")!;
const legs1 = mockSessionTemplates.find((session) => session.id === "legs-1")!;

function makeWeekSessionInstances(
  weekInstanceId: string,
  seasonInstanceId: string,
  prefix: string,
  dates: {
    push: string;
    pull: string;
    legs: string;
  },
  statuses?: {
    push?: SessionInstance["status"];
    pull?: SessionInstance["status"];
    legs?: SessionInstance["status"];
  }
): SessionInstance[] {
  return [
    {
      id: `session-instance-${prefix}-push-1`,
      seasonInstanceId,
      weekInstanceId,
      sessionTemplateId: push1.id,
      date: dates.push,
      status: statuses?.push ?? "not_started",
      startedAt: null,
      completedAt: null,
      durationSeconds: null,
    },
    {
      id: `session-instance-${prefix}-pull-1`,
      seasonInstanceId,
      weekInstanceId,
      sessionTemplateId: pull1.id,
      date: dates.pull,
      status: statuses?.pull ?? "not_started",
      startedAt: null,
      completedAt: null,
      durationSeconds: null,
    },
    {
      id: `session-instance-${prefix}-legs-1`,
      seasonInstanceId,
      weekInstanceId,
      sessionTemplateId: legs1.id,
      date: dates.legs,
      status: statuses?.legs ?? "not_started",
      startedAt: null,
      completedAt: null,
      durationSeconds: null,
    },
  ];
}

export const mockSessionInstances: SessionInstance[] = [
  ...makeWeekSessionInstances(
    week1Instance.id,
    week1Instance.seasonInstanceId,
    "week-1",
    {
      push: "2026-01-25",
      pull: "2026-01-27",
      legs: "2026-01-29",
    },
    {
      push: "completed",
      pull: "completed",
      legs: "completed",
    }
  ).map((session) => {
    if (session.status !== "completed") {
      return session;
    }

    const startedAt =
      session.sessionTemplateId === push1.id
        ? "2026-01-25T18:00:00.000Z"
        : session.sessionTemplateId === pull1.id
          ? "2026-01-27T18:00:00.000Z"
          : "2026-01-29T18:00:00.000Z";

    const completedAt =
      session.sessionTemplateId === push1.id
        ? "2026-01-25T19:05:00.000Z"
        : session.sessionTemplateId === pull1.id
          ? "2026-01-27T19:08:00.000Z"
          : "2026-01-29T19:10:00.000Z";

    return {
      ...session,
      startedAt,
      completedAt,
      durationSeconds:
        Math.round(
          (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000
        ),
    };
  }),

  ...makeWeekSessionInstances(
    week2Instance.id,
    week2Instance.seasonInstanceId,
    "week-2",
    {
      push: "2026-02-01",
      pull: "2026-02-03",
      legs: "2026-02-05",
    },
    {
      push: "completed",
      pull: "completed",
      legs: "completed",
    }
  ).map((session) => {
    if (session.status !== "completed") {
      return session;
    }

    const startedAt =
      session.sessionTemplateId === push1.id
        ? "2026-02-01T18:00:00.000Z"
        : session.sessionTemplateId === pull1.id
          ? "2026-02-03T18:00:00.000Z"
          : "2026-02-05T18:00:00.000Z";

    const completedAt =
      session.sessionTemplateId === push1.id
        ? "2026-02-01T19:07:00.000Z"
        : session.sessionTemplateId === pull1.id
          ? "2026-02-03T19:04:00.000Z"
          : "2026-02-05T19:12:00.000Z";

    return {
      ...session,
      startedAt,
      completedAt,
      durationSeconds:
        Math.round(
          (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000
        ),
    };
  }),

  {
    id: "session-instance-push-1",
    seasonInstanceId: week3Instance.seasonInstanceId,
    weekInstanceId: week3Instance.id,
    sessionTemplateId: push1.id,
    date: "2026-02-08",
    status: "completed",
    startedAt: "2026-02-08T18:00:00.000Z",
    completedAt: "2026-02-08T19:12:00.000Z",
    durationSeconds: 4320,
  },
  {
    id: "session-instance-pull-1",
    seasonInstanceId: week3Instance.seasonInstanceId,
    weekInstanceId: week3Instance.id,
    sessionTemplateId: pull1.id,
    date: "2026-02-10",
    status: "not_started",
    startedAt: null,
    completedAt: null,
    durationSeconds: null,
  },
  {
    id: "session-instance-legs-1",
    seasonInstanceId: week3Instance.seasonInstanceId,
    weekInstanceId: week3Instance.id,
    sessionTemplateId: legs1.id,
    date: "2026-02-12",
    status: "in_progress",
    startedAt: "2026-02-12T18:15:00.000Z",
    completedAt: null,
    durationSeconds: null,
  },

  ...makeWeekSessionInstances(
    week4Instance.id,
    week4Instance.seasonInstanceId,
    "week-4",
    {
      push: "2026-02-15",
      pull: "2026-02-17",
      legs: "2026-02-19",
    }
  ),

  ...makeWeekSessionInstances(
    week5Instance.id,
    week5Instance.seasonInstanceId,
    "week-5",
    {
      push: "2026-02-22",
      pull: "2026-02-24",
      legs: "2026-02-26",
    }
  ),
];