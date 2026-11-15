import { resolveEffectiveEngine } from "@/shared/lib/ai/sessionEngine";
import type { AIState, CLIManifest } from "@/shared/stores/ai/types";

/** The coding CLI behind a session: its terminal, its pinned engine or the default engine. */
export function sessionAgentManifest(
  state: AIState,
  sessionId: string | null | undefined,
): CLIManifest | undefined {
  const session = sessionId ? state.chatSessions.find((item) => item.id === sessionId) : undefined;
  if (!session) return undefined;
  const providerId =
    session.cliProviderId ??
    resolveEffectiveEngine(session.agentEngine ?? null, state).cliProviderId;
  return providerId ? state.cliManifests.find((item) => item.id === providerId) : undefined;
}
