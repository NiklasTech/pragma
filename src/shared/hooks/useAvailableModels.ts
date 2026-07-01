import { useEffect, useMemo } from "react";

import { useAIStore, type AIProvider, type ModelInfo } from "@/shared/stores/ai";

export interface UseAvailableModelsResult {
  models: ModelInfo[];
  loading: boolean;
  error: string | null;
  needsKey: boolean;
}

const KEYLESS_PROVIDERS: AIProvider[] = ["ollama", "custom"];

export function useAvailableModels(provider: AIProvider): UseAvailableModelsResult {
  const { availableModels, modelsLoading, apiKeyRefs, providers, loadAvailableModels } =
    useAIStore();

  const cached = availableModels[provider];
  const loading = modelsLoading[provider] ?? false;

  const hasKey = Boolean(apiKeyRefs[provider]);
  const hasBaseUrl = Boolean(providers[provider]?.baseUrl?.trim());
  const needsKey = !KEYLESS_PROVIDERS.includes(provider);
  const canFetch = !needsKey || hasKey || (provider === "custom" && hasBaseUrl);

  useEffect(() => {
    if (canFetch) {
      void loadAvailableModels(provider);
    }
  }, [provider, canFetch, loadAvailableModels]);

  return useMemo(() => {
    if (!canFetch) {
      return {
        models: [],
        loading: false,
        error: null,
        needsKey: true,
      };
    }

    if (cached) {
      return {
        models: cached.models,
        loading,
        error: cached.error ?? null,
        needsKey: false,
      };
    }

    return {
      models: [],
      loading,
      error: null,
      needsKey: false,
    };
  }, [cached, canFetch, loading, needsKey]);
}
