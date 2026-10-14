import {
  deleteSession as deleteStoredSession,
  loadSessionMessages as loadStoredSessionMessages,
  loadSessions as loadStoredSessions,
  saveSession as saveStoredSession,
  saveSessionMessages as saveStoredSessionMessages,
} from "@/shared/lib/chat-storage";
import { disposeTerminal } from "@/features/ai/terminal/runner";
import type { AIActions, AISlice, ChatSession } from "./types";

export function repositorySessions(
  sessions: readonly ChatSession[],
  rootPath: string,
): ChatSession[] {
  return sessions.filter((session) => session.rootPath === rootPath);
}

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
      if (memorySession.environmentId !== undefined) {
        merged.environmentId = memorySession.environmentId;
      }
      if (memorySession.cliProviderId !== undefined) {
        merged.cliProviderId = memorySession.cliProviderId;
      }
      if (memorySession.agentId !== undefined) merged.agentId = memorySession.agentId;
      if (memorySession.archived !== undefined) merged.archived = memorySession.archived;
      if (memorySession.agentEngine !== undefined) merged.agentEngine = memorySession.agentEngine;
      if (memorySession.parentId !== undefined) merged.parentId = memorySession.parentId;
      if (memorySession.category !== undefined) merged.category = memorySession.category;
      if (memorySession.usage !== undefined) merged.usage = memorySession.usage;

      return merged;
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

// Concurrent loads of one repository share a single read, so a later load cannot drop what an earlier one added.
const pendingLoads = new Map<string, Promise<ChatSession[]>>();

function loadStoredOnce(rootPath: string): Promise<ChatSession[]> {
  const pending = pendingLoads.get(rootPath);
  if (pending) return pending;
  const load = loadStoredSessions(rootPath).finally(() => pendingLoads.delete(rootPath));
  pendingLoads.set(rootPath, load);
  return load;
}

export const createSessionsSlice: AISlice<
  Pick<
    AIActions,
    | "loadSessions"
    | "unloadSessions"
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
> = (set, get) => {
  const findSession = (sessionId: string) =>
    get().chatSessions.find((session) => session.id === sessionId);

  return {
    loadSessions: async (rootPath, options) => {
      const activate = options?.activate !== false;
      const stored = await loadStoredOnce(rootPath);
      // Loading the sessions first migrates legacy worktrees into environments.
      if (activate) await get().loadEnvironments(rootPath);

      const others = get().chatSessions.filter((session) => session.rootPath !== rootPath);
      if (stored.length === 0) {
        if (!activate) {
          set({ chatSessions: others });
          return;
        }
        const session: ChatSession = {
          id: crypto.randomUUID(),
          rootPath,
          title: "New Chat",
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await saveStoredSession(rootPath, session);
        const current = get().chatSessions.filter((item) => item.rootPath !== rootPath);
        set({ chatSessions: [...current, session], activeChatSessionId: session.id });
        return;
      }

      const { chatSessions, activeChatSessionId } = get();
      const merged = mergeSessionsWithStored(
        stored,
        chatSessions.filter((session) => session.rootPath === rootPath),
      );
      if (!activate) {
        set({ chatSessions: [...others, ...merged] });
        return;
      }
      const activeStillExists = activeChatSessionId
        ? merged.some((s) => s.id === activeChatSessionId)
        : false;

      set({
        chatSessions: [...others, ...merged],
        activeChatSessionId: activeStillExists ? activeChatSessionId : merged[0].id,
      });
    },

    unloadSessions: (rootPath) => {
      const { chatSessions, activeChatSessionId } = get();
      const kept = chatSessions.filter((session) => session.rootPath !== rootPath);
      const activeKept = kept.some((session) => session.id === activeChatSessionId);
      set({ chatSessions: kept, activeChatSessionId: activeKept ? activeChatSessionId : null });
    },

    loadSessionMessages: async (sessionId) => {
      const session = findSession(sessionId);
      if (!session) return;
      const messages = await loadStoredSessionMessages(session.rootPath, sessionId);
      // An empty result changes nothing; replacing the array would re-trigger the loader forever.
      if (messages.length === 0) return;

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
      const removed = chatSessions.find((s) => s.id === sessionId);
      const nextSessions = chatSessions.filter((s) => s.id !== sessionId);
      let nextActive = activeChatSessionId;
      if (activeChatSessionId === sessionId) {
        const sameRoot = nextSessions.filter((s) => s.rootPath === removed?.rootPath);
        nextActive = sameRoot.length > 0 ? sameRoot[sameRoot.length - 1].id : null;
      }
      set({
        chatSessions: nextSessions,
        activeChatSessionId: nextActive,
      });
    },

    setActiveChatSession: (sessionId) => set({ activeChatSessionId: sessionId }),

    createChatSession: async (rootPath, init, options) => {
      const session: ChatSession = {
        id: init?.id ?? crypto.randomUUID(),
        rootPath,
        title: init?.title ?? "New Chat",
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      if (init?.kind !== undefined) session.kind = init.kind;
      if (init?.environment !== undefined) session.environment = init.environment;
      if (init?.environmentId !== undefined) session.environmentId = init.environmentId;
      if (init?.cliProviderId !== undefined) session.cliProviderId = init.cliProviderId;
      if (init?.agentId !== undefined) session.agentId = init.agentId;
      if (init?.agentEngine !== undefined) session.agentEngine = init.agentEngine;
      if (init?.parentId !== undefined) session.parentId = init.parentId;
      if (init?.category !== undefined) session.category = init.category;

      await saveStoredSession(rootPath, session);
      if (options?.activate === false) {
        set({ chatSessions: [...get().chatSessions, session] });
      } else {
        get().addChatSession(session);
      }
      return session;
    },

    deleteSession: async (sessionId) => {
      disposeTerminal(sessionId);
      const session = findSession(sessionId);
      if (session) await deleteStoredSession(session.rootPath, sessionId);
      get().removeChatSession(sessionId);
    },

    renameChatSession: async (sessionId, title) => {
      const session = findSession(sessionId);
      const trimmed = title.trim();
      if (!session || !trimmed || trimmed === session.title) return;

      const renamed: ChatSession = { ...session, title: trimmed, updatedAt: Date.now() };
      set({
        chatSessions: get().chatSessions.map((s) => (s.id === sessionId ? renamed : s)),
      });
      await saveStoredSession(renamed.rootPath, renamed);
    },

    saveSession: async (session) => {
      await saveStoredSession(session.rootPath, session);
    },

    updateChatSession: async (session) => {
      set({
        chatSessions: get().chatSessions.map((item) => (item.id === session.id ? session : item)),
      });
      await saveStoredSession(session.rootPath, session);
    },

    saveSessionMessages: async (sessionId, messages) => {
      const session = findSession(sessionId);
      if (!session) return;
      await saveStoredSessionMessages(session.rootPath, sessionId, messages);
    },
  };
};
