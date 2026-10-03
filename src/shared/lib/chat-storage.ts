import { invoke } from "@tauri-apps/api/core";

import type { AgentEngine, ChatMessage, ChatSession } from "@/shared/stores/ai";

export interface StoredWorktree {
  branch: string;
  path: string;
  setup_log: string;
  status: "ready" | "error";
}

export interface StoredSessionMetadata {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  kind?: string | null;
  environment?: string | null;
  worktree?: StoredWorktree | null;
  cli_provider_id?: string | null;
  agent_id?: string | null;
  archived?: boolean;
  agent_engine?: AgentEngine | null;
  parent_id?: string | null;
  category?: string | null;
  mcp_servers?: string[] | null;
}

export interface StoredChatMessage {
  id: string;
  role: string;
  content: string;
  timestamp: number;
}

function toStoredSession(session: ChatSession): StoredSessionMetadata {
  const stored: StoredSessionMetadata = {
    id: session.id,
    title: session.title,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
  };

  if (session.kind) stored.kind = session.kind;
  if (session.environment) stored.environment = session.environment;
  if (session.cliProviderId) stored.cli_provider_id = session.cliProviderId;
  if (session.agentId) stored.agent_id = session.agentId;
  if (session.archived) stored.archived = true;
  if (session.agentEngine) stored.agent_engine = session.agentEngine;
  if (session.parentId) stored.parent_id = session.parentId;
  if (session.category) stored.category = session.category;
  if (session.mcpServers) stored.mcp_servers = session.mcpServers;
  if (session.worktree === null) {
    stored.worktree = null;
  } else if (session.worktree) {
    stored.worktree = {
      branch: session.worktree.branch,
      path: session.worktree.path,
      setup_log: session.worktree.setupLog,
      status: session.worktree.status,
    };
  }

  return stored;
}

export function fromStoredSession(session: StoredSessionMetadata): ChatSession {
  const restored: ChatSession = {
    id: session.id,
    title: session.title,
    messages: [],
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  };

  if (session.kind === "ask" || session.kind === "agent" || session.kind === "terminal") {
    restored.kind = session.kind;
  }
  if (session.environment === "checkout" || session.environment === "worktree") {
    restored.environment = session.environment;
  }
  if (session.cli_provider_id) restored.cliProviderId = session.cli_provider_id;
  if (session.agent_id) restored.agentId = session.agent_id;
  if (session.archived) restored.archived = true;
  if (session.agent_engine) restored.agentEngine = session.agent_engine;
  if (session.parent_id) restored.parentId = session.parent_id;
  if (session.category) restored.category = session.category;
  if (session.mcp_servers) restored.mcpServers = session.mcp_servers;
  if (session.worktree) {
    restored.worktree = {
      branch: session.worktree.branch,
      path: session.worktree.path,
      setupLog: session.worktree.setup_log,
      status: session.worktree.status,
    };
  }

  return restored;
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
