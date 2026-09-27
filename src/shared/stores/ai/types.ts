import type { StateCreator } from "zustand";

export type AIProvider =
  | "openai"
  | "anthropic"
  | "ollama"
  | "deepseek"
  | "kimi"
  | "gemini"
  | "openrouter"
  | "custom"
  | "copilot"
  | "grok"
  | "cursor"
  | "opencode"
  | "hermes";

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

export interface SessionWorktree {
  branch: string;
  path: string;
  setupLog: string;
  status: "ready" | "error";
}

export type AgentEngineKind = "builtin" | "cli";

export interface AgentEngine {
  kind: AgentEngineKind;
  provider?: AIProvider;
  model?: string;
  baseUrl?: string;
  cliProviderId?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  kind?: "ask" | "agent" | "terminal";
  environment?: "checkout" | "worktree";
  worktree?: SessionWorktree | null;
  cliProviderId?: string;
  agentId?: string;
  archived?: boolean;
  agentEngine?: AgentEngine;
  parentId?: string;
}

export interface CreateChatSessionInit {
  id?: string;
  title?: string;
  kind?: ChatSession["kind"];
  environment?: ChatSession["environment"];
  worktree?: ChatSession["worktree"];
  cliProviderId?: string;
  agentId?: string;
  agentEngine?: AgentEngine;
  parentId?: string;
}

// ─── CLI Types ───────────────────────────────────────────────────────────────

export interface CLIManifest {
  id: string;
  name: string;
  description: string;
  install_cmd: string;
  command: string;
  supports_sessions: boolean;
  uses_acp: boolean;
  offers_terminal: boolean;
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

export interface AIState {
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

export interface AIActions {
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
    rootPath: string,
    sessionId: string,
    firstMessage: string,
    model: { provider: AIProvider; model: string; baseUrl: string | undefined } | null,
  ) => Promise<void>;
  createChatSession: (
    rootPath: string,
    init?: CreateChatSessionInit,
    options?: { activate?: boolean },
  ) => Promise<ChatSession>;
  renameChatSession: (rootPath: string, sessionId: string, title: string) => Promise<void>;
  deleteSession: (rootPath: string, sessionId: string) => Promise<void>;
  saveSession: (rootPath: string, session: ChatSession) => Promise<void>;
  updateChatSession: (rootPath: string, session: ChatSession) => Promise<void>;
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

export type AIStore = AIState & AIActions;

export type AISlice<T> = StateCreator<AIStore, [], [], T>;
