import type { UIMessage } from "@ai-sdk/react";

import { compactionSummary, isCompactionMessage } from "@/shared/lib/ai/compaction";
import type { ToolInvocationLike } from "@/shared/lib/ai/protocol";

import { buildAssistantTimeline, splitInlineReasoning } from "../components/timelineItems";

export interface MarkdownExportOptions {
  includeToolOutput: boolean;
  includeReasoning: boolean;
}

const TARGET_KEYS = ["path", "file_path", "filePath", "command", "url", "query", "pattern", "name"];

function fence(text: string, language = ""): string {
  const longest = Math.max(2, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const ticks = "`".repeat(longest + 1);
  return `${ticks}${language}\n${text}\n${ticks}`;
}

function quote(text: string): string {
  return text
    .trim()
    .split("\n")
    .map((line) => (line ? `> ${line}` : ">"))
    .join("\n");
}

function toolTarget(input: unknown): string | null {
  if (typeof input !== "object" || input === null) return null;
  for (const key of TARGET_KEYS) {
    const value = (input as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim()) return value.trim().split("\n")[0];
  }
  return null;
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2) ?? "";
}

function formatTool(invocation: ToolInvocationLike, includeOutput: boolean): string {
  const target = toolTarget(invocation.input);
  const failed = invocation.state === "output-error" ? " (failed)" : "";
  const line = `- Tool \`${invocation.toolName}\`${target ? ` ${target}` : ""}${failed}`;
  if (!includeOutput) return line;

  const output = invocation.errorText ?? invocation.output;
  if (output === undefined) return line;
  return `${line}\n\n${fence(stringify(output))}`;
}

function messageText(message: UIMessage): string {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

function formatUser(message: UIMessage): string {
  return splitInlineReasoning(messageText(message))
    .filter((segment) => segment.kind === "text")
    .map((segment) => segment.text)
    .join("")
    .trim();
}

function formatAssistant(message: UIMessage, options: MarkdownExportOptions): string {
  const blocks: string[] = [];
  for (const item of buildAssistantTimeline(message)) {
    if (item.kind === "text") {
      if (item.text.trim()) blocks.push(item.text.trim());
    } else if (item.kind === "reasoning") {
      if (options.includeReasoning && item.text.trim()) blocks.push(quote(item.text));
    } else {
      blocks.push(formatTool(item.invocation, options.includeToolOutput));
    }
  }
  return blocks.join("\n\n");
}

/// One message as Markdown, without a heading; the same body the session export uses.
export function messageToMarkdown(message: UIMessage, options: MarkdownExportOptions): string {
  if (isCompactionMessage(message)) return compactionSummary(message);
  return message.role === "assistant" ? formatAssistant(message, options) : formatUser(message);
}

function heading(message: UIMessage): string {
  if (isCompactionMessage(message)) return "## Summary of earlier messages";
  if (message.role === "user") return "## User";
  if (message.role === "assistant") return "## Assistant";
  return "## System";
}

/// A whole session as Markdown: user and assistant turns, tool calls one line each.
export function sessionToMarkdown(
  title: string,
  messages: UIMessage[],
  options: MarkdownExportOptions,
): string {
  const sections = messages
    .filter((message) => message.role !== "system" || isCompactionMessage(message))
    .map((message) => ({ heading: heading(message), body: messageToMarkdown(message, options) }))
    .filter((section) => section.body.length > 0)
    .map((section) => `${section.heading}\n\n${section.body}`);
  return `# ${title.trim() || "Session"}\n\n${sections.join("\n\n")}\n`;
}
