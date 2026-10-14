import { useAIStore } from "@/shared/stores/ai";
import type { AgentSettings } from "@/shared/stores/settings";
import { getAgentSettings } from "@/shared/stores/workspaceSettings/effective";

import type { AgentRunContext } from "./runContext";

/// The repository of the session a run reports to, or undefined when the session is unknown.
export function runRepository(context: AgentRunContext): string | undefined {
  const sessionId = context.sessionId();
  return useAIStore.getState().chatSessions.find((session) => session.id === sessionId)?.rootPath;
}

/// The agent settings and trust of the run's repository, not of the active one.
export function runAgentSettings(context: AgentRunContext): AgentSettings {
  return getAgentSettings(runRepository(context));
}
