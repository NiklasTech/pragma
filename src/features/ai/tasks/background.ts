import { useAIStore, type ChatSession } from "@/shared/stores/ai";
import { useNamedAgentsStore } from "@/features/ai/named-agents/store";

import { startChildRun, stopChildRun } from "../children/runner";
import { getChildRun, isRunLive } from "../children/runStore";
import { createSessionWorktree } from "../worktree/create";
import { openBlockers } from "./organize";
import { useTasksStore } from "./store";
import type { Task } from "./types";
import { buildTaskMessage } from "./validation";

export const MAX_PARALLEL_TASKS = 4;

export function isTaskRunningInBackground(task: Pick<Task, "sessionId">): boolean {
  return task.sessionId !== undefined && isRunLive(getChildRun(task.sessionId));
}

/// Why a task cannot start in the background now, or null when it can.
export function backgroundStartBlocker(task: Task, tasks: Task[]): string | null {
  if (openBlockers(task, tasks).length > 0) return "Finish the blocking tasks first";
  if (isTaskRunningInBackground(task)) return "The previous run is still active";
  if (task.agentId && !useNamedAgentsStore.getState().agents.some((a) => a.id === task.agentId)) {
    return "The assigned agent no longer exists";
  }
  return null;
}

/// Starts a task in a fresh worktree session that runs without a pane; returns an error or null.
export async function startTaskInBackground(
  rootPath: string,
  task: Task,
  title = task.title.trim(),
): Promise<string | null> {
  const blocker = backgroundStartBlocker(task, useTasksStore.getState().tasks);
  if (blocker) return blocker;
  const agent = task.agentId
    ? useNamedAgentsStore.getState().agents.find((item) => item.id === task.agentId)
    : undefined;

  const id = crypto.randomUUID();
  let session: ChatSession;
  try {
    const worktree = await createSessionWorktree(rootPath, id);
    // Parallel runs in the shared checkout would overwrite each other's files.
    if (worktree.status !== "ready") return "The worktree setup script failed";
    session = await useAIStore.getState().createChatSession(
      rootPath,
      {
        id,
        title,
        kind: "agent",
        environment: "worktree",
        worktree,
        agentId: agent?.id,
        agentEngine: agent?.engine ?? { kind: "builtin" },
      },
      { activate: false },
    );
  } catch (err) {
    return `Could not create a worktree session: ${String(err)}`;
  }

  try {
    await useTasksStore.getState().linkSession(task.id, session.id);
    await startChildRun(rootPath, session.id, buildTaskMessage(task));
  } catch (err) {
    return `Could not start the task: ${String(err)}`;
  }
  return null;
}

/// Starts each task one after another so worktree creation never races on the repository.
export async function startTasksInBackground(
  rootPath: string,
  tasks: Task[],
): Promise<{ started: number; failures: string[] }> {
  let started = 0;
  const failures: string[] = [];
  for (const task of tasks.slice(0, MAX_PARALLEL_TASKS)) {
    const error = await startTaskInBackground(rootPath, task);
    if (error) failures.push(`${task.title}: ${error}`);
    else started += 1;
  }
  return { started, failures };
}

export function stopBackgroundTask(rootPath: string, task: Task): boolean {
  if (!task.sessionId || !isTaskRunningInBackground(task)) return false;
  stopChildRun(rootPath, task.sessionId);
  return true;
}
