import { useShallow } from "zustand/react/shallow";

import { useAIStore, type ChatSession } from "@/shared/stores/ai";

export type ActiveSessionMeta = Pick<
  ChatSession,
  "kind" | "agentEngine" | "cliProviderId" | "worktree" | "mcpServers" | "agentId" | "usage"
>;

/// Session settings without the messages, so streaming does not re-render the caller on every update.
export function useActiveSessionMeta(): ActiveSessionMeta | undefined {
  return useAIStore(
    useShallow((state) => {
      const session = state.chatSessions.find((item) => item.id === state.activeChatSessionId);
      if (!session) return undefined;
      return {
        kind: session.kind,
        agentEngine: session.agentEngine,
        cliProviderId: session.cliProviderId,
        worktree: session.worktree,
        mcpServers: session.mcpServers,
        agentId: session.agentId,
        usage: session.usage,
      };
    }),
  );
}
