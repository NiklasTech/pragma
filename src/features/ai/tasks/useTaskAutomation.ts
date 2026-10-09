import { useEffect } from "react";
import { toast } from "sonner";

import { isWorkspaceWindow } from "@/shared/lib/windowScope";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";

import { isRunLive, useChildRunsStore } from "../children/runStore";
import { startTaskInBackground } from "./background";
import { nextRunAt, scheduledRunTitle } from "./schedule";
import { useTasksStore } from "./store";
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

/// Keeps tasks loaded for the open folder, starts scheduled tasks and moves finished background runs to review.
export function useTaskAutomation(): void {
  const rootPath = useFileExplorerStore((state) => state.rootPath);

  useEffect(() => {
    if (!rootPath || !isWorkspaceWindow()) return;
    if (useTasksStore.getState().rootPath !== rootPath)
      void useTasksStore.getState().load(rootPath);

    const planned = new Map<string, Planned>();
    const tick = () => {
      const { tasks, loaded, rootPath: tasksRoot } = useTasksStore.getState();
      if (!loaded || tasksRoot !== rootPath) return;
      const now = Date.now();
      for (const task of dueTasks(tasks, planned, now)) {
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
  }, [rootPath]);

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
