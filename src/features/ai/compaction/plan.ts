import type { UIMessage } from "ai";

import {
  compactionSummary,
  createCompactionMessage,
  isCompactionMessage,
} from "@/shared/lib/ai/compaction";
import { getMessageText, getToolInvocation } from "@/shared/lib/ai/protocol";

const KEEP_RECENT_TURNS = 2;
const MAX_TOOL_INPUT_CHARS = 500;
const MAX_TOOL_OUTPUT_CHARS = 1500;

export interface SummaryPlan {
  previousSummary: string | null;
  /** Messages the summary replaces in requests. */
  older: UIMessage[];
  /** Where the summary goes: the first message that stays verbatim. */
  cutIndex: number;
}

/// Keeps the latest turns verbatim and summarizes the turns before them, back to the previous summary.
export function planSummary(messages: UIMessage[]): SummaryPlan | null {
  let markerIndex = -1;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (isCompactionMessage(messages[i])) {
      markerIndex = i;
      break;
    }
  }

  const userIndices: number[] = [];
  for (let i = markerIndex + 1; i < messages.length; i += 1) {
    if (messages[i].role === "user") userIndices.push(i);
  }
  if (userIndices.length < 2) return null;

  const keep = Math.min(KEEP_RECENT_TURNS, userIndices.length - 1);
  const cutIndex = userIndices[userIndices.length - keep];
  return {
    previousSummary: markerIndex === -1 ? null : compactionSummary(messages[markerIndex]),
    older: messages.slice(markerIndex + 1, cutIndex),
    cutIndex,
  };
}

export function insertSummary(messages: UIMessage[], cutIndex: number, summary: string) {
  return [
    ...messages.slice(0, cutIndex),
    createCompactionMessage(summary),
    ...messages.slice(cutIndex),
  ];
}

function clip(text: string, max: number): string {
  return text.length > max
    ? `${text.slice(0, max)}... [${text.length - max} more characters]`
    : text;
}

function renderMessage(message: UIMessage): string {
  const lines = [`${message.role === "user" ? "User" : "Assistant"}: ${getMessageText(message)}`];
  for (const part of message.parts) {
    const call = getToolInvocation(part);
    if (!call) continue;
    const input = typeof call.input === "string" ? call.input : JSON.stringify(call.input ?? {});
    lines.push(`Tool call ${call.toolName}: ${clip(input, MAX_TOOL_INPUT_CHARS)}`);
    if (call.state === "output-error") {
      lines.push(`Tool error: ${clip(call.errorText ?? "", MAX_TOOL_OUTPUT_CHARS)}`);
    } else if (call.state === "output-available") {
      const output =
        typeof call.output === "string" ? call.output : JSON.stringify(call.output ?? "");
      lines.push(`Tool result: ${clip(output, MAX_TOOL_OUTPUT_CHARS)}`);
    }
  }
  return lines.join("\n");
}

/// The conversation as plain text for the summarizer, keeping the newest part when it is too long.
export function renderTranscript(plan: SummaryPlan, maxChars: number): string {
  let body = plan.older.map(renderMessage).join("\n\n");
  if (body.length > maxChars) {
    body = `[Earlier messages omitted]\n\n${body.slice(body.length - maxChars)}`;
  }
  return plan.previousSummary
    ? `Summary of the conversation before these messages:\n${plan.previousSummary}\n\n${body}`
    : body;
}
