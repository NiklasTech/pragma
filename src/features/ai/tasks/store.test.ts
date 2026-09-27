import { describe, expect, it } from "vite-plus/test";

import { applySessionDone } from "./store";
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
