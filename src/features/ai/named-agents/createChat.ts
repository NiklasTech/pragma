import { useAIStore, type ChatSession } from "@/shared/stores/ai";

import type { Agent } from "./types";

export async function createAgentChat(rootPath: string, agent: Agent): Promise<ChatSession> {
  return useAIStore.getState().createChatSession(rootPath, {
    kind: "agent",
    environment: "checkout",
    agentId: agent.id,
    agentEngine: agent.engine,
  });
}
