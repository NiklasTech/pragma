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
  | "openrouter"
  | "custom"
  | "copilot";

export interface ProviderConfig {
  model: string;
  baseUrl?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  context_window?: number;
  supports_streaming: boolean;
  supports_vision: boolean;
}

export interface ModelListCache {
  models: ModelInfo[];
  fetchedAt: number;
  error?: string | null;
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
  availableModels: Partial<Record<AIProvider, ModelListCache>>;
  modelsLoading: Partial<Record<AIProvider, boolean>>;

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
  generateChatTitle: (
    sessionId: string,
    provider: AIProvider,
    model: string,
    baseUrl: string | undefined,
    firstMessage: string,
  ) => Promise<void>;
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
  loadAvailableModels: (provider: AIProvider, force?: boolean) => Promise<void>;
  clearAvailableModels: (provider: AIProvider) => void;

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
  openai: { model: "" },
  anthropic: { model: "" },
  ollama: { baseUrl: "http://localhost:11434", model: "" },
  deepseek: { baseUrl: "https://api.deepseek.com", model: "" },
  kimi: { baseUrl: "https://api.kimi.com/coding/v1", model: "" },
  gemini: { baseUrl: "https://generativelanguage.googleapis.com", model: "" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", model: "" },
  custom: { baseUrl: "", model: "" },
  copilot: { model: "" },
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

        return {
          ...s,
          messages,
          updatedAt: Date.now(),
        };
      }),
    });
  },

  generateChatTitle: async (sessionId, provider, model, baseUrl, firstMessage) => {
    if (!firstMessage.trim()) return;
    const session = get().chatSessions.find((s) => s.id === sessionId);
    if (!session || session.title !== "New Chat") return;

    try {
      const result = await invoke<{ title: string }>("ai_generate_chat_title", {
        req: {
          provider,
          model,
          base_url: baseUrl,
          message: firstMessage,
        },
      });

      const title = result.title?.trim() || "New Chat";
      if (title === "New Chat" || title === session.title) return;

      set({
        chatSessions: get().chatSessions.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                title,
                updatedAt: Date.now(),
              }
            : s,
        ),
      });
    } catch {
      // Ignore title-generation failures; the UI can fall back to "New Chat".
    }
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
    } catch {}
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
    } catch {}
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
