import { useMemo, useCallback, useState } from "react";
import { useChat, type UIMessage } from "@ai-sdk/react";
import type { ChatTransport, UIMessageChunk } from "ai";
import { Channel, invoke } from "@tauri-apps/api/core";

import { useAIStore } from "@/stores/ai";

// ─── Request Types ───────────────────────────────────────────────────────────

interface APIChatRequest {
  provider: string;
  model: string;
  base_url?: string;
  messages: Array<{ role: string; content: string }>;
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

// ─── Streaming Transport ─────────────────────────────────────────────────────

function createStreamTransport(
  activeProvider: string,
  activeModel: string,
  baseUrl: string | undefined,
  isCLIActive: boolean,
  activeCLIProvider: string | null,
): ChatTransport<UIMessage> {
  return {
    async sendMessages({ messages }) {
      const chunkId = generateId();

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
                };
                await invoke("ai_chat_stream", { req, channel });
              }

              if (!started) {
                safeEnqueue({ type: "text-start", id: chunkId });
              }
              finish();
            } catch (err) {
              safeEnqueue({ type: "error", errorText: String(err) });
              safeClose();
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
    activeChatSessionId,
    createChatSession,
  } = useAIStore();

  const providerConfig = providers[activeProvider];
  const hasAPIKey = apiKeyRefs[activeProvider] !== null;
  const isCLIActive = activeCLIProvider !== null;

  const sessionId = activeChatSessionId ?? "default";

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

  const chat = useChat({
    id: sessionId,
    transport,
  });

  const [input, setInput] = useState("");

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || chat.status === "submitted" || chat.status === "streaming") return;

      void chat.sendMessage({ text: input });
      setInput("");
    },
    [input, chat],
  );

  const canChat = isCLIActive || hasAPIKey || activeProvider === "ollama";

  return {
    messages: chat.messages,
    input,
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
    createChatSession,
  };
}
