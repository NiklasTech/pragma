import { create } from "zustand";
import { createCLISlice } from "./ai/cli";
import { createCopilotSlice } from "./ai/copilot";
import { createCoreSlice } from "./ai/core";
import { createKeysSlice } from "./ai/keys";
import { createMessagesSlice } from "./ai/messages";
import { createModelsSlice } from "./ai/models";
import { createSessionsSlice } from "./ai/sessions";
import type { AIProvider, AIState, AIStore, ProviderConfig } from "./ai/types";

export type {
  AIProvider,
  ChatMessage,
  ChatSession,
  CLIManifest,
  CLIStatus,
  CreateChatSessionInit,
  ModelInfo,
  ModelListCache,
  ProviderConfig,
  SessionWorktree,
} from "./ai/types";
export { mergeSessionsWithStored } from "./ai/sessions";

const defaultProviders: Record<AIProvider, ProviderConfig> = {
  openai: { model: "" },
  anthropic: { model: "" },
  ollama: { baseUrl: "http://localhost:11434", model: "" },
  deepseek: { baseUrl: "https://api.deepseek.com", model: "" },
  kimi: { baseUrl: "https://api.kimi.com/coding/v1", model: "" },
  gemini: { baseUrl: "https://generativelanguage.googleapis.com", model: "" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", model: "" },
  custom: { baseUrl: "", model: "" },
  copilot: { model: "" },
  grok: { baseUrl: "https://api.x.ai/v1", model: "" },
  cursor: { model: "" },
  opencode: { model: "" },
  hermes: { model: "" },
};

const initialState: AIState = {
  activeProvider: "anthropic",
  activeModel: "",
  inlineCompletion: true,
  completionDebounce: 500,
  completionTriggerCharacters: [],
  terminalSuggestions: true,
  terminalSuggestionProvider: null,
  terminalSuggestionModel: null,
  providers: { ...defaultProviders },
  chatSessions: [],
  activeChatSessionId: null,
  apiKeyRefs: {
    openai: null,
    anthropic: null,
    ollama: null,
    deepseek: null,
    kimi: null,
    gemini: null,
    openrouter: null,
    custom: null,
    copilot: null,
    grok: null,
    cursor: null,
    opencode: null,
    hermes: null,
  },
  availableModels: {},
  modelsLoading: {},
  copilotAuth: {
    authenticated: false,
    clientId: "",
  },
  cliManifests: [],
  cliStatuses: {},
  activeCLIProvider: null,
};

export const useAIStore = create<AIStore>()((...a) => ({
  ...initialState,
  ...createCoreSlice(...a),
  ...createSessionsSlice(...a),
  ...createMessagesSlice(...a),
  ...createKeysSlice(...a),
  ...createModelsSlice(...a),
  ...createCLISlice(...a),
  ...createCopilotSlice(...a),
}));
