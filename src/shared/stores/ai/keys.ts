import { invoke } from "@tauri-apps/api/core";
import type { AIActions, AISlice } from "./types";

export const createKeysSlice: AISlice<
  Pick<AIActions, "setApiKeyRef" | "storeApiKey" | "loadKeyStatus" | "deleteApiKey">
> = (set, get) => ({
  setApiKeyRef: (provider, ref) => {
    const { apiKeyRefs } = get();
    set({
      apiKeyRefs: { ...apiKeyRefs, [provider]: ref },
    });
  },

  storeApiKey: async (provider, key) => {
    await invoke("ai_store_key", { req: { provider, key } });
    await get().loadKeyStatus(provider);
    await get().loadAvailableModels(provider, true);
  },

  loadKeyStatus: async (provider) => {
    const status = await invoke<{ has_key: boolean; masked: string }>("ai_key_status", {
      req: { provider },
    });
    set({
      apiKeyRefs: { ...get().apiKeyRefs, [provider]: status.has_key ? status.masked : null },
    });
  },

  deleteApiKey: async (provider) => {
    await invoke("ai_delete_key", { req: { provider } });
    set({
      apiKeyRefs: { ...get().apiKeyRefs, [provider]: null },
    });
    get().clearAvailableModels(provider);
  },
});
