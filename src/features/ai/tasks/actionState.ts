import type { Task } from "./types";

export interface TaskActionState {
  canRun: boolean;
  canStop: boolean;
  canResume: boolean;
}

/// Only one chat runs at a time, so Run and Resume also wait for any other live session.
export function resolveTaskActions(
  task: Pick<Task, "sessionId">,
  liveSessionId: string | null,
  sessionExists: boolean,
): TaskActionState {
  const linkedRunning = task.sessionId !== undefined && task.sessionId === liveSessionId;
  const otherRunning = liveSessionId !== null && !linkedRunning;
  return {
    canRun: !linkedRunning && !otherRunning,
    canStop: linkedRunning,
    canResume: task.sessionId !== undefined && sessionExists && !linkedRunning && !otherRunning,
  };
}
