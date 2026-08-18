import type { UIMessage } from "@ai-sdk/react";

import { getToolInvocation, type ToolInvocationLike } from "@/shared/lib/ai/protocol";

import { AGENT_TOOL_NAMES } from "./tools";

function completedToolInvocations(msg: UIMessage): ToolInvocationLike[] {
  return msg.parts
    .map(getToolInvocation)
    .filter(
      (inv): inv is ToolInvocationLike =>
        inv !== undefined && (inv.state === "output-available" || inv.state === "output-error"),
    );
}

// Steps are the completed tool calls since the last user message, i.e. the
// work done for the current task only.
export function countAgentSteps(messages: UIMessage[]): number {
  let steps = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "user") break;
    if (msg.role !== "assistant") continue;
    steps += completedToolInvocations(msg).length;
  }
  return steps;
}

export function shouldAgentContinue(messages: UIMessage[], maxSteps: number): boolean {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== "assistant") return false;

  const completed = completedToolInvocations(lastMessage);
  if (completed.length === 0) return false;

  if (completed.some((inv) => inv.toolName === AGENT_TOOL_NAMES.taskComplete)) {
    return false;
  }

  return countAgentSteps(messages) < maxSteps;
}
