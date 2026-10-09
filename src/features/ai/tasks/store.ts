import { create } from "zustand";

import { withoutBlocker } from "./organize";
import { loadTasks, saveTasks } from "./storage";
import type { Task, TaskStatus } from "./types";
import { clampResult } from "./validation";

interface TasksState {
  rootPath: string | null;
  tasks: Task[];
  loaded: boolean;
  loadFailed: boolean;
  load: (rootPath: string) => Promise<void>;
  saveTask: (task: Task) => Promise<void>;
  moveTask: (taskId: string, status: TaskStatus) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  linkSession: (taskId: string, sessionId: string) => Promise<void>;
  handleSessionDone: (sessionId: string, summary: string | null) => void;
}

/// A finished run moves its In progress cards to In review; nothing moves to Done by itself.
export function applySessionDone(
  tasks: Task[],
  sessionId: string,
  summary: string | null,
  now: number,
): Task[] {
  const result = summary ? clampResult(summary) : "";
  return tasks.map((task) => {
    if (task.sessionId !== sessionId || task.status !== "in_progress") return task;
    return { ...task, status: "in_review", result: result || task.result, updatedAt: now };
  });
}

function updateTask(tasks: Task[], taskId: string, patch: Partial<Task>): Task[] {
  return tasks.map((task) =>
    task.id === taskId ? { ...task, ...patch, updatedAt: Date.now() } : task,
  );
}

export const useTasksStore = create<TasksState>()((set, get) => {
  const commit = async (tasks: Task[]) => {
    // Saving before the load finished would replace the stored list.
    const { rootPath, loaded } = get();
    if (!rootPath || !loaded) return;
    set({ tasks });
    await saveTasks(rootPath, tasks);
  };

  return {
    rootPath: null,
    tasks: [],
    loaded: false,
    loadFailed: false,

    load: async (rootPath) => {
      set({ rootPath, tasks: [], loaded: false, loadFailed: false });
      try {
        const tasks = await loadTasks(rootPath);
        if (get().rootPath === rootPath) set({ tasks, loaded: true });
      } catch {
        if (get().rootPath === rootPath) set({ loadFailed: true });
      }
    },

    saveTask: async (task) => {
      const exists = get().tasks.some((item) => item.id === task.id);
      await commit(
        exists
          ? get().tasks.map((item) => (item.id === task.id ? task : item))
          : [...get().tasks, task],
      );
    },

    moveTask: async (taskId, status) => {
      const task = get().tasks.find((item) => item.id === taskId);
      if (!task || task.status === status) return;
      await commit(updateTask(get().tasks, taskId, { status }));
    },

    deleteTask: async (taskId) => {
      await commit(withoutBlocker(get().tasks, taskId).filter((task) => task.id !== taskId));
    },

    linkSession: async (taskId, sessionId) => {
      await commit(updateTask(get().tasks, taskId, { sessionId, status: "in_progress" }));
    },

    handleSessionDone: (sessionId, summary) => {
      const tasks = get().tasks;
      if (!tasks.some((task) => task.sessionId === sessionId && task.status === "in_progress")) {
        return;
      }
      void commit(applySessionDone(tasks, sessionId, summary, Date.now())).catch(() => {});
    },
  };
});
