import { describe, expect, it } from "vite-plus/test";

import { MAX_PANES } from "../panes/operations";
import { assignTasks, pickOnly, splitTasks, togglePoolAgent } from "./agentTeam";

const claude = { kind: "cli", manifestId: "claude" } as const;
const work = { kind: "cli", manifestId: "claude", accountDir: "/work" } as const;
const codex = { kind: "cli", manifestId: "codex" } as const;

describe("agent pool", () => {
  it("picks one agent with a plain click", () => {
    expect(pickOnly(codex)).toEqual([codex]);
  });

  it("adds an agent with ⌘-click and takes it out again, but never the last one", () => {
    const pool = togglePoolAgent([claude], work);
    expect(pool).toEqual([claude, work]);
    expect(togglePoolAgent(pool, work)).toEqual([claude]);
    expect(togglePoolAgent([claude], claude)).toEqual([claude]);
  });

  it("holds at most as many agents as a tab holds panes", () => {
    const full = Array.from({ length: MAX_PANES }, (_, index) => ({
      kind: "cli" as const,
      manifestId: `cli-${index}`,
    }));
    expect(togglePoolAgent(full, codex)).toEqual(full);
  });
});

describe("tasks of a start", () => {
  it("reads one task per line and skips blank lines", () => {
    expect(splitTasks("  add rate limiting \n\n fix the flaky test\n")).toEqual([
      "add rate limiting",
      "fix the flaky test",
    ]);
    expect(splitTasks("   ")).toEqual([]);
  });

  it("keeps at most as many tasks as a tab holds panes", () => {
    const lines = Array.from({ length: MAX_PANES + 3 }, (_, index) => `task ${index}`).join("\n");
    expect(splitTasks(lines)).toHaveLength(MAX_PANES);
  });

  it("spreads tasks over the pool in turn", () => {
    expect(assignTasks(3, [work, claude], {})).toEqual([work, claude, work]);
  });

  it("gives a task the agent picked for it", () => {
    expect(assignTasks(3, [work, claude], { 1: codex })).toEqual([work, codex, work]);
  });

  it("assigns nothing without an agent", () => {
    expect(assignTasks(2, [], {})).toEqual([]);
  });
});
