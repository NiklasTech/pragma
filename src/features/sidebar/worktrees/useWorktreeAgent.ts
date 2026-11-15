import { useAIStore } from "@/shared/stores/ai";
import { sessionAgentManifest } from "@/features/ai/sessions/sessionAgent";
import { selectAgentState, useAgentStatesStore } from "@/features/ai/state/agentStates";

/// The agent of a worktree's session: its manifest, name and state.
export function useWorktreeAgent(sessionId: string | null) {
  const manifest = useAIStore((state) => sessionAgentManifest(state, sessionId));
  const state = useAgentStatesStore(selectAgentState(sessionId));
  return { manifest, name: manifest?.name ?? "Pragma", state };
}
