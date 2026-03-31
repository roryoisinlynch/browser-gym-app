import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { SessionInstanceView } from "../repositories/programRepository";
import {
  ensureExerciseInstance,
  getSessionInstanceView,
  startSessionInstance,
  stopSessionInstance,
} from "../repositories/programRepository";
import BottomNav from "../components/BottomNav";
import TopBar from "../components/TopBar";
import "./SessionPage.css";

function clampPercentage(value: number) {
  return Math.max(0, Math.min(100, value));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getExerciseStatusLabel(
  status: "not_started" | "in_progress" | "completed" | undefined
) {
  if (status === "completed") return "Completed";
  if (status === "in_progress") return "In progress";
  return "Not started";
}

type MovementTone = {
  bg: string;
  text: string;
  border: string;
};

const MOVEMENT_TYPE_TONES: Record<string, MovementTone> = {
  flat: {
    bg: "#e8f1ff",
    text: "#4f6f9a",
    border: "#cdddf5",
  },
  incline: {
    bg: "#efe9ff",
    text: "#6d5f98",
    border: "#ddd3f7",
  },
  fly: {
    bg: "#fff0e7",
    text: "#9a6b56",
    border: "#f2d9ca",
  },
  squat: {
    bg: "#e7f5ea",
    text: "#56785f",
    border: "#9fcbb0",
  },
  hinge: {
    bg: "#fff4df",
    text: "#8c6d3f",
    border: "#efddba",
  },
  calf: {
    bg: "#e7f7f6",
    text: "#4f7f7b",
    border: "#cce7e4",
  },
  vertical_pull: {
    bg: "#e8f3ff",
    text: "#4d7190",
    border: "#d1e1f2",
  },
  horizontal_row: {
    bg: "#edf3f0",
    text: "#5c746b",
    border: "#d7e3dd",
  },
};

const FALLBACK_TONES: MovementTone[] = [
  { bg: "#e8f1ff", text: "#4f6f9a", border: "#cdddf5" },
  { bg: "#efe9ff", text: "#6d5f98", border: "#ddd3f7" },
  { bg: "#fff0e7", text: "#9a6b56", border: "#f2d9ca" },
  { bg: "#e7f5ea", text: "#56785f", border: "#9fcbb0" },
  { bg: "#fff4df", text: "#8c6d3f", border: "#efddba" },
  { bg: "#e7f7f6", text: "#4f7f7b", border: "#cce7e4" },
];

function normaliseMovementTypeKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function getFallbackTone(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return FALLBACK_TONES[hash % FALLBACK_TONES.length];
}

function getMovementTypeTone(movementTypeName: string): MovementTone {
  const key = normaliseMovementTypeKey(movementTypeName);
  return MOVEMENT_TYPE_TONES[key] ?? getFallbackTone(key);
}

type MovementToneStyle = CSSProperties & {
  "--movement-bg": string;
  "--movement-text": string;
  "--movement-border": string;
};

function getMovementToneStyle(tone: MovementTone): MovementToneStyle {
  return {
    "--movement-bg": tone.bg,
    "--movement-text": tone.text,
    "--movement-border": tone.border,
  };
}

type SessionActionState = "locked" | "available" | "ready";

function getFinishActionState(
  started: boolean,
  finished: boolean,
  percentage: number
): SessionActionState {
  if (!started || finished) {
    return "locked";
  }

  if (percentage >= 100) {
    return "ready";
  }

  if (percentage >= 50) {
    return "available";
  }

  return "locked";
}

export default function SessionPage() {
  const { sessionInstanceId } = useParams<{ sessionInstanceId: string }>();
  const navigate = useNavigate();

  const [sessionView, setSessionView] = useState<SessionInstanceView | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(
    {}
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadSessionPage() {
      if (!sessionInstanceId) {
        setErrorMessage("No session was provided.");
        setIsLoading(false);
        return;
      }

      try {
        const view = await getSessionInstanceView(sessionInstanceId);

        if (!view) {
          setErrorMessage("Session not found.");
          return;
        }

        setSessionView(view);

        const initialCollapsedState = view.muscleGroups.reduce<
          Record<string, boolean>
        >((acc, group) => {
          acc[group.sessionTemplateMuscleGroup.id] = false;
          return acc;
        }, {});

        setCollapsedGroups(initialCollapsedState);
      } catch (error) {
        console.error("Failed to load session page:", error);
        setErrorMessage("Could not load session data.");
      } finally {
        setIsLoading(false);
      }
    }

    loadSessionPage();
  }, [sessionInstanceId]);

  const sessionWorkingSetProgress = useMemo(() => {
    if (!sessionView) {
      return { completed: 0, target: 0, percentage: 0 };
    }

    const completed = sessionView.muscleGroups.reduce(
      (sum, group) =>
        sum +
        group.exercises.reduce(
          (groupSum, exercise) => groupSum + exercise.workingSetCount,
          0
        ),
      0
    );

    const target = sessionView.muscleGroups.reduce(
      (sum, group) => sum + group.sessionTemplateMuscleGroup.targetWorkingSets,
      0
    );

    const percentage = target > 0 ? clampPercentage((completed / target) * 100) : 0;

    return { completed, target, percentage };
  }, [sessionView]);

  const sortedMuscleGroups = useMemo(() => {
    if (!sessionView) {
      return [];
    }

    return [...sessionView.muscleGroups]
      .map((group) => {
        const movementTypeSetCounts = new Map<string, number>();

        for (const exercise of group.exercises) {
          const key = exercise.movementType.id;
          movementTypeSetCounts.set(
            key,
            (movementTypeSetCounts.get(key) ?? 0) + exercise.workingSetCount
          );
        }

        const sortedExercises = [...group.exercises].sort((a, b) => {
          const aMovementTypeSets = movementTypeSetCounts.get(a.movementType.id) ?? 0;
          const bMovementTypeSets = movementTypeSetCounts.get(b.movementType.id) ?? 0;

          if (aMovementTypeSets !== bMovementTypeSets) {
            return aMovementTypeSets - bMovementTypeSets;
          }

          if (a.workingSetCount !== b.workingSetCount) {
            return a.workingSetCount - b.workingSetCount;
          }

          return a.exerciseTemplate.exerciseName.localeCompare(
            b.exerciseTemplate.exerciseName
          );
        });

        const totalWorkingSets = group.exercises.reduce(
          (sum, exercise) => sum + exercise.workingSetCount,
          0
        );

        return {
          ...group,
          exercises: sortedExercises,
          totalWorkingSets,
        };
      })
      .sort((a, b) => {
        if (a.totalWorkingSets !== b.totalWorkingSets) {
          return a.totalWorkingSets - b.totalWorkingSets;
        }

        return a.sessionTemplateMuscleGroup.order - b.sessionTemplateMuscleGroup.order;
      });
  }, [sessionView]);

  function toggleGroup(groupId: string) {
    setCollapsedGroups((current) => ({
      ...current,
      [groupId]: !current[groupId],
    }));
  }

  async function reloadSessionView() {
    if (!sessionInstanceId) {
      return;
    }

    const view = await getSessionInstanceView(sessionInstanceId);

    if (view) {
      setSessionView(view);
    }
  }

  async function runSessionAction<T>(
    action: (id: string) => Promise<T>,
    failureMessage: string
  ) {
    if (!sessionInstanceId) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);
      await action(sessionInstanceId);
      await reloadSessionView();
    } catch (error) {
      console.error(failureMessage, error);
      setErrorMessage(failureMessage);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStartSession() {
    await runSessionAction(startSessionInstance, "Could not start session.");
  }

  async function handleFinishSession() {
    if (!sessionView) {
      return;
    }

    const started = Boolean(sessionView.sessionInstance.startedAt);
    const finished = Boolean(sessionView.sessionInstance.completedAt);

    if (!started || finished) {
      return;
    }

    const percentage = sessionWorkingSetProgress.percentage;
    const requiresConfirmation = percentage < 50;

    if (requiresConfirmation) {
      const confirmed = window.confirm(
        "You are below 50% of the session volume target. Finish session anyway?"
      );

      if (!confirmed) {
        return;
      }
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);

      await stopSessionInstance(sessionView.sessionInstance.id);
      navigate("/week");
    } catch (error) {
      console.error("Could not finish session.", error);
      setErrorMessage("Could not finish session.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleOpenExercise(
    exerciseTemplateId: string,
    sessionExerciseInstanceId: string | null
  ) {
    if (!sessionView) {
      return;
    }

    try {
      setIsSaving(true);

      const exerciseInstance = sessionExerciseInstanceId
        ? { id: sessionExerciseInstanceId }
        : await ensureExerciseInstance(sessionView.sessionInstance.id, exerciseTemplateId);

      if (!exerciseInstance) {
        setErrorMessage("Could not open exercise.");
        return;
      }

      navigate(`/exercise/${exerciseInstance.id}`);
    } catch (error) {
      console.error("Failed to open exercise:", error);
      setErrorMessage("Could not open exercise.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="session-page">
        <TopBar title="Session" backTo="/week" backLabel="Back to week" />
        <section className="session-shell">
          <p>Loading session...</p>
        </section>
        <BottomNav activeTab="session" />
      </main>
    );
  }

  if (errorMessage && !sessionView) {
    return (
      <main className="session-page">
        <TopBar title="Session" backTo="/week" backLabel="Back to week" />
        <section className="session-shell">
          <p>{errorMessage}</p>
        </section>
        <BottomNav activeTab="session" />
      </main>
    );
  }

  if (!sessionView) {
    return null;
  }

  const sessionStarted = Boolean(sessionView.sessionInstance.startedAt);
  const sessionFinished = Boolean(sessionView.sessionInstance.completedAt);
  const finishActionState = getFinishActionState(
    sessionStarted,
    sessionFinished,
    sessionWorkingSetProgress.percentage
  );

  const startButtonLabel = !sessionStarted
    ? isSaving
      ? "Starting..."
      : "Start"
    : "Started";

  const finishButtonLabel = sessionFinished
    ? "Finished"
    : isSaving && sessionStarted
      ? "Finishing..."
      : "Finish";

  const finishButtonTitle =
    !sessionStarted
      ? "Start the session first"
      : finishActionState === "locked"
        ? "Finish early"
        : finishActionState === "available"
          ? "Volume target progressing"
          : "Volume target reached";

  return (
    <main className="session-page">
      <TopBar title="Session" backTo="/week" backLabel="Back to week" />

      <section className="session-shell">
        <header className="session-header">
          <div className="session-summary">
            <div className="session-summary-top">
              <h1 className="session-title">
                Program day: {sessionView.sessionTemplate.name}
              </h1>
            </div>

            <p className="session-context">
              Target RIR: {sessionView.weekTemplate.targetRir ?? "—"}
            </p>

            <div className="session-controls" aria-label="Session controls">
              <button
                type="button"
                className="session-control-button session-control-button--start"
                onClick={handleStartSession}
                disabled={isSaving || sessionStarted}
              >
                {startButtonLabel}
              </button>

              <button
                type="button"
                className={[
                  "session-control-button",
                  "session-control-button--finish",
                  `session-control-button--finish-${finishActionState}`,
                  sessionFinished ? "session-control-button--done" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={handleFinishSession}
                disabled={isSaving || !sessionStarted || sessionFinished}
                title={finishButtonTitle}
              >
                {finishButtonLabel}
              </button>
            </div>

            <div className="session-progress-block">
              <div className="session-progress-row">
                <span className="session-progress-label">Volume target</span>
                <span className="session-progress-value">
                  {sessionWorkingSetProgress.completed} / {sessionWorkingSetProgress.target}
                </span>
              </div>

              <div
                className={`session-progress-track${
                  sessionFinished ? " session-progress-track--complete" : ""
                }`}
                aria-label={`Volume target ${sessionWorkingSetProgress.completed} of ${sessionWorkingSetProgress.target} working sets`}
              >
                <span
                  className={`session-progress-fill${
                    sessionFinished ? " session-progress-fill--complete" : ""
                  }`}
                  style={{ width: `${sessionWorkingSetProgress.percentage}%` }}
                />
              </div>
            </div>

            {errorMessage && <p className="session-inline-message">{errorMessage}</p>}
          </div>
        </header>

        <section>
          {sortedMuscleGroups.length === 0 ? (
            <p>No exercises found for this session.</p>
          ) : (
            <div className="muscle-group-list">
              {sortedMuscleGroups.map(
                ({ sessionTemplateMuscleGroup, muscleGroup, exercises }) => {
                  const workingSetsCompleted = exercises.reduce(
                    (sum, exercise) => sum + exercise.workingSetCount,
                    0
                  );

                  const targetWorkingSets =
                    sessionTemplateMuscleGroup.targetWorkingSets;

                  const progressDotCount = Math.max(
                    targetWorkingSets,
                    workingSetsCompleted
                  );

                  const filledDotTones = exercises.flatMap((exercise) => {
                    const tone = getMovementTypeTone(exercise.movementType.name);

                    return Array.from(
                      { length: exercise.workingSetCount },
                      () => tone
                    );
                  });

                  const isCollapsed =
                    collapsedGroups[sessionTemplateMuscleGroup.id] ?? false;

                  return (
                    <section
                      key={sessionTemplateMuscleGroup.id}
                      className="muscle-group-card"
                    >
                      <button
                        type="button"
                        className="muscle-group-card__toggle"
                        onClick={() => toggleGroup(sessionTemplateMuscleGroup.id)}
                        aria-expanded={!isCollapsed}
                      >
                        <div className="muscle-group-card__header-main">
                          <h2 className="muscle-group-card__title">
                            {muscleGroup.name}
                          </h2>

                          <div
                            className="volume-dots"
                            aria-label={`${workingSetsCompleted} of ${targetWorkingSets} working sets completed for ${muscleGroup.name}`}
                          >
                            {Array.from({ length: progressDotCount }).map((_, index) => {
                              const isFilled = index < workingSetsCompleted;
                              const isOverflow = index >= targetWorkingSets;
                              const tone = filledDotTones[index];

                              return (
                                <span
                                  key={`${sessionTemplateMuscleGroup.id}-${index}`}
                                  className={[
                                    "volume-dot",
                                    isFilled ? "volume-dot--filled" : "volume-dot--empty",
                                    isOverflow ? "volume-dot--overflow" : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                  style={
                                    isFilled && tone
                                      ? getMovementToneStyle(tone)
                                      : undefined
                                  }
                                />
                              );
                            })}
                          </div>
                        </div>

                        <span className="muscle-group-card__chevron">
                          {isCollapsed ? "▾" : "▴"}
                        </span>
                      </button>

                      {!isCollapsed && (
                        <ul className="exercise-list">
                          {exercises.map(
                            ({ exerciseTemplate, movementType, exerciseInstance }) => {
                              const tone = getMovementTypeTone(movementType.name);

                              return (
                                <li
                                  key={exerciseTemplate.id}
                                  className="exercise-card-wrap"
                                >
                                  <button
                                    type="button"
                                    className="exercise-card exercise-card--button"
                                    onClick={() =>
                                      handleOpenExercise(
                                        exerciseTemplate.id,
                                        exerciseInstance?.id ?? null
                                      )
                                    }
                                  >
                                    <div className="exercise-card__top-row">
                                      <div className="exercise-card__title-block">
                                        <h3 className="exercise-card__title">
                                          {exerciseTemplate.exerciseName}
                                        </h3>

                                        <span className="exercise-card__status">
                                          {getExerciseStatusLabel(
                                            exerciseInstance?.status
                                          )}
                                        </span>
                                      </div>

                                      <span
                                        className="exercise-chip exercise-chip--tone"
                                        style={getMovementToneStyle(tone)}
                                      >
                                        {movementType.name}
                                      </span>
                                    </div>
                                  </button>
                                </li>
                              );
                            }
                          )}
                        </ul>
                      )}
                    </section>
                  );
                }
              )}
            </div>
          )}
        </section>

        {sessionFinished && (
          <footer className="session-footer session-footer--summary">
            <div className="session-times session-times--footer">
              <p className="session-time-row">
                <span className="session-time-label">Finished</span>
                <span className="session-time-value">
                  {formatDateTime(sessionView.sessionInstance.completedAt)}
                </span>
              </p>
            </div>
          </footer>
        )}
      </section>

      <BottomNav activeTab="session" />
    </main>
  );
}