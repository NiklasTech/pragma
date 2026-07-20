import { getToolName, isToolUIPart, type DynamicToolUIPart, type UIMessage } from "ai";

import type { ChatMessage } from "@/shared/stores/ai";

export interface BackendToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface BackendToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: unknown;
  };
}

export interface APIChatRequest {
  provider: string;
  model: string;
  base_url?: string;
  messages: Array<{
    role: string;
    content: string;
    tool_calls?: BackendToolCall[];
    tool_call_id?: string;
  }>;
  stream_id?: string;
  tools?: BackendToolDefinition[];
}

export interface CLIChatMessage {
  role: string;
  content: string;
}

export interface CLIChatRequest {
  provider_id: string;
  messages: CLIChatMessage[];
  session_id?: string;
}

export interface AcpChatRequest {
  provider_id: string;
  chat_session_id: string;
  cwd: string;
  messages: CLIChatMessage[];
}

export interface StreamChunk {
  text?: string;
  error?: string;
  done?: boolean;
  reasoning?: string;
  tool_calls?: BackendToolCall[];
  tool_results?: { tool_call_id: string; output: string; is_error: boolean }[];
}

interface ToolInvocationPart {
  type: "tool-invocation";
  toolInvocation: {
    state:
      | "input-streaming"
      | "input-available"
      | "output-streaming"
      | "output-available"
      | "output-error";
    toolCallId: string;
    toolName: string;
    input: unknown;
    output?: unknown;
    errorText?: string;
  };
}

function stripReasoningTags(text: string): string {
  const tags = [
    { open: "<thinking>", close: "</thinking>" },
    { open: "<reasoning>", close: "</reasoning>" },
    { open: "<think>", close: "</think>" },
  ];

  let cleaned = text;
  for (const { open, close } of tags) {
    const pattern = new RegExp(
      `${open.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${close.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
      "g",
    );
    cleaned = cleaned.replace(pattern, "");
  }
  return cleaned.trim();
}

export function getMessageText(msg: UIMessage): string {
  const text = msg.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("");
  return stripReasoningTags(text);
}

export interface ToolInvocationLike {
  state:
    | "input-streaming"
    | "input-available"
    | "output-streaming"
    | "output-available"
    | "output-error";
  toolCallId: string;
  toolName: string;
  input: unknown;
  output?: unknown;
  errorText?: string;
}

export function getToolInvocation(
  part: UIMessage["parts"][number],
): ToolInvocationLike | undefined {
  if (part.type === "tool-invocation" && "toolInvocation" in part) {
    const inv = (part as unknown as ToolInvocationPart).toolInvocation;
    return {
      state: inv.state,
      toolCallId: inv.toolCallId,
      toolName: inv.toolName,
      input: inv.input,
      output: inv.output,
      errorText: inv.errorText,
    };
  }

  if (isToolUIPart(part as Parameters<typeof isToolUIPart>[0])) {
    const p = part as unknown as DynamicToolUIPart;
    const supportedStates = [
      "input-streaming",
      "input-available",
      "output-streaming",
      "output-available",
      "output-error",
    ] as const;
    if (!supportedStates.includes(p.state as (typeof supportedStates)[number])) {
      return undefined;
    }
    return {
      state: p.state as ToolInvocationLike["state"],
      toolCallId: p.toolCallId,
      toolName: getToolName(p),
      input: p.input,
      output: p.output,
      errorText: p.errorText,
    };
  }

  return undefined;
}

function getToolCalls(msg: UIMessage): BackendToolCall[] | undefined {
  const invocations = msg.parts
    .map(getToolInvocation)
    .filter((inv): inv is ToolInvocationLike => inv !== undefined);
  if (invocations.length === 0) return undefined;

  return invocations.map((inv) => ({
    id: inv.toolCallId,
    type: "function" as const,
    function: {
      name: inv.toolName,
      arguments: typeof inv.input === "string" ? inv.input : JSON.stringify(inv.input ?? {}),
    },
  }));
}

export function uiMessageToBackendMessages(msg: UIMessage): APIChatRequest["messages"] {
  const text = getMessageText(msg);

  if (msg.role === "assistant") {
    const toolCalls = getToolCalls(msg);
    const messages: APIChatRequest["messages"] = [
      {
        role: "assistant",
        content: text,
        tool_calls: toolCalls,
      },
    ];

    for (const part of msg.parts) {
      const inv = getToolInvocation(part);
      if (!inv) continue;
      if (inv.state === "output-available" || inv.state === "output-error") {
        messages.push({
          role: "tool",
          content:
            inv.state === "output-error"
              ? (inv.errorText ?? "tool execution failed")
              : typeof inv.output === "string"
                ? inv.output
                : JSON.stringify(inv.output ?? ""),
          tool_call_id: inv.toolCallId,
        });
      }
    }

    return messages;
  }

  return [{ role: msg.role, content: text }];
}

export function uiMessageToStored(msg: UIMessage): ChatMessage {
  return {
    id: msg.id,
    role: msg.role,
    content: getMessageText(msg),
    timestamp: Date.now(),
  };
}

export function storedMessagesToUI(messages: ChatMessage[]): UIMessage[] {
  return messages.map(
    (m): UIMessage => ({
      id: m.id,
      role: m.role,
      parts: [{ type: "text", text: m.content }],
    }),
  );
}
