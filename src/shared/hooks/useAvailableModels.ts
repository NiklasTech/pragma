import { useEffect, useMemo } from "react";

import { useAIStore, type AIProvider, type ModelInfo } from "@/shared/stores/ai";
import { CLI_PROVIDER_IDS, isKeyOptionalProvider } from "@/shared/lib/ai-providers";

export interface UseAvailableModelsResult {
  models: ModelInfo[];
  loading: boolean;
  error: string | null;
  needsKey: boolean;
}

function isCLIAuthenticated(
  ids: string[],
  activeCLIProvider: string | null,
  cliStatuses: Record<string, { authenticated?: boolean }>,
): boolean {
  if (!activeCLIProvider) return false;
  if (!ids.includes(activeCLIProvider)) return false;
  return cliStatuses[activeCLIProvider]?.authenticated ?? false;
}

export function useAvailableModels(provider: AIProvider): UseAvailableModelsResult {
  const {
    availableModels,
    modelsLoading,
    apiKeyRefs,
    providers,
    activeCLIProvider,
    cliStatuses,
    loadAvailableModels,
  } = useAIStore();

  const cached = availableModels[provider];
  const loading = modelsLoading[provider] ?? false;

  const hasKey = Boolean(apiKeyRefs[provider]);
  const hasBaseUrl = Boolean(providers[provider]?.baseUrl?.trim());
  const cliAuthenticated = isCLIAuthenticated(
    CLI_PROVIDER_IDS[provider],
    activeCLIProvider,
    cliStatuses,
  );
  const needsKey = !isKeyOptionalProvider(provider) && !hasKey && !cliAuthenticated;
  const canFetch =
    hasKey || isKeyOptionalProvider(provider) || (provider === "custom" && hasBaseUrl);

  useEffect(() => {
    if (canFetch) {
      void loadAvailableModels(provider);
    }
  }, [provider, canFetch, loadAvailableModels]);

  return useMemo(() => {
    if (needsKey) {
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
  }, [cached, needsKey, loading]);
}
