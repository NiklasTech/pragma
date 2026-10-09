import type { Task } from "./types";

export interface TaskActionState {
  canRun: boolean;
  canStop: boolean;
  canResume: boolean;
}

/// Only one chat runs at a time, so Run and Resume also wait for any other live session.
/// A task with an open blocker cannot start or resume; one running in the background can only stop.
export function resolveTaskActions(
  task: Pick<Task, "sessionId">,
  liveSessionId: string | null,
  sessionExists: boolean,
  blocked = false,
  runningInBackground = false,
): TaskActionState {
  const linkedRunning = task.sessionId !== undefined && task.sessionId === liveSessionId;
  const otherRunning = liveSessionId !== null && !linkedRunning;
  const idle = !linkedRunning && !otherRunning && !blocked && !runningInBackground;
  return {
    canRun: idle,
    canStop: linkedRunning || runningInBackground,
    canResume: task.sessionId !== undefined && sessionExists && idle,
  };
}
