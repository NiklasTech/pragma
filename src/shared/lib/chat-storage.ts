import { invoke } from "@tauri-apps/api/core";

import type { ChatMessage, ChatSession } from "@/shared/stores/ai";

export interface StoredSessionMetadata {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

export interface StoredChatMessage {
  id: string;
  role: string;
  content: string;
  timestamp: number;
}

function toStoredSession(session: ChatSession): StoredSessionMetadata {
  return {
    id: session.id,
    title: session.title,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
  };
}

export function fromStoredSession(session: StoredSessionMetadata): ChatSession {
  return {
    id: session.id,
    title: session.title,
    messages: [],
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  };
}

function toStoredMessage(message: ChatMessage): StoredChatMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp,
  };
}

function fromStoredMessage(message: StoredChatMessage): ChatMessage {
  return {
    id: message.id,
    role: message.role as ChatMessage["role"],
    content: message.content,
    timestamp: message.timestamp,
  };
}

export async function loadSessions(rootPath: string): Promise<ChatSession[]> {
  const sessions = await invoke<StoredSessionMetadata[]>("ai_load_sessions", {
    req: { root_path: rootPath || "default" },
  });
  return sessions.map(fromStoredSession);
}

export async function loadSessionMessages(
  rootPath: string,
  sessionId: string,
): Promise<ChatMessage[]> {
  const messages = await invoke<StoredChatMessage[]>("ai_load_session_messages", {
    req: { root_path: rootPath || "default", session_id: sessionId },
  });
  return messages.map(fromStoredMessage);
}

export async function saveSession(rootPath: string, session: ChatSession): Promise<void> {
  await invoke("ai_save_session", {
    req: { root_path: rootPath || "default", session: toStoredSession(session) },
  });
}

export async function saveSessionMessages(
  rootPath: string,
  sessionId: string,
  messages: ChatMessage[],
): Promise<void> {
  await invoke("ai_save_session_messages", {
    req: {
      root_path: rootPath || "default",
      session_id: sessionId,
      messages: messages.map(toStoredMessage),
    },
  });
}

export async function deleteSession(rootPath: string, sessionId: string): Promise<void> {
  await invoke("ai_delete_session", {
    req: { root_path: rootPath || "default", session_id: sessionId },
  });
}

export async function migrateChatStorage(rootPath: string, sessions: ChatSession[]): Promise<void> {
  const messagesBySession = sessions.map(
    (s) => [s.id, s.messages.map(toStoredMessage)] as [string, StoredChatMessage[]],
  );
  await invoke("ai_migrate_chat_storage", {
    root_path: rootPath || "default",
    sessions: sessions.map(toStoredSession),
    messages_by_session: messagesBySession,
  });
}
