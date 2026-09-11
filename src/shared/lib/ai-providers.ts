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
};

/**
 * CLI providers that can back a given API provider label.
 * E.g. the "Kimi" provider can be fulfilled by the local Kimi Code CLI and
 * the "OpenAI" provider by the local Codex CLI subscription.
 */
export const CLI_PROVIDER_IDS: Record<AIProvider, string[]> = {
  openai: ["openai-codex"],
  anthropic: [],
  ollama: [],
  deepseek: [],
  kimi: ["moonshot-kimi"],
  gemini: [],
  openrouter: [],
  custom: [],
  copilot: [],
};

/**
 * Providers that can be used without an API key (e.g. local servers).
 */
export function isKeyOptionalProvider(provider: AIProvider): boolean {
  return provider === "ollama" || provider === "custom";
}
