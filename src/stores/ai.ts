import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

export type AIProvider = "openai" | "anthropic" | "ollama" | "deepseek" | "kimi" | "custom";

export interface ProviderConfig {
  model: string;
  baseUrl?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

interface AIState {
  activeProvider: AIProvider;
  activeModel: string;
  inlineCompletion: boolean;
  completionDebounce: number;
  terminalSuggestions: boolean;
  providers: Record<AIProvider, ProviderConfig>;
  chatSessions: ChatSession[];
  activeChatSessionId: string | null;
  apiKeyRefs: Record<AIProvider, string | null>;
}

interface AIActions {
  setActiveProvider: (provider: AIProvider) => void;
  setActiveModel: (model: string) => void;
  setInlineCompletion: (enabled: boolean) => void;
  setCompletionDebounce: (ms: number) => void;
  setTerminalSuggestions: (enabled: boolean) => void;
  updateProviderConfig: (provider: AIProvider, config: Partial<ProviderConfig>) => void;
  addChatSession: (session: ChatSession) => void;
  removeChatSession: (sessionId: string) => void;
  setActiveChatSession: (sessionId: string | null) => void;
  addChatMessage: (sessionId: string, message: ChatMessage) => void;
  setApiKeyRef: (provider: AIProvider, ref: string | null) => void;
  storeApiKey: (provider: AIProvider, key: string) => Promise<void>;
  loadKeyStatus: (provider: AIProvider) => Promise<void>;
  deleteApiKey: (provider: AIProvider) => Promise<void>;
}

const defaultProviders: Record<AIProvider, ProviderConfig> = {
  openai: { model: "gpt-4o" },
  anthropic: { model: "claude-sonnet-4-6" },
  ollama: { baseUrl: "http://localhost:11434", model: "llama3.2" },
  deepseek: { baseUrl: "https://api.deepseek.com", model: "deepseek-chat" },
  kimi: { baseUrl: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k" },
  custom: { baseUrl: "", model: "" },
};

const initialState: AIState = {
  activeProvider: "anthropic",
  activeModel: "claude-sonnet-4-6",
  inlineCompletion: true,
  completionDebounce: 500,
  terminalSuggestions: true,
  providers: { ...defaultProviders },
  chatSessions: [],
  activeChatSessionId: null,
  apiKeyRefs: {
    openai: null,
    anthropic: null,
    ollama: null,
    deepseek: null,
    kimi: null,
    custom: null,
  },
};

export const useAIStore = create<AIState & AIActions>((set, get) => ({
  ...initialState,

  setActiveProvider: (provider) => set({ activeProvider: provider }),
  setActiveModel: (model) => set({ activeModel: model }),
  setInlineCompletion: (enabled) => set({ inlineCompletion: enabled }),
  setCompletionDebounce: (ms) => set({ completionDebounce: ms }),
  setTerminalSuggestions: (enabled) => set({ terminalSuggestions: enabled }),

  updateProviderConfig: (provider, config) => {
    const { providers } = get();
    set({
      providers: {
        ...providers,
        [provider]: { ...providers[provider], ...config },
      },
    });
  },

  addChatSession: (session) => {
    const { chatSessions } = get();
    set({
      chatSessions: [...chatSessions, session],
      activeChatSessionId: session.id,
    });
  },

  removeChatSession: (sessionId) => {
    const { chatSessions, activeChatSessionId } = get();
    const nextSessions = chatSessions.filter((s) => s.id !== sessionId);
    let nextActive = activeChatSessionId;
    if (activeChatSessionId === sessionId) {
      nextActive = nextSessions.length > 0 ? nextSessions[nextSessions.length - 1].id : null;
    }
    set({
      chatSessions: nextSessions,
      activeChatSessionId: nextActive,
    });
  },

  setActiveChatSession: (sessionId) => set({ activeChatSessionId: sessionId }),

  addChatMessage: (sessionId, message) => {
    const { chatSessions } = get();
    set({
      chatSessions: chatSessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              messages: [...s.messages, message],
              updatedAt: Date.now(),
            }
          : s,
      ),
    });
  },

  setApiKeyRef: (provider, ref) => {
    const { apiKeyRefs } = get();
    set({
      apiKeyRefs: { ...apiKeyRefs, [provider]: ref },
    });
  },

  storeApiKey: async (provider, key) => {
    await invoke("ai_store_key", { req: { provider, key } });
    await get().loadKeyStatus(provider);
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
  },
}));
