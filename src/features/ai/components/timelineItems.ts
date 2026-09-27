import type { UIMessage } from "@ai-sdk/react";

import { AGENT_TOOL_NAMES } from "@/features/agent/tools";
import { getToolInvocation, type ToolInvocationLike } from "@/shared/lib/ai/protocol";

export type TimelineItem =
  | { kind: "reasoning"; key: string; text: string }
  | { kind: "text"; key: string; text: string }
  | { kind: "tool"; key: string; invocation: ToolInvocationLike };

const REASONING_TAGS = [
  { open: "<thinking>", close: "</thinking>" },
  { open: "<reasoning>", close: "</reasoning>" },
  { open: "<think>", close: "</think>" },
];

type Segment = { kind: "reasoning" | "text"; text: string };

/// Splits text with inline reasoning tags into ordered segments. An unclosed tag counts as
/// reasoning: a step that ends in a tool call never closes it.
export function splitInlineReasoning(text: string): Segment[] {
  const segments: Segment[] = [];
  let rest = text;

  while (rest.length > 0) {
    const next = REASONING_TAGS.map((tag) => ({ tag, index: rest.indexOf(tag.open) }))
      .filter((match) => match.index !== -1)
      .sort((a, b) => a.index - b.index)[0];

    if (!next) {
      segments.push({ kind: "text", text: rest });
      break;
    }

    if (next.index > 0) segments.push({ kind: "text", text: rest.slice(0, next.index) });
    const bodyStart = next.index + next.tag.open.length;
    const end = rest.indexOf(next.tag.close, bodyStart);

    if (end === -1) {
      segments.push({ kind: "reasoning", text: rest.slice(bodyStart) });
      break;
    }

    segments.push({ kind: "reasoning", text: rest.slice(bodyStart, end) });
    rest = rest.slice(end + next.tag.close.length);
  }

  return segments.filter((segment) => segment.text.trim().length > 0);
}

function pushItem(items: TimelineItem[], item: TimelineItem): void {
  const last = items[items.length - 1];
  if (item.kind !== "tool" && last && last.kind === item.kind) {
    items[items.length - 1] = { ...last, text: `${last.text}${item.text}` };
    return;
  }
  items.push(item);
}

/// Orders an assistant message into reasoning, tool and answer rows as the model produced them.
export function buildAssistantTimeline(message: UIMessage): TimelineItem[] {
  const items: TimelineItem[] = [];

  message.parts.forEach((part, index) => {
    if (part.type === "reasoning") {
      pushItem(items, { kind: "reasoning", key: `r${index}`, text: part.text });
      return;
    }
    if (part.type === "text") {
      splitInlineReasoning(part.text).forEach((segment, segmentIndex) => {
        pushItem(items, {
          kind: segment.kind,
          key: `t${index}-${segmentIndex}`,
          text: segment.text,
        });
      });
      return;
    }
    const invocation = getToolInvocation(part);
    if (invocation) items.push({ kind: "tool", key: invocation.toolCallId, invocation });
  });

  return items;
}

/// The summary the agent handed to agent_task_complete, used as the answer when no text follows.
export function taskCompleteSummary(invocation: ToolInvocationLike): string | null {
  if (invocation.toolName !== AGENT_TOOL_NAMES.taskComplete) return null;
  const input = invocation.input;
  if (typeof input !== "object" || input === null || !("summary" in input)) return null;
  return typeof input.summary === "string" && input.summary.trim() ? input.summary : null;
}
