import { describe, expect, it } from "vite-plus/test";

import {
  dependentTaskIds,
  filterTasks,
  listLabels,
  openBlockers,
  parseLabels,
  validateLabels,
  withoutBlocker,
} from "./organize";
import type { Task, TaskStatus } from "./types";

function task(id: string, extra: Partial<Task> = {}, status: TaskStatus = "todo"): Task {
  return { id, title: id, notes: "", status, result: "", createdAt: 1, updatedAt: 1, ...extra };
}

describe("labels", () => {
  it("parses comma separated labels without blanks or repeats", () => {
    expect(parseLabels(" bug, UI ,, bug ,ui, docs")).toEqual(["bug", "UI", "docs"]);
    expect(parseLabels("  ")).toEqual([]);
  });

  it("limits the count and length", () => {
    expect(validateLabels(["a", "b"])).toBeNull();
    expect(validateLabels(Array.from({ length: 11 }, (_, i) => `l${i}`))).not.toBeNull();
    expect(validateLabels(["x".repeat(33)])).not.toBeNull();
  });

  it("lists each label once, sorted", () => {
    const tasks = [task("a", { labels: ["ui", "Bug"] }), task("b", { labels: ["bug", "api"] })];
    expect(listLabels(tasks)).toEqual(["api", "Bug", "ui"]);
  });
});

describe("blockers", () => {
  it("counts only blockers that are not done", () => {
    const tasks = [task("a"), task("b", {}, "done"), task("c", { blockedBy: ["a", "b", "gone"] })];
    expect(openBlockers(tasks[2], tasks).map((t) => t.id)).toEqual(["a"]);
    expect(openBlockers(task("d"), tasks)).toEqual([]);
  });

  it("finds every task that waits on a task, also through others", () => {
    const tasks = [task("a"), task("b", { blockedBy: ["a"] }), task("c", { blockedBy: ["b"] })];
    expect([...dependentTaskIds("a", tasks)].sort()).toEqual(["b", "c"]);
    expect(dependentTaskIds("c", tasks).size).toBe(0);
  });

  it("drops a deleted task from every blocker list", () => {
    const tasks = [task("a"), task("b", { blockedBy: ["a", "c"] })];
    expect(withoutBlocker(tasks, "a")[1].blockedBy).toEqual(["c"]);
    expect(withoutBlocker(tasks, "x")[1]).toBe(tasks[1]);
  });
});

describe("board filter", () => {
  const tasks = [
    task("low", { priority: "low", labels: ["ui"] }),
    task("none", { labels: ["api"] }),
    task("high", { priority: "high", labels: ["UI"] }),
    task("medium", { priority: "medium" }),
  ];

  it("puts higher priorities first and keeps the rest in order", () => {
    expect(filterTasks(tasks, { priority: null, label: null }).map((t) => t.id)).toEqual([
      "high",
      "medium",
      "low",
      "none",
    ]);
  });

  it("filters by priority and by label, ignoring case", () => {
    expect(filterTasks(tasks, { priority: "low", label: null }).map((t) => t.id)).toEqual(["low"]);
    expect(filterTasks(tasks, { priority: null, label: "ui" }).map((t) => t.id)).toEqual([
      "high",
      "low",
    ]);
  });
});
