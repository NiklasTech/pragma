import { invoke } from "@tauri-apps/api/core";
import { fallbackChatTitle } from "./chatTitle";
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

  generateChatTitle: async (rootPath, sessionId, firstMessage, model) => {
    if (!firstMessage.trim()) return;
    const session = get().chatSessions.find((s) => s.id === sessionId);
    if (!session || session.title !== "New Chat") return;

    let title = "";
    if (model) {
      try {
        const result = await invoke<{ title: string }>("ai_generate_chat_title", {
          req: {
            provider: model.provider,
            model: model.model,
            base_url: model.baseUrl,
            message: firstMessage,
          },
        });
        title = result.title?.trim() ?? "";
      } catch {
        // Reasoning models often spend the short title budget on thinking; fall back below.
      }
    }
    if (!title || title === "New Chat") title = fallbackChatTitle(firstMessage);
    if (!title) return;

    await get().renameChatSession(rootPath, sessionId, title);
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
