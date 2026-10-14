import { useCallback } from "react";

import { useActiveSessionMeta } from "@/shared/hooks/useActiveSessionMeta";
import { useAIStore, type AgentEngine, type AIProvider } from "@/shared/stores/ai";

export interface PinnedChatEngine {
  provider: AIProvider;
  model: string;
  setProvider: (provider: AIProvider, model: string) => void;
  setModel: (model: string) => void;
}

/// The built-in provider and model pinned on the active chat, which win over the global selection.
export function usePinnedChatEngine(): PinnedChatEngine | null {
  const engine = useActiveSessionMeta()?.agentEngine;

  const save = useCallback((next: AgentEngine) => {
    const { chatSessions, activeChatSessionId, updateChatSession } = useAIStore.getState();
    const session = chatSessions.find((item) => item.id === activeChatSessionId);
    if (!session) return;
    void updateChatSession({ ...session, agentEngine: next });
  }, []);

  const setProvider = useCallback(
    (provider: AIProvider, model: string) => save({ kind: "builtin", provider, model }),
    [save],
  );

  const setModel = useCallback(
    (model: string) => {
      if (engine) save({ ...engine, model });
    },
    [engine, save],
  );

  if (engine?.kind !== "builtin" || !engine.provider) return null;
  return { provider: engine.provider, model: engine.model ?? "", setProvider, setModel };
}
