import { create } from "zustand";

import { withoutBlocker } from "./organize";
import { loadTasks, saveTasks } from "./storage";
import type { Task, TaskStatus } from "./types";
import { clampResult } from "./validation";

export interface RepositoryTasks {
  tasks: Task[];
  loaded: boolean;
  loadFailed: boolean;
}

interface TasksState {
  /** The board of every loaded repository, keyed by its root path. */
  byRoot: Record<string, RepositoryTasks>;
  load: (rootPath: string) => Promise<void>;
  unload: (rootPath: string) => void;
  saveTask: (rootPath: string, task: Task) => Promise<void>;
  addTasks: (rootPath: string, tasks: Task[]) => Promise<void>;
  moveTask: (rootPath: string, taskId: string, status: TaskStatus) => Promise<void>;
  deleteTask: (rootPath: string, taskId: string) => Promise<void>;
  linkSession: (rootPath: string, taskId: string, sessionId: string) => Promise<void>;
  handleSessionDone: (sessionId: string, summary: string | null) => void;
}

const NOT_LOADED: RepositoryTasks = { tasks: [], loaded: false, loadFailed: false };

export function repositoryTasks(
  byRoot: Readonly<Record<string, RepositoryTasks>>,
  rootPath: string | null,
): RepositoryTasks {
  return (rootPath ? byRoot[rootPath] : undefined) ?? NOT_LOADED;
}

/// The task a session works on, in whichever repository it lives.
export function findSessionTask(
  byRoot: Readonly<Record<string, RepositoryTasks>>,
  sessionId: string,
): Task | undefined {
  for (const { tasks } of Object.values(byRoot)) {
    const task = tasks.find((item) => item.sessionId === sessionId);
    if (task) return task;
  }
  return undefined;
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
  const loads = new Map<string, symbol>();

  const setRoot = (rootPath: string, entry: RepositoryTasks) =>
    set((state) => ({ byRoot: { ...state.byRoot, [rootPath]: entry } }));

  const tasksOf = (rootPath: string) => repositoryTasks(get().byRoot, rootPath).tasks;

  const commit = async (rootPath: string, tasks: Task[]) => {
    // Saving before the load finished would replace the stored list.
    if (!get().byRoot[rootPath]?.loaded) return;
    setRoot(rootPath, { tasks, loaded: true, loadFailed: false });
    await saveTasks(rootPath, tasks);
  };

  return {
    byRoot: {},

    load: async (rootPath) => {
      const token = Symbol(rootPath);
      loads.set(rootPath, token);
      setRoot(rootPath, NOT_LOADED);
      try {
        const tasks = await loadTasks(rootPath);
        if (loads.get(rootPath) === token)
          setRoot(rootPath, { ...NOT_LOADED, tasks, loaded: true });
      } catch {
        if (loads.get(rootPath) === token) setRoot(rootPath, { ...NOT_LOADED, loadFailed: true });
      }
    },

    unload: (rootPath) => {
      loads.delete(rootPath);
      if (!(rootPath in get().byRoot)) return;
      set((state) => {
        const byRoot = { ...state.byRoot };
        delete byRoot[rootPath];
        return { byRoot };
      });
    },

    saveTask: async (rootPath, task) => {
      const tasks = tasksOf(rootPath);
      const exists = tasks.some((item) => item.id === task.id);
      await commit(
        rootPath,
        exists ? tasks.map((item) => (item.id === task.id ? task : item)) : [...tasks, task],
      );
    },

    addTasks: async (rootPath, tasks) => {
      if (tasks.length > 0) await commit(rootPath, [...tasksOf(rootPath), ...tasks]);
    },

    moveTask: async (rootPath, taskId, status) => {
      const task = tasksOf(rootPath).find((item) => item.id === taskId);
      if (!task || task.status === status) return;
      await commit(rootPath, updateTask(tasksOf(rootPath), taskId, { status }));
    },

    deleteTask: async (rootPath, taskId) => {
      await commit(
        rootPath,
        withoutBlocker(tasksOf(rootPath), taskId).filter((task) => task.id !== taskId),
      );
    },

    linkSession: async (rootPath, taskId, sessionId) => {
      await commit(
        rootPath,
        updateTask(tasksOf(rootPath), taskId, { sessionId, status: "in_progress" }),
      );
    },

    handleSessionDone: (sessionId, summary) => {
      for (const [rootPath, { tasks }] of Object.entries(get().byRoot)) {
        if (!tasks.some((task) => task.sessionId === sessionId && task.status === "in_progress")) {
          continue;
        }
        void commit(rootPath, applySessionDone(tasks, sessionId, summary, Date.now())).catch(
          () => {},
        );
      }
    },
  };
});

/// The board of one repository; an empty, unloaded board while it loads or without a repository.
export function useRepositoryTasks(rootPath: string | null): RepositoryTasks {
  return useTasksStore((state) => repositoryTasks(state.byRoot, rootPath));
}
