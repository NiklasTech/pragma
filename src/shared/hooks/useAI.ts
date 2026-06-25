import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { useChat, type UIMessage, type UseChatHelpers } from "@ai-sdk/react";
import {
  getToolName,
  isToolUIPart,
  type ChatTransport,
  type DynamicToolUIPart,
  type UIMessageChunk,
} from "ai";
import { Channel, invoke } from "@tauri-apps/api/core";

import { useAIStore, type ChatMessage } from "@/shared/stores/ai";
import { useAIEditStore } from "@/shared/stores/aiEdit";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import {
  buildContextUserMessage,
  parseMentions,
  stripMentions,
  type ChatContextResult,
} from "@/shared/lib/chat-context";
import { useMcpChatTools } from "./useMcpChatTools";

// ─── Request Types ───────────────────────────────────────────────────────────

interface BackendToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface BackendToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: unknown;
  };
}

interface APIChatRequest {
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

interface CLIChatMessage {
  role: string;
  content: string;
}

interface CLIChatRequest {
  provider_id: string;
  messages: CLIChatMessage[];
  session_id?: string;
}

interface AcpChatRequest {
  provider_id: string;
  chat_session_id: string;
  cwd: string;
  messages: CLIChatMessage[];
}

interface StreamChunk {
  text?: string;
  error?: string;
  done?: boolean;
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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

interface ToolInvocationLike {
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

function getToolInvocation(part: UIMessage["parts"][number]): ToolInvocationLike | undefined {
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

function uiMessageToBackendMessages(msg: UIMessage): APIChatRequest["messages"] {
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

function uiMessageToStored(msg: UIMessage): ChatMessage {
  return {
    id: msg.id,
    role: msg.role,
    content: getMessageText(msg),
    timestamp: Date.now(),
  };
}

function storedMessagesToUI(messages: ChatMessage[]): UIMessage[] {
  return messages.map(
    (m): UIMessage => ({
      id: m.id,
      role: m.role,
      parts: [{ type: "text", text: m.content }],
    }),
  );
}

// ─── Streaming Transport ─────────────────────────────────────────────────────

function createStreamTransport(
  activeProvider: string,
  activeModel: string,
  baseUrl: string | undefined,
  isCLIActive: boolean,
  activeCLIProvider: string | null,
  tools: BackendToolDefinition[],
  rootPath: string,
  activeChatSessionId: string | null,
): ChatTransport<UIMessage> {
  const isAcpActive = activeCLIProvider === "moonshot-kimi-acp";
  return {
    async sendMessages({ messages, abortSignal }) {
      const chunkId = generateId();
      const streamId = generateId();

      return new ReadableStream<UIMessageChunk>({
        start(controller) {
          let started = false;
          let closed = false;

          const safeEnqueue = (chunk: UIMessageChunk) => {
            if (!closed) {
              controller.enqueue(chunk);
            }
          };

          const safeClose = () => {
            if (!closed) {
              closed = true;
              controller.close();
            }
          };

          let hadToolCalls = false;

          const finish = () => {
            safeEnqueue({ type: "text-end", id: chunkId });
            safeEnqueue({
              type: "finish",
              finishReason: hadToolCalls ? "tool-calls" : "stop",
            });
            safeClose();
          };

          const channel = new Channel<StreamChunk>();

          channel.onmessage = (chunk) => {
            if (closed) return;

            if (chunk.error) {
              safeEnqueue({ type: "error", errorText: chunk.error });
              safeClose();
              return;
            }

            if (!started) {
              started = true;
              safeEnqueue({ type: "text-start", id: chunkId });
            }

            if (chunk.text) {
              safeEnqueue({ type: "text-delta", id: chunkId, delta: chunk.text });
            }

            if (chunk.tool_calls && chunk.tool_calls.length > 0) {
              hadToolCalls = true;
              for (const call of chunk.tool_calls) {
                let input: unknown;
                try {
                  input = JSON.parse(call.function.arguments);
                } catch {
                  input = call.function.arguments;
                }

                safeEnqueue({
                  type: "tool-input-available",
                  toolCallId: call.id,
                  toolName: call.function.name,
                  input,
                });
              }
            }

            if (chunk.done) {
              finish();
            }
          };

          const abortHandler = () => {
            closed = true;
            try {
              controller.error(new Error("aborted"));
            } catch {
              // ignore
            }
            if (isAcpActive && activeChatSessionId) {
              void invoke("cli_acp_cancel", { req: { chat_session_id: activeChatSessionId } });
            } else if (!isCLIActive) {
              void invoke("cancel_ai_chat_stream", { req: { stream_id: streamId } });
            }
          };

          abortSignal?.addEventListener("abort", abortHandler);

          const send = async () => {
            try {
              if (isAcpActive && activeChatSessionId) {
                const req: AcpChatRequest = {
                  provider_id: activeCLIProvider,
                  chat_session_id: activeChatSessionId,
                  cwd: rootPath,
                  messages: messages.map((m: UIMessage) => ({
                    role: m.role,
                    content: getMessageText(m),
                  })),
                };
                await invoke("cli_acp_chat_stream", { req, channel });
              } else if (isCLIActive && activeCLIProvider) {
                const req: CLIChatRequest = {
                  provider_id: activeCLIProvider,
                  messages: messages.map((m: UIMessage) => ({
                    role: m.role,
                    content: getMessageText(m),
                  })),
                  session_id: generateId(),
                };
                await invoke("cli_chat_stream", { req, channel });
              } else {
                const req: APIChatRequest = {
                  provider: activeProvider,
                  model: activeModel,
                  base_url: baseUrl,
                  messages: messages.flatMap(uiMessageToBackendMessages),
                  stream_id: streamId,
                  tools: tools.length > 0 ? tools : undefined,
                };
                await invoke("ai_chat_stream", { req, channel });
              }

              if (!started) {
                safeEnqueue({ type: "text-start", id: chunkId });
              }
              finish();
            } catch (err) {
              if (String(err).includes("aborted")) {
                safeClose();
              } else {
                safeEnqueue({ type: "error", errorText: String(err) });
                safeClose();
              }
            } finally {
              abortSignal?.removeEventListener("abort", abortHandler);
            }
          };

          void send();
        },
      });
    },

    async reconnectToStream() {
      return null;
    },
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAI() {
  const {
    activeProvider,
    activeModel,
    providers,
    activeCLIProvider,
    apiKeyRefs,
    copilotAuth,
    activeChatSessionId,
    chatSessions,
    createChatSession,
    loadSessions,
    loadSessionMessages,
    updateChatSessionMessages,
    saveSessionMessages,
    saveSession,
  } = useAIStore();

  const {
    toolDefinitions,
    resolveTool,
    ready: mcpReady,
    loaded: mcpLoaded,
    serverCount: mcpServerCount,
  } = useMcpChatTools();

  const mcpReadyRef = useRef(mcpReady);
  const mcpServerCountRef = useRef(mcpServerCount);

  useEffect(() => {
    mcpReadyRef.current = mcpReady;
  }, [mcpReady]);

  useEffect(() => {
    mcpServerCountRef.current = mcpServerCount;
  }, [mcpServerCount]);

  const providerConfig = providers[activeProvider];
  const hasAPIKey = apiKeyRefs[activeProvider] !== null;
  const isCLIActive = activeCLIProvider !== null;

  const sessionId = activeChatSessionId ?? "default";
  const activeSession = chatSessions.find((s) => s.id === activeChatSessionId);
  const rootPath = useFileExplorerStore((state) => state.rootPath) ?? "default";

  const transport = useMemo<ChatTransport<UIMessage>>(
    () =>
      createStreamTransport(
        activeProvider,
        activeModel,
        providerConfig.baseUrl,
        isCLIActive,
        activeCLIProvider,
        isCLIActive ? [] : toolDefinitions,
        rootPath,
        activeChatSessionId,
      ),
    [
      activeProvider,
      activeModel,
      providerConfig.baseUrl,
      isCLIActive,
      activeCLIProvider,
      toolDefinitions,
      rootPath,
      activeChatSessionId,
    ],
  );

  const initialMessages = useMemo<UIMessage[]>(() => {
    if (activeSession?.messages.length) {
      return storedMessagesToUI(activeSession.messages);
    }
    return [];
  }, [activeSession?.id]);

  const chatRef = useRef<UseChatHelpers<UIMessage> | null>(null);

  const onToolCall = useCallback(
    async ({
      toolCall,
    }: {
      toolCall: {
        toolCallId: string;
        toolName: string;
        input: unknown;
      };
    }) => {
      console.log("[onToolCall]", toolCall.toolName, toolCall.input);
      const chat = chatRef.current;
      if (!chat) return;

      // Kimi ACP executes tools itself via reverse-RPC; the frontend only displays results.
      if (activeCLIProvider === "moonshot-kimi-acp") {
        return;
      }

      const tool = resolveTool(toolCall.toolName);
      if (!tool) {
        chat.addToolOutput({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          state: "output-error",
          errorText: `Tool ${toolCall.toolName} is not available`,
        });
        return;
      }

      try {
        const result = await invoke<{
          content: unknown;
          is_error?: boolean;
          error?: string;
        }>("mcp_call_tool", {
          id: tool.serverId,
          toolName: tool.toolName,
          arguments: typeof toolCall.input === "object" ? toolCall.input : {},
        });

        const output =
          typeof result.content === "string" ? result.content : JSON.stringify(result.content);

        if (result.is_error || result.error) {
          chat.addToolOutput({
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            state: "output-error",
            errorText: result.error ?? output,
          });
        } else {
          chat.addToolOutput({
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            output,
          });
        }
      } catch (err) {
        const errorText = String(err);
        chat.addToolOutput({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          state: "output-error",
          errorText,
        });
      }
    },
    [resolveTool, activeCLIProvider],
  );

  const sendAutomaticallyWhen = useCallback(({ messages }: { messages: UIMessage[] }) => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "assistant") return false;

    // Only auto-continue when the assistant message contains a completed tool
    // call but has not produced an answer yet. Once the model generated text,
    // we must not resubmit to avoid an infinite loop.
    if (getMessageText(lastMessage).trim().length > 0) return false;

    return lastMessage.parts.some((part) => {
      const inv = getToolInvocation(part);
      if (!inv) return false;
      return inv.state === "output-available" || inv.state === "output-error";
    });
  }, []);

  const chat = useChat({
    id: `${sessionId}:${activeProvider}:${activeModel}:${activeCLIProvider ?? "api"}`,
    transport,
    messages: initialMessages,
    experimental_throttle: 50,
    onToolCall,
    sendAutomaticallyWhen,
  });

  chatRef.current = chat;

  const [input, setInput] = useState("");

  // Load sessions whenever the workspace changes.
  useEffect(() => {
    void loadSessions(rootPath);
  }, [rootPath, loadSessions]);

  // Load messages for the active session if they are not in memory yet.
  useEffect(() => {
    if (!activeChatSessionId) return;
    const session = chatSessions.find((s) => s.id === activeChatSessionId);
    if (session && session.messages.length === 0) {
      void loadSessionMessages(rootPath, activeChatSessionId);
    }
  }, [activeChatSessionId, rootPath, chatSessions, loadSessionMessages]);

  // When loaded messages arrive for the active session and the chat is empty,
  // populate the chat (e.g. on startup or session switch).
  useEffect(() => {
    if (!activeSession?.messages.length) return;
    if (chat.messages.length === 0 && chat.status === "ready") {
      chat.setMessages(storedMessagesToUI(activeSession.messages));
    }
  }, [activeSession?.messages, chat.messages.length, chat.status, chat.setMessages]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || chat.status === "submitted" || chat.status === "streaming") return;

      const mentions = parseMentions(input);
      let messageText = input.trim();

      if (rootPath && mentions.length > 0) {
        try {
          const result = await invoke<ChatContextResult>("read_chat_context", {
            req: { root_path: rootPath, paths: mentions },
          });

          if (result.content) {
            const question = stripMentions(input);
            messageText = buildContextUserMessage(result.content, question);
          }
        } catch (err) {
          console.error("[Chat Context Error]", err);
        }
      }

      const { edit, submitPrompt } = useAIEditStore.getState();
      if (edit?.status === "composing") {
        messageText = `${messageText}\n\nSelected code from ${edit.filePath}:\n\`\`\`\n${edit.originalCode}\n\`\`\``;
        submitPrompt();
      }

      if (!mcpLoaded) {
        const start = Date.now();
        while (!mcpLoaded && Date.now() - start < 5000) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      if (mcpServerCountRef.current > 0) {
        const start = Date.now();
        while (!mcpReadyRef.current && Date.now() - start < 5000) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      void chat.sendMessage({ text: messageText });
      setInput("");
    },
    [input, chat, rootPath, mcpServerCount, mcpLoaded],
  );

  // Sync chat messages into the active store session.
  const messagesJsonRef = useRef<string>("");
  useEffect(() => {
    if (!activeChatSessionId) return;

    const snapshot = chat.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: getMessageText(m),
    }));
    const json = JSON.stringify(snapshot);
    if (json === messagesJsonRef.current) return;
    messagesJsonRef.current = json;

    updateChatSessionMessages(activeChatSessionId, chat.messages.map(uiMessageToStored));
  }, [activeChatSessionId, chat.messages, updateChatSessionMessages]);

