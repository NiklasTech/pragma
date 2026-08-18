import { describe, expect, it } from "vite-plus/test";
import type { UIMessage } from "@ai-sdk/react";

import { countAgentSteps, shouldAgentContinue } from "./loop";
import { AGENT_TOOL_NAMES } from "./tools";

type ToolInvocationState =
  | "input-streaming"
  | "input-available"
  | "output-streaming"
  | "output-available"
  | "output-error";

function assistantWithTools(
  id: string,
  tools: Array<{ toolCallId: string; toolName: string; state: ToolInvocationState }>,
  text = "",
): UIMessage {
  const parts: UIMessage["parts"] = tools.map(
    (tool) =>
      ({
        type: "tool-invocation",
        toolInvocation: {
          state: tool.state,
          toolCallId: tool.toolCallId,
          toolName: tool.toolName,
          input: {},
        },
      }) as unknown as UIMessage["parts"][number],
  );
  if (text) {
    parts.push({ type: "text", text });
  }
  return { id, role: "assistant", parts } as UIMessage;
}

function userMessage(id: string, text: string): UIMessage {
  return { id, role: "user", parts: [{ type: "text", text }] } as UIMessage;
}

describe("shouldAgentContinue", () => {
  it("continues when the last assistant message has completed tool output", () => {
    const messages = [
      userMessage("u1", "build feature X"),
      assistantWithTools("a1", [
        { toolCallId: "t1", toolName: AGENT_TOOL_NAMES.readFile, state: "output-available" },
      ]),
    ];
    expect(shouldAgentContinue(messages, 30)).toBe(true);
  });

  it("continues even when the assistant also produced text", () => {
    const messages = [
      userMessage("u1", "build feature X"),
      assistantWithTools(
        "a1",
        [{ toolCallId: "t1", toolName: AGENT_TOOL_NAMES.readFile, state: "output-available" }],
        "Reading the file first.",
      ),
    ];
    expect(shouldAgentContinue(messages, 30)).toBe(true);
  });

  it("stops when the model called agent_task_complete", () => {
    const messages = [
      userMessage("u1", "build feature X"),
      assistantWithTools("a1", [
        { toolCallId: "t1", toolName: AGENT_TOOL_NAMES.taskComplete, state: "output-available" },
      ]),
    ];
    expect(shouldAgentContinue(messages, 30)).toBe(false);
  });

  it("stops when the assistant produced no completed tool output", () => {
    const messages = [
      userMessage("u1", "build feature X"),
      assistantWithTools(
        "a1",
        [{ toolCallId: "t1", toolName: AGENT_TOOL_NAMES.readFile, state: "input-available" }],
        "Let me think.",
      ),
    ];
    expect(shouldAgentContinue(messages, 30)).toBe(false);
  });

  it("stops when the last message is not from the assistant", () => {
    expect(shouldAgentContinue([userMessage("u1", "hi")], 30)).toBe(false);
    expect(shouldAgentContinue([], 30)).toBe(false);
  });

  it("stops when the step cap is reached", () => {
    const messages = [
      userMessage("u1", "build feature X"),
      assistantWithTools("a1", [
        { toolCallId: "t1", toolName: AGENT_TOOL_NAMES.readFile, state: "output-available" },
      ]),
      assistantWithTools("a2", [
        { toolCallId: "t2", toolName: AGENT_TOOL_NAMES.writeFile, state: "output-available" },
      ]),
    ];
    expect(shouldAgentContinue(messages, 2)).toBe(false);
    expect(shouldAgentContinue(messages, 3)).toBe(true);
  });
});

describe("countAgentSteps", () => {
  it("counts only completed tool calls since the last user message", () => {
    const messages = [
      userMessage("u0", "earlier task"),
      assistantWithTools("a0", [
        { toolCallId: "t0", toolName: AGENT_TOOL_NAMES.readFile, state: "output-available" },
      ]),
      userMessage("u1", "new task"),
      assistantWithTools("a1", [
        { toolCallId: "t1", toolName: AGENT_TOOL_NAMES.readFile, state: "output-available" },
        { toolCallId: "t2", toolName: AGENT_TOOL_NAMES.writeFile, state: "output-error" },
        { toolCallId: "t3", toolName: AGENT_TOOL_NAMES.listFiles, state: "input-available" },
      ]),
    ];
    expect(countAgentSteps(messages)).toBe(2);
  });
});
