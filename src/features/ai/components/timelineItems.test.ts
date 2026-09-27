import { describe, expect, it } from "vite-plus/test";
import type { UIMessage } from "@ai-sdk/react";

import { AGENT_TOOL_NAMES } from "@/features/agent/tools";

import { buildAssistantTimeline, splitInlineReasoning, taskCompleteSummary } from "./timelineItems";

function assistant(parts: unknown[]): UIMessage {
  return { id: "a1", role: "assistant", parts } as UIMessage;
}

function tool(toolCallId: string, toolName: string, input: unknown = {}) {
  return {
    type: "tool-invocation",
    toolInvocation: { state: "output-available", toolCallId, toolName, input, output: "ok" },
  };
}

describe("splitInlineReasoning", () => {
  it("extracts every reasoning block in order", () => {
    const segments = splitInlineReasoning(
      "<thinking>first</thinking>Answer<thinking>second</thinking>More",
    );
    expect(segments).toEqual([
      { kind: "reasoning", text: "first" },
      { kind: "text", text: "Answer" },
      { kind: "reasoning", text: "second" },
      { kind: "text", text: "More" },
    ]);
  });

  it("treats an unclosed tag as reasoning", () => {
    expect(splitInlineReasoning("<think>still going")).toEqual([
      { kind: "reasoning", text: "still going" },
    ]);
  });
});

describe("buildAssistantTimeline", () => {
  it("keeps reasoning, tool calls and the answer in the order they happened", () => {
    const items = buildAssistantTimeline(
      assistant([
        { type: "step-start" },
        { type: "text", text: "<thinking>Read it</thinking>" },
        tool("t1", AGENT_TOOL_NAMES.readFile),
        { type: "step-start" },
        { type: "text", text: "<thinking>Got it</thinking>The version is 0.3.0." },
      ]),
    );
    expect(items.map((item) => item.kind)).toEqual(["reasoning", "tool", "reasoning", "text"]);
    expect(items[3]).toMatchObject({ kind: "text", text: "The version is 0.3.0." });
  });
});

describe("taskCompleteSummary", () => {
  it("returns the summary of agent_task_complete", () => {
    const [item] = buildAssistantTimeline(
      assistant([tool("t1", AGENT_TOOL_NAMES.taskComplete, { summary: "All done." })]),
    );
    if (item.kind !== "tool") throw new Error("expected a tool item");
    expect(taskCompleteSummary(item.invocation)).toBe("All done.");
  });
});

describe("tool steps with inline reasoning", () => {
  it("keeps the unclosed thought before a tool call out of the answer", () => {
    const items = buildAssistantTimeline(
      assistant([
        { type: "step-start" },
        { type: "text", text: "<thinking>Let me read that file." },
        tool("t1", AGENT_TOOL_NAMES.readFile),
      ]),
    );
    expect(items.map((item) => item.kind)).toEqual(["reasoning", "tool"]);
  });
});
