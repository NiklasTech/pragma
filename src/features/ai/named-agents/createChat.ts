import type { ChatSession } from "@/shared/stores/ai";

import { startSession } from "../sessions/start";
import type { Agent } from "./types";

export async function createAgentChat(
  rootPath: string,
  agent: Agent,
  title?: string,
): Promise<ChatSession> {
  return startSession(rootPath, {
    init: { title, kind: "agent", agentId: agent.id, agentEngine: agent.engine },
  });
}
