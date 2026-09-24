import { invoke } from "@tauri-apps/api/core";
import type { AIActions, AISlice } from "./types";

export const createMessagesSlice: AISlice<
  Pick<AIActions, "updateChatSessionMessages" | "generateChatTitle" | "addChatMessage">
> = (set, get) => ({
  updateChatSessionMessages: (sessionId, messages) => {
    const { chatSessions } = get();
    set({
      chatSessions: chatSessions.map((s) => {
        if (s.id !== sessionId) return s;

        return {
          ...s,
          messages,
          updatedAt: Date.now(),
        };
      }),
    });
  },

  generateChatTitle: async (sessionId, provider, model, baseUrl, firstMessage) => {
    if (!firstMessage.trim()) return;
    const session = get().chatSessions.find((s) => s.id === sessionId);
    if (!session || session.title !== "New Chat") return;

    try {
      const result = await invoke<{ title: string }>("ai_generate_chat_title", {
        req: {
          provider,
          model,
          base_url: baseUrl,
          message: firstMessage,
        },
      });

      const title = result.title?.trim() || "New Chat";
      if (title === "New Chat" || title === session.title) return;

      set({
        chatSessions: get().chatSessions.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                title,
                updatedAt: Date.now(),
              }
            : s,
        ),
      });
    } catch {
      // Ignore title-generation failures; the UI can fall back to "New Chat".
    }
  },

  addChatMessage: (sessionId, message) => {
    const { chatSessions } = get();
    set({
      chatSessions: chatSessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              messages: [...s.messages, message],
              updatedAt: Date.now(),
            }
          : s,
      ),
    });
  },
});
