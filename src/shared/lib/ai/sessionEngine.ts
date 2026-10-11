import type {
  AgentEngine,
  AIProvider,
  ChatSession,
  CLIStatus,
  ProviderConfig,
} from "@/shared/stores/ai";

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

export interface EngineAuth {
  apiKeyRefs: Record<AIProvider, string | null>;
  cliStatuses: Record<string, CLIStatus>;
  copilotAuth: { authenticated: boolean };
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

/// True when the engine has the sign-in, key or endpoint it needs to answer a message.
export function engineCanChat(engine: EffectiveEngine, auth: EngineAuth): boolean {
  const cliAuthenticated =
    engine.cliProviderId !== null && auth.cliStatuses[engine.cliProviderId]?.authenticated === true;
  return (
    cliAuthenticated ||
    auth.apiKeyRefs[engine.provider] !== null ||
    engine.provider === "ollama" ||
    (engine.provider === "custom" && Boolean(engine.baseUrl)) ||
    (engine.provider === "copilot" && auth.copilotAuth.authenticated)
  );
}

/// A coding CLI conversation started before engines were pinned still runs on its own CLI.
export function pinnedSessionEngine(
  session: Pick<ChatSession, "kind" | "agentEngine" | "cliProviderId"> | undefined,
): AgentEngine | null {
  if (!session) return null;
  if (session.agentEngine) return session.agentEngine;
  if (session.kind !== "terminal" && session.cliProviderId) {
    return { kind: "cli", cliProviderId: session.cliProviderId };
  }
  return null;
}
