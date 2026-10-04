import { useEffect, useRef, type RefObject } from "react";
import type { UIMessage, UseChatHelpers } from "@ai-sdk/react";

import { useAIStore, type ChatSession } from "@/shared/stores/ai";
import {
  shouldPersistSession,
  type SessionPersistSnapshot,
} from "@/shared/stores/sessionPersistence";
import { getMessageText, storedMessagesToUI, uiMessageToStored } from "@/shared/lib/ai/protocol";
import { lastStepHasToolCalls } from "@/features/agent/loop";
import { notifySessionFinished } from "@/features/extensions/events";

interface ChatSessionLoadingOptions {
  chat: UseChatHelpers<UIMessage>;
  rootPath: string;
  activeChatSessionId: string | null;
  chatSessions: ChatSession[];
  activeSession: ChatSession | undefined;
}

export function useChatSessionLoading({
  chat,
  rootPath,
  activeChatSessionId,
  chatSessions,
  activeSession,
}: ChatSessionLoadingOptions) {
  const loadSessions = useAIStore((state) => state.loadSessions);
  const loadSessionMessages = useAIStore((state) => state.loadSessionMessages);

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
}

interface ChatSessionPersistenceOptions {
  chat: UseChatHelpers<UIMessage>;
  chatRef: RefObject<UseChatHelpers<UIMessage> | null>;
  rootPath: string;
  activeChatSessionId: string | null;
  chatSessions: ChatSession[];
  agentActive: boolean;
}

export function useChatSessionPersistence({
  chat,
  chatRef,
  rootPath,
  activeChatSessionId,
  chatSessions,
  agentActive,
}: ChatSessionPersistenceOptions) {
  const updateChatSessionMessages = useAIStore((state) => state.updateChatSessionMessages);
  const saveSessionMessages = useAIStore((state) => state.saveSessionMessages);
  const saveSession = useAIStore((state) => state.saveSession);

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
  const previousPersistRef = useRef<SessionPersistSnapshot>({
    sessionId: null,
    title: null,
    status: chat.status,
  });
  useEffect(() => {
    if (!activeChatSessionId) return;
    const session = chatSessions.find((s) => s.id === activeChatSessionId);
    if (!session) return;

    const previous = previousPersistRef.current;
    const current: SessionPersistSnapshot = {
      sessionId: activeChatSessionId,
      title: session.title,
      status: chat.status,
    };
    previousPersistRef.current = current;

    if (shouldPersistSession(previous, current)) {
      void saveSession(rootPath, session);
    }

    // Save messages when streaming finishes.
    const wasStreaming = previous.status === "streaming" || previous.status === "submitted";
    const isReady = chat.status === "ready";
    if (wasStreaming && isReady) {
      void saveSessionMessages(rootPath, activeChatSessionId, session.messages);
    }
    // Agent Mode runs report their end through the agent store; tool steps continue on their own.
    const finished = isReady || chat.status === "error";
    const messages = chatRef.current?.messages ?? [];
    if (wasStreaming && finished && !agentActive && !lastStepHasToolCalls(messages)) {
      notifySessionFinished({
        sessionId: activeChatSessionId,
        title: session.title,
        status: isReady ? "done" : "error",
      });
    }
  }, [
    chat.status,
    activeChatSessionId,
    rootPath,
    chatSessions,
    saveSession,
    saveSessionMessages,
    agentActive,
  ]);

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
      // The session may have been deleted while the timeout was pending.
      const stillExists = useAIStore
        .getState()
        .chatSessions.some((s) => s.id === activeChatSessionId);
      if (!stillExists) return;
      void saveSessionMessages(rootPath, activeChatSessionId, session.messages);
    }, 1000);

    return () => {
      if (debouncedSaveRef.current) {
        clearTimeout(debouncedSaveRef.current);
      }
    };
  }, [activeChatSessionId, rootPath, chatSessions, saveSessionMessages]);
}
