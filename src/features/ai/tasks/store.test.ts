import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const storage = vi.hoisted(() => ({
  files: {} as Record<string, unknown[]>,
  saves: [] as string[],
}));

vi.mock("./storage", () => ({
  loadTasks: async (rootPath: string) => storage.files[rootPath] ?? [],
  saveTasks: async (rootPath: string, tasks: unknown[]) => {
    storage.saves.push(rootPath);
    storage.files[rootPath] = tasks;
  },
}));

import { applySessionDone, findSessionTask, repositoryTasks, useTasksStore } from "./store";
import type { Task, TaskStatus } from "./types";

function task(id: string, status: TaskStatus, sessionId?: string): Task {
  return { id, title: id, notes: "", status, sessionId, result: "", createdAt: 1, updatedAt: 1 };
}

describe("finished session", () => {
  it("moves an In progress card to In review and no further", () => {
    const [moved] = applySessionDone([task("a", "in_progress", "s1")], "s1", null, 5);
    expect(moved.status).toBe("in_review");
    expect(moved.updatedAt).toBe(5);
  });

  it("leaves cards of other sessions and other columns alone", () => {
    const tasks = [task("a", "in_progress", "s2"), task("b", "done", "s1"), task("c", "todo")];
    expect(applySessionDone(tasks, "s1", null, 5)).toEqual(tasks);
  });

  it("stores the run summary as the result", () => {
    const [moved] = applySessionDone([task("a", "in_progress", "s1")], "s1", " Fixed it. ", 5);
    expect(moved.result).toBe("Fixed it.");
  });
});

describe("tasks per repository", () => {
  const A = "/code/a";
  const B = "/code/b";

  beforeEach(async () => {
    storage.files = { [A]: [task("a1", "todo")], [B]: [task("b1", "todo"), task("b2", "todo")] };
    storage.saves = [];
    useTasksStore.setState({ byRoot: {} });
    await useTasksStore.getState().load(A);
    await useTasksStore.getState().load(B);
  });

  it("keeps the board of every loaded repository", () => {
    const { byRoot } = useTasksStore.getState();
    expect(repositoryTasks(byRoot, A).tasks.map((item) => item.id)).toEqual(["a1"]);
    expect(repositoryTasks(byRoot, B).tasks.map((item) => item.id)).toEqual(["b1", "b2"]);
    expect(repositoryTasks(byRoot, "/code/c").loaded).toBe(false);
  });

  it("moves, edits and deletes tasks in B without writing A's file", async () => {
    const store = useTasksStore.getState();
    await store.moveTask(B, "b1", "in_review");
    await store.saveTask(B, { ...task("b2", "todo"), title: "Renamed" });
    await store.deleteTask(B, "b2");
    await store.moveTask(B, "a1", "done");

    expect(storage.saves).toEqual([B, B, B]);
    const { byRoot } = useTasksStore.getState();
    expect(repositoryTasks(byRoot, A).tasks).toEqual([task("a1", "todo")]);
    expect(repositoryTasks(byRoot, B).tasks.map((item) => item.status)).toEqual(["in_review"]);
  });

  it("moves a finished run to review in the repository of its task", async () => {
    await useTasksStore.getState().linkSession(B, "b1", "s1");
    useTasksStore.getState().handleSessionDone("s1", null);
    await Promise.resolve();

    const { byRoot } = useTasksStore.getState();
    expect(findSessionTask(byRoot, "s1")?.status).toBe("in_review");
    expect(storage.saves).toEqual([B, B]);
  });

  it("drops a closed repository and never saves it before a new load", async () => {
    useTasksStore.getState().unload(A);
    await useTasksStore.getState().saveTask(A, task("a2", "todo"));

    expect(useTasksStore.getState().byRoot[A]).toBeUndefined();
    expect(storage.saves).toEqual([]);
  });
});
