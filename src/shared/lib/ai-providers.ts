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

export const PROVIDER_MODELS: Record<AIProvider, string[]> = {
  openai: ["gpt-4o", "o1", "o3"],
  anthropic: ["claude-opus-4", "claude-sonnet-4", "claude-haiku"],
  ollama: ["llama3.2", "codellama", "mistral", "phi4"],
  deepseek: ["deepseek-chat", "deepseek-coder"],
  kimi: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
  gemini: ["gemini-2.0-flash", "gemini-2.0-pro"],
  openrouter: ["openrouter/free"],
  custom: [],
  copilot: ["gpt-4o", "claude-3.5-sonnet", "gemini-2.0-flash"],
};

export type ProviderMode = "fast" | "smart" | "local";

export const MODE_LABELS: Record<ProviderMode, string> = {
  fast: "Fast",
  smart: "Smart",
  local: "Local",
};

export const LOCAL_PROVIDER: AIProvider = "ollama";

/**
 * Providers that can be used without an API key (e.g. local servers).
 */
export function isKeyOptionalProvider(provider: AIProvider): boolean {
  return provider === "ollama" || provider === "custom";
}

/**
 * Per-provider model recommendation for Fast / Smart modes.
 * Local mode always switches to {@link LOCAL_PROVIDER}.
 */
export const PROVIDER_MODEL_MODES: Record<AIProvider, { fast?: string; smart?: string }> = {
  openai: { fast: "gpt-4o", smart: "o1" },
  anthropic: { fast: "claude-haiku", smart: "claude-opus-4" },
  ollama: { fast: "llama3.2", smart: "codellama" },
  deepseek: { fast: "deepseek-chat", smart: "deepseek-coder" },
  kimi: { fast: "moonshot-v1-8k", smart: "moonshot-v1-128k" },
  gemini: { fast: "gemini-2.0-flash", smart: "gemini-2.0-pro" },
  openrouter: { fast: "openrouter/free", smart: "openrouter/free" },
  custom: {},
  copilot: { fast: "gpt-4o", smart: "claude-3.5-sonnet" },
};
