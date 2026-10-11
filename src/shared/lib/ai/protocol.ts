import { getToolName, isToolUIPart, type DynamicToolUIPart, type UIMessage } from "ai";

import { buildContextUserMessage } from "@/shared/lib/chat-context";
import type { ChatMessage } from "@/shared/stores/ai";

import { stripReasoningTags } from "./reasoningTags";
import { createCompactionMessage, isCompactionMessage } from "./compaction";
import { getMessageImages, imageToFilePart, toBackendImage, type BackendImage } from "./images";
import { toolOutputImages, toolOutputText } from "./toolOutput";

export { stripReasoningTags };

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
    images?: BackendImage[];
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
  allow_child_sessions: boolean;
  /** MCP servers the session may use; absent allows all. */
  mcp_server_ids?: string[];
  /** Images of the new prompt. */
  images?: BackendImage[];
}

/** Token counts of one model response, or the context fill an ACP agent reports. */
export interface StreamUsage {
  /** The whole input, including the cached part. */
  input_tokens?: number;
  output_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  context_used?: number;
  context_size?: number;
}

export interface StreamChunk {
  text?: string;
  error?: string;
  done?: boolean;
  reasoning?: string;
  tool_calls?: BackendToolCall[];
  tool_results?: { tool_call_id: string; output: string; is_error: boolean }[];
  usage?: StreamUsage;
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
      if (inv.state === "output-error") {
        messages.push({
          role: "tool",
          content: inv.errorText ?? "tool execution failed",
          tool_call_id: inv.toolCallId,
        });
      } else if (inv.state === "output-available") {
        const images = toolOutputImages(inv.output);
        messages.push({
          role: "tool",
          content: toolOutputText(inv.output),
          tool_call_id: inv.toolCallId,
          ...(images.length > 0 ? { images: images.map(toBackendImage) } : {}),
        });
      }
    }

    return messages;
  }

  const images = getMessageImages(msg);
  if (images.length > 0) {
    return [{ role: msg.role, content: text, images: images.map(toBackendImage) }];
  }
  return [{ role: msg.role, content: text }];
}

// Request-scoped context is prepended to the last user message only, so the stored transcript stays clean.
export function withPendingContext(
  messages: APIChatRequest["messages"],
  context: string | null,
): APIChatRequest["messages"] {
  if (!context) return messages;

  let lastUserIndex = -1;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === "user") {
      lastUserIndex = i;
      break;
    }
  }
  if (lastUserIndex === -1) return messages;

  return messages.map((message, index) =>
    index === lastUserIndex
      ? { ...message, content: buildContextUserMessage(context, message.content) }
      : message,
  );
}

export function uiMessageToStored(msg: UIMessage): ChatMessage {
  const stored: ChatMessage = {
    id: msg.id,
    role: msg.role,
    content: getMessageText(msg),
    timestamp: Date.now(),
  };
  const images = getMessageImages(msg);
  if (images.length > 0) stored.images = images;
  if (isCompactionMessage(msg)) stored.kind = "compaction";
  return stored;
}

export function storedMessagesToUI(messages: ChatMessage[]): UIMessage[] {
  return messages.map((m): UIMessage =>
    m.kind === "compaction"
      ? createCompactionMessage(m.content, m.id)
      : {
          id: m.id,
          role: m.role,
          parts: [...(m.images ?? []).map(imageToFilePart), { type: "text", text: m.content }],
        },
  );
}
