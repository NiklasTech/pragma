import { describe, expect, it } from "vite-plus/test";

import type { Task } from "./types";
import { dueRepositoryTasks, dueTasks } from "./useTaskAutomation";

const base = new Date(2026, 9, 9, 8, 0).getTime();
const minute = 60_000;

function task(id: string, schedule?: Task["schedule"]): Task {
  return {
    id,
    title: id,
    notes: "",
    status: "todo",
    result: "",
    schedule,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe("dueTasks", () => {
  it("plans first, fires once when due and never catches up", () => {
    const planned = new Map();
    const daily = task("a", { frequency: "daily", hour: 8, minute: 30 });
    expect(dueTasks([daily], planned, base)).toEqual([]);
    expect(dueTasks([daily], planned, base + 29 * minute)).toEqual([]);
    expect(dueTasks([daily], planned, base + 31 * minute)).toEqual([daily]);
    expect(dueTasks([daily], planned, base + 32 * minute)).toEqual([]);
  });

  it("skips paused and unscheduled tasks and replans on change", () => {
    const planned = new Map();
    const paused = task("p", { frequency: "daily", hour: 8, minute: 1, paused: true });
    expect(dueTasks([paused, task("n")], planned, base)).toEqual([]);
    expect(planned.size).toBe(0);

    const early = task("a", { frequency: "daily", hour: 8, minute: 10 });
    dueTasks([early], planned, base);
    const later = task("a", { frequency: "daily", hour: 9, minute: 0 });
    expect(dueTasks([later], planned, base + 20 * minute)).toEqual([]);
    expect(dueTasks([], planned, base)).toEqual([]);
    expect(planned.size).toBe(0);
  });
});

describe("dueRepositoryTasks", () => {
  const loaded = (tasks: Task[]) => ({ tasks, loaded: true, loadFailed: false });

  it("starts scheduled tasks of every open repository", () => {
    const planned = new Map();
    const inA = task("a", { frequency: "daily", hour: 8, minute: 30 });
    const inB = task("b", { frequency: "daily", hour: 8, minute: 30 });
    const byRoot = { "/code/a": loaded([inA]), "/code/b": loaded([inB]) };

    expect(dueRepositoryTasks(byRoot, planned, base)).toEqual([]);
    expect(dueRepositoryTasks(byRoot, planned, base + 31 * minute)).toEqual([
      { rootPath: "/code/a", task: inA },
      { rootPath: "/code/b", task: inB },
    ]);
  });

  it("plans tasks with the same id in each repository on their own", () => {
    const planned = new Map();
    const early = task("same", { frequency: "daily", hour: 8, minute: 10 });
    const late = task("same", { frequency: "daily", hour: 9, minute: 0 });
    const byRoot = { "/code/a": loaded([early]), "/code/b": loaded([late]) };

    dueRepositoryTasks(byRoot, planned, base);
    expect(dueRepositoryTasks(byRoot, planned, base + 20 * minute)).toEqual([
      { rootPath: "/code/a", task: early },
    ]);
  });

  it("skips loading repositories and forgets closed ones", () => {
    const planned = new Map();
    const scheduled = task("a", { frequency: "daily", hour: 8, minute: 30 });
    dueRepositoryTasks({ "/code/a": loaded([scheduled]) }, planned, base);
    expect(planned.has("/code/a")).toBe(true);

    const loading = { tasks: [scheduled], loaded: false, loadFailed: false };
    expect(dueRepositoryTasks({ "/code/a": loading }, planned, base + 31 * minute)).toEqual([]);
    expect(planned.size).toBe(0);
  });
});
