import { describe, expect, it } from "vite-plus/test";

import { resolveRunOutcome, sendToSession, useSessionRunsStore } from "./sessionRuns";

describe("run outcome", () => {
  it("follows the agent status for a built-in run", () => {
    const base = { usesAgentRun: true, chatFailed: false, stopRequested: false };
    expect(resolveRunOutcome({ ...base, agentStatus: "done" })).toBe("done");
    expect(resolveRunOutcome({ ...base, agentStatus: "cancelled" })).toBe("cancelled");
    expect(resolveRunOutcome({ ...base, agentStatus: "idle" })).toBe("idle");
  });

  it("treats a stopped coding CLI turn as cancelled", () => {
    const base = { usesAgentRun: false, agentStatus: "idle" as const, chatFailed: false };
    expect(resolveRunOutcome({ ...base, stopRequested: true })).toBe("cancelled");
    expect(resolveRunOutcome({ ...base, stopRequested: false })).toBe("done");
    expect(resolveRunOutcome({ ...base, stopRequested: false, chatFailed: true })).toBe("error");
  });
});

describe("sending to a session", () => {
  it("gives up when no chat shows the session", async () => {
    useSessionRunsStore.setState({ connectedSessionId: null });
    await expect(sendToSession("s1", "Continue the task.", 10)).resolves.toBe(false);
  });
});
