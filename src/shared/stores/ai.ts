import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

import {
  deleteSession as deleteStoredSession,
  loadSessionMessages as loadStoredSessionMessages,
  loadSessions as loadStoredSessions,
  saveSession as saveStoredSession,
  saveSessionMessages as saveStoredSessionMessages,
} from "@/shared/lib/chat-storage";

export type AIProvider =
  | "openai"
  | "anthropic"
  | "ollama"
  | "deepseek"
  | "kimi"
  | "gemini"
  | "custom"
  | "copilot";

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
  copilotAuth: {
    authenticated: boolean;
    clientId: string;
  };
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

  // Chat sessions backed by the file system.
  loadSessions: (rootPath: string) => Promise<void>;
  loadSessionMessages: (rootPath: string, sessionId: string) => Promise<void>;
  addChatSession: (session: ChatSession) => void;
  removeChatSession: (sessionId: string) => void;
  setActiveChatSession: (sessionId: string | null) => void;
  updateChatSessionMessages: (sessionId: string, messages: ChatMessage[]) => void;
  createChatSession: (rootPath: string) => Promise<ChatSession>;
  deleteSession: (rootPath: string, sessionId: string) => Promise<void>;
  saveSession: (rootPath: string, session: ChatSession) => Promise<void>;
  saveSessionMessages: (
    rootPath: string,
    sessionId: string,
    messages: ChatMessage[],
  ) => Promise<void>;

  addChatMessage: (sessionId: string, message: ChatMessage) => void;

  setApiKeyRef: (provider: AIProvider, ref: string | null) => void;
  storeApiKey: (provider: AIProvider, key: string) => Promise<void>;
  loadKeyStatus: (provider: AIProvider) => Promise<void>;
  deleteApiKey: (provider: AIProvider) => Promise<void>;

  // Copilot OAuth
  loadCopilotAuthStatus: () => Promise<void>;
  startCopilotDeviceLogin: (clientId: string) => Promise<{
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
  }>;
  pollCopilotDeviceLogin: (clientId: string, deviceCode: string) => Promise<boolean>;
  logoutCopilot: () => Promise<void>;
  setCopilotClientId: (clientId: string) => void;

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
  gemini: { baseUrl: "https://generativelanguage.googleapis.com", model: "gemini-2.0-flash" },
  custom: { baseUrl: "", model: "" },
  copilot: { model: "gpt-4o" },
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
    gemini: null,
    custom: null,
    copilot: null,
  },
  copilotAuth: {
    authenticated: false,
    clientId: "",
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

  loadSessions: async (rootPath) => {
    const sessions = await loadStoredSessions(rootPath);
    if (sessions.length === 0) {
      const session: ChatSession = {
        id: crypto.randomUUID(),
        title: "New Chat",
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await saveStoredSession(rootPath, session);
      set({ chatSessions: [session], activeChatSessionId: session.id });
      return;
    }

    const sorted = sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    const { activeChatSessionId } = get();
    const activeStillExists = activeChatSessionId
      ? sorted.some((s) => s.id === activeChatSessionId)
      : false;

    set({
      chatSessions: sorted,
      activeChatSessionId: activeStillExists ? activeChatSessionId : sorted[0].id,
    });
  },

  loadSessionMessages: async (rootPath, sessionId) => {
    const messages = await loadStoredSessionMessages(rootPath, sessionId);
    set({
      chatSessions: get().chatSessions.map((s) => (s.id === sessionId ? { ...s, messages } : s)),
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

  updateChatSessionMessages: (sessionId, messages) => {
    const { chatSessions } = get();
    set({
      chatSessions: chatSessions.map((s) => {
        if (s.id !== sessionId) return s;

        const firstUserMsg = messages.find((m) => m.role === "user");
        const title =
          s.title === "New Chat" && firstUserMsg
            ? firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? "…" : "")
            : s.title;

        return {
          ...s,
          title,
          messages,
          updatedAt: Date.now(),
        };
      }),
    });
  },

  createChatSession: async (rootPath) => {
    const session: ChatSession = {
      id: crypto.randomUUID(),
      title: "New Chat",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveStoredSession(rootPath, session);
    get().addChatSession(session);
    return session;
  },

  deleteSession: async (rootPath, sessionId) => {
    await deleteStoredSession(rootPath, sessionId);
    get().removeChatSession(sessionId);
  },

  saveSession: async (rootPath, session) => {
    await saveStoredSession(rootPath, session);
  },

  saveSessionMessages: async (rootPath, sessionId, messages) => {
    await saveStoredSessionMessages(rootPath, sessionId, messages);
  },

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

  // ─── Copilot OAuth Actions ────────────────────────────────────────────────

  loadCopilotAuthStatus: async () => {
    try {
      const status = await invoke<{ authenticated: boolean }>("copilot_auth_status");
      set({ copilotAuth: { ...get().copilotAuth, authenticated: status.authenticated } });
    } catch (e) {
      console.error("[Copilot Auth Status Error]", e);
    }
  },

  startCopilotDeviceLogin: async (clientId) => {
    const result = await invoke<{
      device_code: string;
      user_code: string;
      verification_uri: string;
      expires_in: number;
      interval: number;
    }>("copilot_start_device_login", { req: { client_id: clientId } });
    set({ copilotAuth: { ...get().copilotAuth, clientId } });
    return result;
  },

  pollCopilotDeviceLogin: async (clientId, deviceCode) => {
    const result = await invoke<{ authorized: boolean }>("copilot_poll_device_login", {
      req: { client_id: clientId, device_code: deviceCode },
    });
    if (result.authorized) {
      set({ copilotAuth: { ...get().copilotAuth, authenticated: true, clientId } });
    }
    return result.authorized;
  },

  logoutCopilot: async () => {
    await invoke("copilot_logout");
    set({ copilotAuth: { authenticated: false, clientId: get().copilotAuth.clientId } });
  },

  setCopilotClientId: (clientId) => {
    set({ copilotAuth: { ...get().copilotAuth, clientId } });
  },
}));