  // When switching sessions, reset the cached JSON so the new session's messages
  // are synced even if they happen to serialize to the same value.
  useEffect(() => {
    messagesJsonRef.current = "";
  }, [activeChatSessionId]);

  // Persist session metadata and messages to disk.
  const previousStatusRef = useRef(chat.status);
  useEffect(() => {
    const previous = previousStatusRef.current;
    previousStatusRef.current = chat.status;

    if (!activeChatSessionId) return;
    const session = chatSessions.find((s) => s.id === activeChatSessionId);
    if (!session) return;

    // Save metadata whenever the title changes.
    void saveSession(rootPath, session);

    // Save messages when streaming finishes or when the message list grows.
    const wasStreaming = previous === "streaming" || previous === "submitted";
    const isReady = chat.status === "ready";
    if (wasStreaming && isReady) {
      void saveSessionMessages(rootPath, activeChatSessionId, session.messages);
    }
  }, [chat.status, activeChatSessionId, rootPath, chatSessions, saveSession, saveSessionMessages]);

  // Debounced persist of messages while typing/streaming.
  const debouncedSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!activeChatSessionId) return;
    const session = chatSessions.find((s) => s.id === activeChatSessionId);
    if (!session) return;

    if (debouncedSaveRef.current) {
      clearTimeout(debouncedSaveRef.current);
    }
    debouncedSaveRef.current = setTimeout(() => {
      void saveSessionMessages(rootPath, activeChatSessionId, session.messages);
    }, 1000);

    return () => {
      if (debouncedSaveRef.current) {
        clearTimeout(debouncedSaveRef.current);
      }
    };
  }, [activeChatSessionId, rootPath, chatSessions, saveSessionMessages]);

  const canChat =
    isCLIActive ||
    hasAPIKey ||
    activeProvider === "ollama" ||
    (activeProvider === "custom" && Boolean(providerConfig.baseUrl)) ||
    (activeProvider === "copilot" && copilotAuth.authenticated);

  return {
    messages: chat.messages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    isLoading: chat.status === "submitted" || chat.status === "streaming",
    status: chat.status,
    error: chat.error,
    regenerate: chat.regenerate,
    stop: chat.stop,
    canChat,
    isCLIActive,
    activeCLIProvider,
    sessionId,
    mcpReady,
    mcpLoaded,
    mcpServerCount,
    createChatSession: () => {
      return createChatSession(rootPath);
    },
  };
}
