import type { AIProvider } from "@/shared/stores/ai";

export const PROVIDER_LABELS: Record<AIProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  ollama: "Ollama",
  deepseek: "DeepSeek",
  kimi: "Kimi",
  gemini: "Gemini",
  openrouter: "OpenRouter",
  custom: "Custom",
  copilot: "GitHub Copilot",
  grok: "Grok",
  cursor: "Cursor",
  opencode: "OpenCode",
  hermes: "Hermes",
};

/**
 * CLI providers that can back a given API provider label.
 * E.g. the "Kimi" provider can be fulfilled by the local Kimi Code CLI and
 * the "OpenAI" provider by the local Codex CLI subscription.
 */
export const CLI_PROVIDER_IDS: Record<AIProvider, string[]> = {
  openai: ["openai-codex"],
  anthropic: ["anthropic-claude"],
  ollama: [],
  deepseek: [],
  kimi: ["moonshot-kimi"],
  gemini: ["google-gemini"],
  openrouter: [],
  custom: [],
  copilot: ["github-copilot"],
  grok: ["xai-grok"],
  cursor: ["cursor-agent"],
  opencode: ["opencode"],
  hermes: ["hermes-agent"],
};

/**
 * Providers that are only available through their local CLI, with no API-key path.
 */
export function isCLIOnlyProvider(provider: AIProvider): boolean {
  return provider === "cursor" || provider === "opencode" || provider === "hermes";
}

export function aiProviderForCLI(cliId: string): AIProvider | null {
  for (const [provider, cliIds] of Object.entries(CLI_PROVIDER_IDS) as [AIProvider, string[]][]) {
    if (cliIds.includes(cliId)) return provider;
  }
  return null;
}

/**
 * Providers that can be used without an API key (e.g. local servers).
 */
export function isKeyOptionalProvider(provider: AIProvider): boolean {
  return provider === "ollama" || provider === "custom";
}
