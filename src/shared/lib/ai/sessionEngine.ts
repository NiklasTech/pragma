import type { AgentEngine, AIProvider, ProviderConfig } from "@/shared/stores/ai";

export interface EngineDefaults {
  activeCLIProvider: string | null;
  activeProvider: AIProvider;
  activeModel: string;
  providers: Record<AIProvider, ProviderConfig>;
}

export interface EffectiveEngine {
  cliProviderId: string | null;
  provider: AIProvider;
  model: string;
  baseUrl: string | undefined;
}

/// A session's pinned engine wins over the global provider, model and CLI selection.
export function resolveEffectiveEngine(
  pinned: AgentEngine | null,
  defaults: EngineDefaults,
): EffectiveEngine {
  const cliProviderId =
    pinned?.kind === "cli"
      ? (pinned.cliProviderId ?? null)
      : pinned?.kind === "builtin"
        ? null
        : defaults.activeCLIProvider;
  const provider =
    pinned?.kind === "builtin" && pinned.provider ? pinned.provider : defaults.activeProvider;
  const model = pinned?.kind === "builtin" && pinned.model ? pinned.model : defaults.activeModel;
  const baseUrl =
    pinned?.kind === "builtin" && pinned.baseUrl !== undefined
      ? pinned.baseUrl
      : defaults.providers[provider].baseUrl;
  return { cliProviderId, provider, model, baseUrl };
}
