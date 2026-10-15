import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { isWorkspaceWindow } from "@/shared/lib/windowScope";
import { useAIStore } from "@/shared/stores/ai";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";

import { isRunLive, useChildRunsStore } from "../children/runStore";
import { releaseWorktrees } from "../worktree/cleanup";
import { startTaskInBackground } from "./background";
import { finishedTaskSessionIds } from "./finished";
import { nextRunAt, scheduledRunTitle } from "./schedule";
import { useTasksStore, type RepositoryTasks } from "./store";
import type { Task } from "./types";

const TICK_MS = 30_000;

interface Planned {
  key: string;
  at: number;
}

/// Due tasks, with the next time of every scheduled task planned from `now` when it is new or changed.
export function dueTasks(tasks: Task[], planned: Map<string, Planned>, now: number): Task[] {
  const due: Task[] = [];
  const scheduledIds = new Set<string>();
  for (const task of tasks) {
    if (!task.schedule || task.schedule.paused) continue;
    scheduledIds.add(task.id);
    const key = JSON.stringify(task.schedule);
    const entry = planned.get(task.id);
    if (!entry || entry.key !== key) {
      planned.set(task.id, { key, at: nextRunAt(task.schedule, now) });
    } else if (now >= entry.at) {
      due.push(task);
      planned.set(task.id, { key, at: nextRunAt(task.schedule, now) });
    }
  }
  for (const id of planned.keys()) if (!scheduledIds.has(id)) planned.delete(id);
  return due;
}

/// Due tasks of every loaded repository, each repository planned on its own.
export function dueRepositoryTasks(
  byRoot: Readonly<Record<string, RepositoryTasks>>,
  planned: Map<string, Map<string, Planned>>,
  now: number,
): Array<{ rootPath: string; task: Task }> {
  const due: Array<{ rootPath: string; task: Task }> = [];
  for (const [rootPath, { tasks, loaded }] of Object.entries(byRoot)) {
    if (!loaded) continue;
    let plannedRoot = planned.get(rootPath);
    if (!plannedRoot) {
      plannedRoot = new Map();
      planned.set(rootPath, plannedRoot);
    }
    for (const task of dueTasks(tasks, plannedRoot, now)) due.push({ rootPath, task });
  }
  for (const rootPath of planned.keys()) if (!byRoot[rootPath]?.loaded) planned.delete(rootPath);
  return due;
}

/// Keeps the tasks of every open repository loaded, starts scheduled tasks, moves finished background runs to review and removes the worktrees of finished tasks.
export function useTaskAutomation(): void {
  const paths = useOpenRepositoriesStore((state) => state.paths);
  const loadedRef = useRef(new Set<string>());

  useEffect(() => {
    if (!isWorkspaceWindow()) return;
    const { byRoot, load, unload } = useTasksStore.getState();
    const loaded = loadedRef.current;
    for (const path of paths) {
      if (loaded.has(path)) continue;
      loaded.add(path);
      if (!byRoot[path]) void load(path);
    }
    for (const path of loaded) {
      if (paths.includes(path)) continue;
      loaded.delete(path);
      unload(path);
    }
  }, [paths]);

  useEffect(() => {
    if (!isWorkspaceWindow()) return;
    const planned = new Map<string, Map<string, Planned>>();
    const tick = () => {
      const now = Date.now();
      const due = dueRepositoryTasks(useTasksStore.getState().byRoot, planned, now);
      for (const { rootPath, task } of due) {
        void startTaskInBackground(rootPath, task, scheduledRunTitle(task.title, now)).then(
          (error) => {
            if (error) toast.warning(`Skipped scheduled task "${task.title}": ${error}`);
          },
        );
      }
    };
    tick();
    const timer = setInterval(tick, TICK_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isWorkspaceWindow()) return;
    return useTasksStore.subscribe((state, previous) => {
      for (const [rootPath, current] of Object.entries(state.byRoot)) {
        const before = previous.byRoot[rootPath];
        if (!current.loaded || !before?.loaded || current.tasks === before.tasks) continue;
        const ids = new Set(finishedTaskSessionIds(before.tasks, current.tasks));
        if (ids.size === 0) continue;
        const sessions = useAIStore
          .getState()
          .chatSessions.filter((session) => ids.has(session.id));
        void releaseWorktrees(rootPath, sessions);
      }
    });
  }, []);

  useEffect(
    () =>
      useChildRunsStore.subscribe((state, previous) => {
        for (const [sessionId, run] of Object.entries(state.runs)) {
          const before = previous.runs[sessionId];
          if (run.status === "done" && isRunLive(before)) {
            useTasksStore.getState().handleSessionDone(sessionId, run.summary);
          }
        }
      }),
    [],
  );
}
