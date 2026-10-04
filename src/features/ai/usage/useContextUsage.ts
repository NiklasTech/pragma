import { useAIStore } from "@/shared/stores/ai";
import { pinnedSessionEngine, resolveEffectiveEngine } from "@/shared/lib/ai/sessionEngine";

import { resolveContextWindow } from "./contextWindow";

export interface ContextUsage {
  used: number;
  size: number;
}

/// How full the active session's context window is, or null when that is unknown.
export function useContextUsage(): ContextUsage | null {
  const session = useAIStore((state) =>
    state.chatSessions.find((item) => item.id === state.activeChatSessionId),
  );
  const activeCLIProvider = useAIStore((state) => state.activeCLIProvider);
  const activeProvider = useAIStore((state) => state.activeProvider);
  const activeModel = useAIStore((state) => state.activeModel);
  const providers = useAIStore((state) => state.providers);
  const availableModels = useAIStore((state) => state.availableModels);

  const used = session?.usage?.contextTokens;
  if (used === undefined) return null;

  const engine = resolveEffectiveEngine(pinnedSessionEngine(session), {
    activeCLIProvider,
    activeProvider,
    activeModel,
    providers,
  });
  // Coding agents pick their own model, so only a size they report is meaningful.
  const size =
    session?.usage?.contextWindow ??
    (engine.cliProviderId === null
      ? resolveContextWindow(engine.model, availableModels[engine.provider])
      : null);
  if (!size) return null;
  return { used, size };
}
