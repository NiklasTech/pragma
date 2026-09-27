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

// Tool calls of the latest model step; earlier steps of the same message are already answered.
function lastStepToolInvocations(msg: UIMessage): ToolInvocationLike[] {
  const stepStart = msg.parts.reduce(
    (last, part, index) => (part.type === "step-start" ? index : last),
    -1,
  );
  return msg.parts
    .slice(stepStart + 1)
    .map(getToolInvocation)
    .filter((inv): inv is ToolInvocationLike => inv !== undefined);
}

export function lastStepHasToolCalls(messages: UIMessage[]): boolean {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== "assistant") return false;
  return lastStepToolInvocations(lastMessage).length > 0;
}

export function lastStepToolCallsAnswered(messages: UIMessage[]): boolean {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== "assistant") return false;
  return lastStepToolInvocations(lastMessage).every(
    (inv) => inv.state === "output-available" || inv.state === "output-error",
  );
}

export function shouldAgentContinue(messages: UIMessage[], maxSteps: number | null): boolean {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== "assistant") return false;

  const invocations = lastStepToolInvocations(lastMessage);
  const completed = invocations.filter(
    (inv) => inv.state === "output-available" || inv.state === "output-error",
  );
  if (completed.length === 0 || completed.length < invocations.length) return false;

  if (completed.some((inv) => inv.toolName === AGENT_TOOL_NAMES.taskComplete)) {
    return false;
  }

  if (maxSteps === null) return true;
  return countAgentSteps(messages) < maxSteps;
}
