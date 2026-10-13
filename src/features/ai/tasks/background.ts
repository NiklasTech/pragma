import { invoke } from "@tauri-apps/api/core";

import { useAIStore, type ChatSession, type WorkEnvironment } from "@/shared/stores/ai";
import { useNamedAgentsStore } from "@/features/ai/named-agents/store";
import type { Agent } from "@/features/ai/named-agents/types";

import { getChildRun, isRunLive } from "../children/runStore";
import { createWorktreeEnvironment } from "../worktree/create";
import { NO_TASK_ENGINE_MESSAGE, taskEngine } from "./engine";
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
  const agent = findAgent(task);
  if (task.agentId && !agent) return "The assigned agent no longer exists";
  if (!taskEngine(agent?.engine)) return NO_TASK_ENGINE_MESSAGE;
  return null;
}

function findAgent(task: Task): Agent | undefined {
  return task.agentId
    ? useNamedAgentsStore.getState().agents.find((item) => item.id === task.agentId)
    : undefined;
}

/// Removes a worktree no session uses, so failed scheduled runs do not pile up worktrees.
async function discardWorktree(rootPath: string, worktree: WorkEnvironment): Promise<void> {
  try {
    await invoke("git_session_worktree_remove", {
      repoPath: rootPath,
      worktreePath: worktree.path,
      force: true,
    });
    await invoke("git_session_delete_branch", { repoPath: rootPath, branch: worktree.branch });
    await useAIStore.getState().deleteEnvironment(rootPath, worktree.id);
  } catch {
    // The run is skipped either way; a leftover worktree can still be removed by hand.
  }
}

/// Starts a task in a fresh worktree session that runs without a pane; returns an error or null.
export async function startTaskInBackground(
  rootPath: string,
  task: Task,
  title = task.title.trim(),
): Promise<string | null> {
  const blocker = backgroundStartBlocker(task, useTasksStore.getState().tasks);
  if (blocker) return blocker;
  const agent = findAgent(task);
  const engine = taskEngine(agent?.engine);
  if (!engine) return NO_TASK_ENGINE_MESSAGE;

  let session: ChatSession;
  try {
    const worktree = await createWorktreeEnvironment(rootPath);
    // Parallel runs in the shared checkout would overwrite each other's files.
    if (worktree.setupStatus !== "ready") {
      await discardWorktree(rootPath, worktree);
      return "The worktree setup script failed";
    }
    session = await useAIStore.getState().createChatSession(
      rootPath,
      {
        title,
        kind: "agent",
        environment: "worktree",
        environmentId: worktree.id,
        cliProviderId: engine.cliProviderId,
        agentId: agent?.id,
        agentEngine: engine,
      },
      { activate: false },
    );
  } catch (err) {
    return `Could not create a worktree session: ${String(err)}`;
  }

  try {
    await useTasksStore.getState().linkSession(task.id, session.id);
    const { startChildRun } = await import("../children/runner");
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
  const { sessionId } = task;
  void import("../children/runner").then((m) => m.stopChildRun(rootPath, sessionId));
  return true;
}
