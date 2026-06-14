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

// ─── CLI Types ───────────────────────────────────────────────────────────────

export interface CLIManifest {
  id: string;
  name: string;
  description: string;
  supports_sessions: boolean;
}

export interface CLIStatus {
  provider_id: string;
  installed: boolean;
  version: string | null;
  authenticated: boolean;
  user: string | null;
  error: string | null;
}

// ─── State ───────────────────────────────────────────────────────────────────

interface AIState {
  activeProvider: AIProvider;
  activeModel: string;
  inlineCompletion: boolean;
  completionDebounce: number;
  completionTriggerCharacters: string[];
  terminalSuggestions: boolean;
  terminalSuggestionProvider: AIProvider | null;
  terminalSuggestionModel: string | null;
  providers: Record<AIProvider, ProviderConfig>;
  chatSessions: ChatSession[];
  activeChatSessionId: string | null;
  apiKeyRefs: Record<AIProvider, string | null>;

  // CLI
  cliManifests: CLIManifest[];
  cliStatuses: Record<string, CLIStatus>;
  activeCLIProvider: string | null;
}

interface AIActions {
  setActiveProvider: (provider: AIProvider) => void;
  setActiveModel: (model: string) => void;
  setInlineCompletion: (enabled: boolean) => void;
  setCompletionDebounce: (ms: number) => void;
  setCompletionTriggerCharacters: (chars: string[]) => void;
  setTerminalSuggestions: (enabled: boolean) => void;
  setTerminalSuggestionProvider: (provider: AIProvider | null) => void;
  setTerminalSuggestionModel: (model: string | null) => void;
  updateProviderConfig: (provider: AIProvider, config: Partial<ProviderConfig>) => void;
  addChatSession: (session: ChatSession) => void;
  removeChatSession: (sessionId: string) => void;
  setActiveChatSession: (sessionId: string | null) => void;
  addChatMessage: (sessionId: string, message: ChatMessage) => void;
  createChatSession: () => ChatSession;
  setApiKeyRef: (provider: AIProvider, ref: string | null) => void;
  storeApiKey: (provider: AIProvider, key: string) => Promise<void>;
  loadKeyStatus: (provider: AIProvider) => Promise<void>;
  deleteApiKey: (provider: AIProvider) => Promise<void>;

  // CLI
  loadCLIManifests: () => Promise<void>;
  loadCLIStatuses: () => Promise<void>;
  installCLI: (providerId: string) => Promise<void>;
  startCLILogin: (providerId: string) => Promise<string>;
  logoutCLI: (providerId: string) => Promise<void>;
  setActiveCLIProvider: (providerId: string | null) => void;
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
    custom: null,
  },
  cliManifests: [],
  cliStatuses: {},
  activeCLIProvider: null,
};

export const useAIStore = create<AIState & AIActions>((set, get) => ({
  ...initialState,

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

  createChatSession: () => {
    const session: ChatSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: "New Chat",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const { chatSessions } = get();
    set({
      chatSessions: [...chatSessions, session],
      activeChatSessionId: session.id,
    });
    return session;
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

  // ─── CLI Actions ──────────────────────────────────────────────────────────

  loadCLIManifests: async () => {
    const manifests = await invoke<CLIManifest[]>("cli_list_manifests");
    set({ cliManifests: manifests });
  },

  loadCLIStatuses: async () => {
    try {
      const statuses = await invoke<CLIStatus[]>("cli_check_all_statuses");
      const map: Record<string, CLIStatus> = {};
      for (const s of statuses) {
        map[s.provider_id] = s;
      }
      set({ cliStatuses: map });
    } catch (e) {
      console.error("[CLI Statuses Error]", e);
    }
  },

  installCLI: async (providerId) => {
    await invoke("cli_install", { req: { provider_id: providerId } });
    await get().loadCLIStatuses();
  },

  startCLILogin: async (providerId) => {
    const result = await invoke<string>("cli_start_login", { req: { provider_id: providerId } });
    await get().loadCLIStatuses();
    return result;
  },

  logoutCLI: async (providerId) => {
    await invoke("cli_logout", { req: { provider_id: providerId } });
    await get().loadCLIStatuses();
  },

  setActiveCLIProvider: (providerId) => set({ activeCLIProvider: providerId }),
}));
