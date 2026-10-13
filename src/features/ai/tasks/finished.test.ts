import { describe, expect, it } from "vite-plus/test";

import { finishedTaskSessionIds } from "./finished";
import type { Task, TaskStatus } from "./types";

function task(id: string, status: TaskStatus, sessionId?: string): Task {
  return { id, title: id, notes: "", status, sessionId, result: "", createdAt: 0, updatedAt: 0 };
}

describe("finishedTaskSessionIds", () => {
  it("returns sessions of tasks moved to Done", () => {
    const before = [task("a", "in_review", "s1"), task("b", "in_progress", "s2")];
    const after = [task("a", "done", "s1"), task("b", "in_review", "s2")];
    expect(finishedTaskSessionIds(before, after)).toEqual(["s1"]);
  });

  it("returns sessions of deleted tasks", () => {
    expect(finishedTaskSessionIds([task("a", "todo", "s1")], [])).toEqual(["s1"]);
  });

  it("ignores tasks without a session and tasks that were already done", () => {
    const before = [task("a", "todo"), task("b", "done", "s2")];
    expect(finishedTaskSessionIds(before, [task("a", "done")])).toEqual([]);
  });
});
