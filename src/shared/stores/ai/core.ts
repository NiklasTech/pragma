import type { AIActions, AISlice } from "./types";

export const createCoreSlice: AISlice<
  Pick<
    AIActions,
    | "setActiveProvider"
    | "setActiveModel"
    | "setInlineCompletion"
    | "setCompletionDebounce"
    | "setCompletionTriggerCharacters"
    | "setTerminalSuggestions"
    | "setTerminalSuggestionProvider"
    | "setTerminalSuggestionModel"
    | "updateProviderConfig"
  >
> = (set, get) => ({
  setActiveProvider: (provider) => set({ activeProvider: provider }),
  setActiveModel: (model) => set({ activeModel: model }),
  setInlineCompletion: (enabled) => set({ inlineCompletion: enabled }),
  setCompletionDebounce: (ms) => set({ completionDebounce: ms }),
  setCompletionTriggerCharacters: (chars) => set({ completionTriggerCharacters: chars }),
  setTerminalSuggestions: (enabled) => set({ terminalSuggestions: enabled }),
  setTerminalSuggestionProvider: (provider) => set({ terminalSuggestionProvider: provider }),
  setTerminalSuggestionModel: (model) => set({ terminalSuggestionModel: model }),

  updateProviderConfig: (provider, config) => {
    const { providers } = get();
    set({
      providers: {
        ...providers,
        [provider]: { ...providers[provider], ...config },
      },
    });
  },
});
