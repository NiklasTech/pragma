import type { Task } from "./types";

export interface TaskActionState {
  canRun: boolean;
  canStop: boolean;
  canResume: boolean;
}

/// Only one chat runs at a time, so Run and Resume also wait for any other live session.
/// A task with an open blocker cannot start or resume.
export function resolveTaskActions(
  task: Pick<Task, "sessionId">,
  liveSessionId: string | null,
  sessionExists: boolean,
  blocked = false,
): TaskActionState {
  const linkedRunning = task.sessionId !== undefined && task.sessionId === liveSessionId;
  const otherRunning = liveSessionId !== null && !linkedRunning;
  return {
    canRun: !linkedRunning && !otherRunning && !blocked,
    canStop: linkedRunning,
    canResume:
      task.sessionId !== undefined && sessionExists && !linkedRunning && !otherRunning && !blocked,
  };
}
