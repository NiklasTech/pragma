import { describe, expect, it } from "vite-plus/test";

import type { Task } from "./types";
import { dueTasks } from "./useTaskAutomation";

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
