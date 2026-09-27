import { describe, expect, it } from "vite-plus/test";

import { useAIStore } from "@/shared/stores/ai";
import { useSettingsStore } from "@/shared/stores/settings";

import { syncAIStore } from "./useAIInit";

describe("syncAIStore", () => {
  it("copies the saved provider, model and base URL into the runtime store", () => {
    const ai = useSettingsStore.getState().ai;
    const settings = {
      ...ai,
      defaultProvider: "custom" as const,
      defaultModel: "local-model",
      providers: {
        ...ai.providers,
        custom: { model: "local-model", baseUrl: "http://127.0.0.1:8000/v1" },
      },
    };

    syncAIStore(settings);

    const state = useAIStore.getState();
    expect(state.activeProvider).toBe("custom");
    expect(state.activeModel).toBe("local-model");
    expect(state.providers.custom?.baseUrl).toBe("http://127.0.0.1:8000/v1");
  });

  it("leaves a model picked in the chat alone when an unrelated setting changes", () => {
    const ai = useSettingsStore.getState().ai;
    syncAIStore({ ...ai, defaultModel: "saved-model" });
    useAIStore.setState({ activeModel: "picked-in-chat" });

    const previous = { ...ai, defaultModel: "saved-model" };
    syncAIStore({ ...previous, showThinking: !previous.showThinking }, previous);

    expect(useAIStore.getState().activeModel).toBe("picked-in-chat");
  });
});
