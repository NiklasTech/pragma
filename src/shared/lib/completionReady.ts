import type { AIProvider } from "@/shared/stores/ai";

/// Whether the provider can serve suggestions while typing: Ollama runs locally, a custom
/// endpoint needs its URL and every other provider needs a stored API key.
export function completionReady(
  provider: AIProvider,
  config: { baseUrl?: string } | undefined,
  apiKeyRef: string | null | undefined,
): boolean {
  if (provider === "ollama") return true;
  if (provider === "custom") return Boolean(config?.baseUrl);
  return apiKeyRef !== null && apiKeyRef !== undefined;
}
