import { describe, expect, it } from "vite-plus/test";

import type { AcpApproval } from "@/features/ai/acp/acpApprovals";
import type { AgentApproval } from "@/features/agent/store";

import type { RailEntry } from "../railEntries";
import { pickQuestion, requestText } from "./question";

const entry = (sessionId: string): RailEntry => ({
  sessionId,
  leafId: `leaf-${sessionId}`,
  tabId: "tab",
  tabNumber: 1,
});
const acp = (sessionId: string): AcpApproval => ({
  chatSessionId: sessionId,
  toolCallId: `call-${sessionId}`,
  toolName: "`rm -rf dist`",
});
const spawn = (): AgentApproval => ({ toolCallId: "spawn", toolName: "spawn", resolve: () => {} });
const entries = [entry("a"), entry("b"), entry("c")];

describe("pickQuestion", () => {
  it("prefers a permission the line can answer over an agent that only needs you", () => {
    const question = pickQuestion(entries, {
      acp: { c: [acp("c")] },
      spawn: { b: [spawn()] },
      stateOf: (id) => (id === "a" ? "needs-you" : "working"),
    });
    expect(question?.kind).toBe("acp");
    expect(question?.entry.sessionId).toBe("c");
  });

  it("falls back to a spawn request, then to an agent that needs you", () => {
    expect(
      pickQuestion(entries, { acp: {}, spawn: { b: [spawn()] }, stateOf: () => "idle" })?.kind,
    ).toBe("spawn");
    const attention = pickQuestion(entries, {
      acp: {},
      spawn: {},
      stateOf: (id) => (id === "b" ? "needs-you" : "idle"),
    });
    expect(attention).toEqual({ kind: "attention", entry: entry("b") });
  });

  it("asks nothing when every agent is fine", () => {
    expect(pickQuestion(entries, { acp: {}, spawn: {}, stateOf: () => "working" })).toBeNull();
  });
});

describe("requestText", () => {
  it("drops the backticks some CLIs wrap around the command", () => {
    expect(requestText("`rm -rf dist`")).toBe("rm -rf dist");
    expect(requestText("Edit src/a.ts")).toBe("Edit src/a.ts");
  });
});
