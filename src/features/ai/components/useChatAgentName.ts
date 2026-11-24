import { useAIStore } from "@/shared/stores/ai";
import { useActiveSessionMeta } from "@/shared/hooks/useActiveSessionMeta";
import { pinnedSessionEngine } from "@/shared/lib/ai/sessionEngine";

/** Who answers in the open chat: the coding CLI it runs on, else Pragma. */
export function useChatAgentName(): string {
  const engine = pinnedSessionEngine(useActiveSessionMeta());
  const cliId = engine?.kind === "cli" ? engine.cliProviderId : undefined;
  return useAIStore(
    (state) => state.cliManifests.find((manifest) => manifest.id === cliId)?.name ?? "Pragma",
  );
}
