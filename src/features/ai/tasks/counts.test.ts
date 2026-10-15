import { describe, expect, it } from "vite-plus/test";

import { countActiveTasks } from "./counts";
import type { Task, TaskStatus } from "./types";

function task(id: string, status: TaskStatus): Task {
  return { id, title: id, notes: "", status, result: "", createdAt: 1, updatedAt: 1 };
}

describe("countActiveTasks", () => {
  it("counts tasks in progress and in review only", () => {
    const tasks = [
      task("a", "todo"),
      task("b", "in_progress"),
      task("c", "in_review"),
      task("d", "in_review"),
      task("e", "done"),
    ];
    expect(countActiveTasks(tasks)).toEqual({ in_progress: 1, in_review: 2 });
  });
});
