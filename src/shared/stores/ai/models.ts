import { invoke } from "@tauri-apps/api/core";
import type { AIActions, AIProvider, AISlice, ModelInfo } from "./types";

export const createModelsSlice: AISlice<
  Pick<AIActions, "loadAvailableModels" | "clearAvailableModels">
> = (set, get) => ({
  loadAvailableModels: async (provider, force = false) => {
    const { availableModels, modelsLoading, providers, apiKeyRefs } = get();
    const cached = availableModels[provider];

    if (modelsLoading[provider]) return;

    const keylessProviders: AIProvider[] = ["ollama", "custom"];
    const hasKey = Boolean(apiKeyRefs[provider]) || keylessProviders.includes(provider);
    if (!hasKey) return;

    if (!force && cached && Date.now() - cached.fetchedAt < 5 * 60 * 1000) return;

    set({ modelsLoading: { ...modelsLoading, [provider]: true } });

    try {
      const models = await invoke<ModelInfo[]>("ai_list_models", {
        req: { provider, base_url: providers[provider]?.baseUrl },
      });
      set({
        availableModels: {
          ...get().availableModels,
          [provider]: { models, fetchedAt: Date.now(), error: null },
        },
      });
    } catch (err) {
      set({
        availableModels: {
          ...get().availableModels,
          [provider]: {
            models: [],
            fetchedAt: Date.now(),
            error: String(err),
          },
        },
      });
    } finally {
      set({ modelsLoading: { ...get().modelsLoading, [provider]: false } });
    }
  },

  clearAvailableModels: (provider) => {
    const { availableModels } = get();
    const next = { ...availableModels };
    delete next[provider];
    set({ availableModels: next });
  },
});
