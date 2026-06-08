import { useMemo, useCallback, useState } from "react";
import { useChat, type UIMessage } from "@ai-sdk/react";
import type { ChatTransport, UIMessageChunk } from "ai";
import { invoke } from "@tauri-apps/api/core";
import { useAIStore } from "@/stores/ai";

// ─── API Provider Types ──────────────────────────────────────────────────────

interface APIChatRequest {
  provider: string;
  model: string;
  base_url?: string;
  messages: Array<{ role: string; content: string }>;
}

interface APIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
}

// ─── CLI Types ───────────────────────────────────────────────────────────────

interface CLIChatMessage {
  role: string;
  content: string;
}

interface CLIChatRequest {
  provider_id: string;
  messages: CLIChatMessage[];
  session_id?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getMessageText(msg: UIMessage): string {
  return msg.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("");
}

// ─── API Transport ───────────────────────────────────────────────────────────

function createAPIFetch(provider: string, model: string, baseUrl?: string): typeof fetch {
  return async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse((init?.body as string) ?? "{}") as {
      messages: UIMessage[];
    };

    const req: APIChatRequest = {
      provider,
      model,
      base_url: baseUrl,
      messages: body.messages.map((m: UIMessage) => ({
        role: m.role,
        content: getMessageText(m),
      })),
    };

    const result = await invoke<APIChatResponse>("ai_chat", { req });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
}

// ─── CLI Transport ───────────────────────────────────────────────────────────

function createCLITransport(providerId: string): ChatTransport<UIMessage> {
  return {
    async sendMessages({ messages }) {
      const req: CLIChatRequest = {
        provider_id: providerId,
        messages: messages.map((m: UIMessage) => ({
          role: m.role,
          content: getMessageText(m),
        })),
        session_id: generateId(),
      };

      const result = await invoke<string>("cli_chat", { req });
      const chunkId = generateId();

      const chunks: UIMessageChunk[] = [
        { type: "text-start", id: chunkId },
        { type: "text-delta", id: chunkId, delta: result },
        { type: "text-end", id: chunkId },
        { type: "finish", finishReason: "stop" },
      ];

      let index = 0;
      return new ReadableStream<UIMessageChunk>({
        pull(controller) {
          if (index < chunks.length) {
            controller.enqueue(chunks[index]);
            index++;
          } else {
            controller.close();
          }
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
  const { activeProvider, activeModel, providers, activeCLIProvider, apiKeyRefs } = useAIStore();

  const providerConfig = providers[activeProvider];
  const hasAPIKey = apiKeyRefs[activeProvider] !== null;
  const isCLIActive = activeCLIProvider !== null;

  const [input, setInput] = useState("");

  // Determine which transport to use
  const transport = useMemo<ChatTransport<UIMessage>>(() => {
    if (isCLIActive && activeCLIProvider) {
      return createCLITransport(activeCLIProvider);
    }

    // API provider with custom fetch
    const fetcher = createAPIFetch(activeProvider, activeModel, providerConfig.baseUrl);

    return {
      async sendMessages({ messages }) {
        const body = JSON.stringify({ messages });
        const response = await fetcher("/api/chat", {
          method: "POST",
          body,
          headers: { "Content-Type": "application/json" },
        });

        const data = (await response.json()) as APIChatResponse;
        const content = data.choices[0]?.message.content ?? "";
        const chunkId = generateId();

        const chunks: UIMessageChunk[] = [
          { type: "text-start", id: chunkId },
          { type: "text-delta", id: chunkId, delta: content },
          { type: "text-end", id: chunkId },
          { type: "finish", finishReason: "stop" },
        ];

        let index = 0;
        return new ReadableStream<UIMessageChunk>({
          pull(controller) {
            if (index < chunks.length) {
              controller.enqueue(chunks[index]);
              index++;
            } else {
              controller.close();
            }
          },
        });
      },

      async reconnectToStream() {
        return null;
      },
    };
  }, [isCLIActive, activeCLIProvider, activeProvider, activeModel, providerConfig.baseUrl]);

  const chat = useChat({
    transport,
  });

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

  // Determine if chat is available
  const canChat = isCLIActive || hasAPIKey || activeProvider === "ollama";

  return {
    messages: chat.messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading: chat.status === "submitted" || chat.status === "streaming",
    status: chat.status,
    error: chat.error,
    canChat,
    isCLIActive,
    activeCLIProvider,
  };
}
