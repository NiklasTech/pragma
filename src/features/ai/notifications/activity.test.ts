import { describe, expect, it } from "vite-plus/test";

import type { AgentApproval } from "@/features/agent/store";

import type { ChildRun, ChildRunStatus } from "../children/runStore";
import {
  attentionMessage,
  childRunOutcomes,
  formatActivitySummary,
  resolveSessionActivity,
  type ActivityInput,
} from "./activity";

function run(status: ChildRunStatus): ChildRun {
  return { status, messages: [], approvals: [], todos: [], summary: null, error: null };
}

const approval: AgentApproval = {
  toolCallId: "call-1",
  toolName: "spawn_session",
  resolve: () => {},
};

const idle: ActivityInput = {
  liveSessionId: null,
  agentStatus: "idle",
  runSessionId: null,
  runs: {},
  spawnApprovals: {},
};

describe("resolveSessionActivity", () => {
  it("is empty without live runs", () => {
    expect(resolveSessionActivity(idle)).toEqual({ running: [], waiting: [] });
  });

  it("splits the focused run and child runs into running and waiting", () => {
    const activity = resolveSessionActivity({
      ...idle,
      liveSessionId: "main",
      agentStatus: "running",
      runSessionId: "main",
      runs: { a: run("running"), b: run("waiting-approval"), c: run("done") },
    });
    expect(activity).toEqual({ running: ["main", "a"], waiting: ["b"] });
  });

  it("counts a live CLI chat without an agent run", () => {
    expect(resolveSessionActivity({ ...idle, liveSessionId: "cli" }).running).toEqual(["cli"]);
  });

  it("moves a session waiting for approval out of running", () => {
    const activity = resolveSessionActivity({
      ...idle,
      liveSessionId: "main",
      agentStatus: "waiting-approval",
      runSessionId: "main",
    });
    expect(activity).toEqual({ running: [], waiting: ["main"] });
  });

  it("treats a pending spawn request as waiting", () => {
    const activity = resolveSessionActivity({
      ...idle,
      liveSessionId: "parent",
      spawnApprovals: { parent: [approval], other: [] },
    });
    expect(activity).toEqual({ running: [], waiting: ["parent"] });
  });
});

describe("formatActivitySummary", () => {
  it("leaves out empty parts", () => {
    expect(formatActivitySummary({ running: ["a", "b", "c"], waiting: ["d"] })).toBe(
      "3 running, 1 waiting",
    );
    expect(formatActivitySummary({ running: ["a"], waiting: [] })).toBe("1 running");
    expect(formatActivitySummary({ running: [], waiting: ["a", "b"] })).toBe("2 waiting");
  });
});

describe("childRunOutcomes", () => {
  it("reports runs that finished or failed", () => {
    const outcomes = childRunOutcomes(
      { a: run("running"), b: run("waiting-approval"), c: run("running") },
      { a: run("done"), b: run("error"), c: run("cancelled") },
    );
    expect(outcomes).toEqual([
      { sessionId: "a", kind: "finished" },
      { sessionId: "b", kind: "failed" },
    ]);
  });

  it("ignores runs that were already over or unchanged", () => {
    const outcomes = childRunOutcomes(
      { a: run("done"), b: run("running") },
      { a: run("done"), b: run("running"), c: run("done") },
    );
    expect(outcomes).toEqual([]);
  });
});

describe("attentionMessage", () => {
  it("names the session", () => {
    expect(attentionMessage("approval", "Fix login")).toEqual({
      title: "Approval needed",
      body: "Fix login is waiting for your approval.",
    });
  });
});
