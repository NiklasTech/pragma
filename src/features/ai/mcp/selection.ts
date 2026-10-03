import { useAIStore, type ChatSession } from "@/shared/stores/ai";
import { useNamedAgentsStore } from "@/features/ai/named-agents/store";
import type { Agent } from "@/features/ai/named-agents/types";

/// The MCP servers a session may use: its own choice, else its agent's, else all (null).
export function resolveMcpServerIds(
  session: Pick<ChatSession, "mcpServers"> | null | undefined,
  agent: Pick<Agent, "mcpServers"> | null | undefined,
): string[] | null {
  return session?.mcpServers ?? agent?.mcpServers ?? null;
}

export function isMcpServerAllowed(allowed: string[] | null, serverId: string): boolean {
  return allowed === null || allowed.includes(serverId);
}

/// Reads the selection for a session from the stores, for code outside React.
export function sessionMcpServerIds(sessionId: string | null): string[] | null {
  if (!sessionId) return null;
  const session = useAIStore.getState().chatSessions.find((item) => item.id === sessionId);
  const agent = session?.agentId
    ? useNamedAgentsStore.getState().agents.find((item) => item.id === session.agentId)
    : null;
  return resolveMcpServerIds(session, agent);
}

/// Stable key for memoizing on a selection.
export function mcpSelectionKey(allowed: string[] | null): string {
  return allowed === null ? "*" : [...allowed].sort().join("\n");
}
