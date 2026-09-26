import {
  deleteSession as deleteStoredSession,
  loadSessionMessages as loadStoredSessionMessages,
  loadSessions as loadStoredSessions,
  saveSession as saveStoredSession,
  saveSessionMessages as saveStoredSessionMessages,
} from "@/shared/lib/chat-storage";
import type { AIActions, AISlice, ChatSession } from "./types";

export function mergeSessionsWithStored(
  stored: ChatSession[],
  inMemory: ChatSession[],
): ChatSession[] {
  const inMemoryById = new Map(inMemory.map((session) => [session.id, session]));

  return stored
    .map((diskSession) => {
      const memorySession = inMemoryById.get(diskSession.id);
      if (!memorySession) return diskSession;

      const merged: ChatSession = {
        ...diskSession,
        messages: memorySession.messages.length > 0 ? memorySession.messages : diskSession.messages,
        updatedAt: Math.max(memorySession.updatedAt, diskSession.updatedAt),
      };
      if (memorySession.kind !== undefined) merged.kind = memorySession.kind;
      if (memorySession.environment !== undefined) merged.environment = memorySession.environment;
      if (memorySession.worktree !== undefined) merged.worktree = memorySession.worktree;

      return merged;
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export const createSessionsSlice: AISlice<
  Pick<
    AIActions,
    | "loadSessions"
    | "loadSessionMessages"
    | "addChatSession"
    | "removeChatSession"
    | "setActiveChatSession"
    | "createChatSession"
    | "deleteSession"
    | "renameChatSession"
    | "saveSession"
    | "updateChatSession"
    | "saveSessionMessages"
  >
> = (set, get) => ({
  loadSessions: async (rootPath) => {
    const stored = await loadStoredSessions(rootPath);
    if (stored.length === 0) {
      const session: ChatSession = {
        id: crypto.randomUUID(),
        title: "New Chat",
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await saveStoredSession(rootPath, session);
      set({ chatSessions: [session], activeChatSessionId: session.id });
      return;
    }

    const { chatSessions, activeChatSessionId } = get();
    const merged = mergeSessionsWithStored(stored, chatSessions);
    const activeStillExists = activeChatSessionId
      ? merged.some((s) => s.id === activeChatSessionId)
      : false;

    set({
      chatSessions: merged,
      activeChatSessionId: activeStillExists ? activeChatSessionId : merged[0].id,
    });
  },

  loadSessionMessages: async (rootPath, sessionId) => {
    const messages = await loadStoredSessionMessages(rootPath, sessionId);
    const existing = get().chatSessions.find((s) => s.id === sessionId);
    if (messages.length === 0 && (existing?.messages.length ?? 0) > 0) return;

    set({
      chatSessions: get().chatSessions.map((s) => (s.id === sessionId ? { ...s, messages } : s)),
    });
  },

  addChatSession: (session) => {
    const { chatSessions } = get();
    set({
      chatSessions: [...chatSessions, session],
      activeChatSessionId: session.id,
    });
  },

  removeChatSession: (sessionId) => {
    const { chatSessions, activeChatSessionId } = get();
    const nextSessions = chatSessions.filter((s) => s.id !== sessionId);
    let nextActive = activeChatSessionId;
    if (activeChatSessionId === sessionId) {
      nextActive = nextSessions.length > 0 ? nextSessions[nextSessions.length - 1].id : null;
    }
    set({
      chatSessions: nextSessions,
      activeChatSessionId: nextActive,
    });
  },

  setActiveChatSession: (sessionId) => set({ activeChatSessionId: sessionId }),

  createChatSession: async (rootPath, init) => {
    const session: ChatSession = {
      id: init?.id ?? crypto.randomUUID(),
      title: "New Chat",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (init?.kind !== undefined) session.kind = init.kind;
    if (init?.environment !== undefined) session.environment = init.environment;
    if (init?.worktree !== undefined) session.worktree = init.worktree;

    await saveStoredSession(rootPath, session);
    get().addChatSession(session);
    return session;
  },

  deleteSession: async (rootPath, sessionId) => {
    await deleteStoredSession(rootPath, sessionId);
    get().removeChatSession(sessionId);
  },

  renameChatSession: async (rootPath, sessionId, title) => {
    const session = get().chatSessions.find((s) => s.id === sessionId);
    const trimmed = title.trim();
    if (!session || !trimmed || trimmed === session.title) return;

    const renamed: ChatSession = { ...session, title: trimmed, updatedAt: Date.now() };
    set({
      chatSessions: get().chatSessions.map((s) => (s.id === sessionId ? renamed : s)),
    });
    await saveStoredSession(rootPath, renamed);
  },

  saveSession: async (rootPath, session) => {
    await saveStoredSession(rootPath, session);
  },

  updateChatSession: async (rootPath, session) => {
    set({
      chatSessions: get().chatSessions.map((item) => (item.id === session.id ? session : item)),
    });
    await saveStoredSession(rootPath, session);
  },

  saveSessionMessages: async (rootPath, sessionId, messages) => {
    await saveStoredSessionMessages(rootPath, sessionId, messages);
  },
});
