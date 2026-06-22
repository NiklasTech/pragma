import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { useChat, type UIMessage } from "@ai-sdk/react";
import type { ChatTransport, UIMessageChunk } from "ai";
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

// ─── Request Types ───────────────────────────────────────────────────────────

interface APIChatRequest {
  provider: string;
  model: string;
  base_url?: string;
  messages: Array<{ role: string; content: string }>;
  stream_id?: string;
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

interface StreamChunk {
  text?: string;
  error?: string;
  done?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getMessageText(msg: UIMessage): string {
  return msg.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("");
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
): ChatTransport<UIMessage> {
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

          const finish = () => {
            safeEnqueue({ type: "text-end", id: chunkId });
            safeEnqueue({ type: "finish", finishReason: "stop" });
            safeClose();
          };

          const channel = new Channel<StreamChunk>();

          channel.onmessage = (chunk) => {
            if (closed) return;

            if (!started) {
              started = true;
              safeEnqueue({ type: "text-start", id: chunkId });
            }

            if (chunk.error) {
              safeEnqueue({ type: "error", errorText: chunk.error });
              safeClose();
              return;
            }

            if (chunk.text) {
              safeEnqueue({ type: "text-delta", id: chunkId, delta: chunk.text });
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
            if (!isCLIActive) {
              void invoke("cancel_ai_chat_stream", { req: { stream_id: streamId } });
            }
          };

          abortSignal?.addEventListener("abort", abortHandler);

          const send = async () => {
            try {
              if (isCLIActive && activeCLIProvider) {
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
                  messages: messages.map((m: UIMessage) => ({
                    role: m.role,
                    content: getMessageText(m),
                  })),
                  stream_id: streamId,
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

  const providerConfig = providers[activeProvider];
  const hasAPIKey = apiKeyRefs[activeProvider] !== null;
  const isCLIActive = activeCLIProvider !== null;

  const sessionId = activeChatSessionId ?? "default";
  const activeSession = chatSessions.find((s) => s.id === activeChatSessionId);

  const transport = useMemo<ChatTransport<UIMessage>>(
    () =>
      createStreamTransport(
        activeProvider,
        activeModel,
        providerConfig.baseUrl,
        isCLIActive,
        activeCLIProvider,
      ),
    [activeProvider, activeModel, providerConfig.baseUrl, isCLIActive, activeCLIProvider],
  );

  const initialMessages = useMemo<UIMessage[]>(() => {
    if (activeSession?.messages.length) {
      return storedMessagesToUI(activeSession.messages);
    }
    return [];
  }, [activeSession?.id]);

  const chat = useChat({
    // Include provider/model in the id so that the @ai-sdk/react Chat instance
    // is recreated when the active provider changes. Otherwise it keeps using
    // the transport that was passed on first render.
    id: `${sessionId}:${activeProvider}:${activeModel}`,
    transport,
    messages: initialMessages,
    experimental_throttle: 50,
  });

  const [input, setInput] = useState("");
  const rootPath = useFileExplorerStore((state) => state.rootPath) ?? "default";

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

      void chat.sendMessage({ text: messageText });
      setInput("");
    },
    [input, chat, rootPath],
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
    createChatSession: () => {
      return createChatSession(rootPath);
    },
  };
}
