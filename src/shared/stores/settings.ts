import { create, type StateCreator } from "zustand";
import { persist } from "zustand/middleware";
import type { Theme } from "@/theme/types";
import { crossWindowSync } from "./sync/crossWindowSync";
import {
  getDefaultShortcuts,
  getIsMac,
  type ShortcutActionId,
  type ShortcutBinding,
  type ShortcutMap,
} from "@/shared/lib/shortcuts";

export type AutoSave = "off" | "onFocusChange" | "afterDelay";

export interface EditorSettings {
  vimMode: boolean;
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  insertSpaces: boolean;
  wordWrap: boolean;
  lineNumbers: boolean;
  autoSave: AutoSave;
  autoSaveDelay: number;
  formatOnSave: boolean;
  stickyLines: boolean;
}

export interface TerminalSettings {
  shell: string;
  fontSize: number;
  fontFamily: string;
  aiSuggestions: boolean;
  scrollback: number;
}

export type AIProvider =
  | "openai"
  | "anthropic"
  | "ollama"
  | "deepseek"
  | "kimi"
  | "gemini"
  | "custom"
  | "copilot";

export interface ProviderSettings {
  model: string;
  baseUrl?: string;
}

export interface AISettings {
  defaultProvider: AIProvider;
  defaultModel: string;
  inlineCompletion: boolean;
  completionDebounce: number;
  terminalSuggestions: boolean;
  terminalSuggestionProvider: AIProvider | null;
  terminalSuggestionModel: string | null;
  providers: Record<AIProvider, ProviderSettings>;
}

export interface LayoutSettings {
  sidebarWidth: number;
  terminalHeight: string;
  chatPanelWidth: number;
}

export interface WorkspaceSettings {
  recentFolders: string[];
  recentFiles: string[];
}

export type StatusbarItem =
  | "vimMode"
  | "cursor"
  | "fileType"
  | "encoding"
  | "eol"
  | "gitBranch"
  | "gitSync"
  | "problems"
  | "aiProvider"
  | "theme";

export interface StatusbarSettings {
  visible: boolean;
  items: StatusbarItem[];
}

export type ThemeMode = "dark" | "light" | "system";

export interface GitSettings {
  userName: string;
  userEmail: string;
  defaultRemote: string;
  pullRebase: boolean;
  gpgSignKey: string;
  sshKeyPath: string;
  signOff: boolean;
  signOffText: string;
}

export interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  autostart: boolean;
}

export interface McpSettings {
  servers: McpServerConfig[];
}

export interface LspSettings {
  enabled: Record<string, boolean>;
}

export interface ExperimentalSettings {
  lsp: boolean;
  acp: boolean;
}

export interface SettingsState {
  editor: EditorSettings;
  terminal: TerminalSettings;
  ai: AISettings;
  theme: string;
  themeMode: ThemeMode;
  keymap: string;
  layout: LayoutSettings;
  workspace: WorkspaceSettings;
  statusbar: StatusbarSettings;
  git: GitSettings;
  mcp: McpSettings;
  lsp: LspSettings;
  experimental: ExperimentalSettings;
  mcpRunningServerIds: string[];
  customThemes: Record<string, Theme>;
  shortcuts: ShortcutMap;
}

interface SettingsActions {
  setEditorSettings: (settings: Partial<EditorSettings>) => void;
  setTerminalSettings: (settings: Partial<TerminalSettings>) => void;
  setAISettings: (settings: Partial<AISettings>) => void;
  setTheme: (theme: string) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setKeymap: (keymap: string) => void;
  setLayoutSettings: (settings: Partial<LayoutSettings>) => void;
  addRecentFolder: (path: string) => void;
  addRecentFile: (path: string) => void;
  clearRecentFolders: () => void;
  clearRecentFiles: () => void;
  setStatusbarSettings: (settings: Partial<StatusbarSettings>) => void;
  setGitSettings: (settings: Partial<GitSettings>) => void;
  setMcpSettings: (settings: Partial<McpSettings>) => void;
  setLspEnabled: (language: string, enabled: boolean) => void;
  setExperimentalEnabled: (feature: keyof ExperimentalSettings, enabled: boolean) => void;
  addMcpServer: (server: Omit<McpServerConfig, "id">) => void;
  updateMcpServer: (id: string, server: Partial<Omit<McpServerConfig, "id">>) => void;
  removeMcpServer: (id: string) => void;
  setMcpServerRunning: (id: string, running: boolean) => void;
  toggleMcpServerRunning: (id: string) => void;
  addCustomTheme: (theme: Theme) => void;
  deleteCustomTheme: (id: string) => void;
  importSettings: (partial: Partial<SettingsState>) => void;
  updateProvider: (provider: AIProvider, config: Partial<ProviderSettings>) => void;
  setShortcut: (actionId: ShortcutActionId, binding: ShortcutBinding | null) => void;
  resetShortcut: (actionId: ShortcutActionId) => void;
  resetAllShortcuts: () => void;
  resetToDefaults: () => void;
}

const STORAGE_KEY = "pragma.settings.v1";

const defaultSettings: SettingsState = {
  editor: {
    vimMode: false,
    fontSize: 14,
    fontFamily: "JetBrains Mono",
    tabSize: 2,
    insertSpaces: true,
    wordWrap: false,
    lineNumbers: true,
    autoSave: "onFocusChange",
    autoSaveDelay: 1000,
    formatOnSave: false,
    stickyLines: false,
  },
  terminal: {
    shell: "",
    fontSize: 13,
    fontFamily: "JetBrains Mono",
    aiSuggestions: true,
    scrollback: 10000,
  },
  ai: {
    defaultProvider: "anthropic",
    defaultModel: "claude-sonnet-4-6",
    inlineCompletion: true,
    completionDebounce: 500,
    terminalSuggestions: true,
    terminalSuggestionProvider: null,
    terminalSuggestionModel: null,
    providers: {
      openai: { model: "gpt-4o" },
      anthropic: { model: "claude-sonnet-4-6" },
      ollama: { baseUrl: "http://localhost:11434", model: "llama3.2" },
      deepseek: { baseUrl: "https://api.deepseek.com", model: "deepseek-chat" },
      kimi: { baseUrl: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k" },
      gemini: { baseUrl: "https://generativelanguage.googleapis.com", model: "gemini-2.0-flash" },
      custom: { baseUrl: "", model: "" },
      copilot: { model: "gpt-4o" },
    },
  },
  theme: "dark-default",
  themeMode: "dark",
  keymap: "default",
  layout: {
    sidebarWidth: 250,
    terminalHeight: "50%",
    chatPanelWidth: 380,
  },
  workspace: {
    recentFolders: [],
    recentFiles: [],
  },
  statusbar: {
    visible: true,
    items: [
      "vimMode",
      "cursor",
      "fileType",
      "encoding",
      "eol",
      "gitBranch",
      "gitSync",
      "problems",
      "aiProvider",
      "theme",
    ],
  },
  git: {
    userName: "",
    userEmail: "",
    defaultRemote: "origin",
    pullRebase: false,
    gpgSignKey: "",
    sshKeyPath: "",
    signOff: false,
    signOffText: "Signed-off-by: {name} <{email}>",
  },
  mcp: {
    servers: [],
  },
  lsp: {
    enabled: {
      typescript: true,
      javascript: true,
      rust: true,
      python: true,
      go: true,
      java: true,
      c: true,
      cpp: true,
      html: true,
      css: true,
    },
  },
  experimental: {
    lsp: true,
    acp: true,
  },
  mcpRunningServerIds: [],
  customThemes: {},
  shortcuts: getDefaultShortcuts(getIsMac()),
};

const settingsStoreCreator: StateCreator<SettingsState & SettingsActions> = crossWindowSync<
  SettingsState & SettingsActions
>("settings")((set) => ({
  ...defaultSettings,

  setEditorSettings: (settings) => set((state) => ({ editor: { ...state.editor, ...settings } })),

  setTerminalSettings: (settings) =>
    set((state) => ({ terminal: { ...state.terminal, ...settings } })),

  setAISettings: (settings) => set((state) => ({ ai: { ...state.ai, ...settings } })),

  setTheme: (theme) => set({ theme }),
  setThemeMode: (themeMode) => set({ themeMode }),
  setKeymap: (keymap) => set({ keymap }),

  setLayoutSettings: (settings) => set((state) => ({ layout: { ...state.layout, ...settings } })),

  addRecentFolder: (path) =>
    set((state) => ({
      workspace: {
        ...state.workspace,
        recentFolders: [path, ...state.workspace.recentFolders.filter((p) => p !== path)].slice(
          0,
          20,
        ),
      },
    })),

  addRecentFile: (path) =>
    set((state) => ({
      workspace: {
        ...state.workspace,
        recentFiles: [path, ...state.workspace.recentFiles.filter((p) => p !== path)].slice(0, 50),
      },
    })),

  clearRecentFolders: () =>
    set((state) => ({ workspace: { ...state.workspace, recentFolders: [] } })),

  clearRecentFiles: () => set((state) => ({ workspace: { ...state.workspace, recentFiles: [] } })),

  setStatusbarSettings: (settings) =>
    set((state) => ({ statusbar: { ...state.statusbar, ...settings } })),

  setGitSettings: (settings) => set((state) => ({ git: { ...state.git, ...settings } })),

  setMcpSettings: (settings) => set((state) => ({ mcp: { ...state.mcp, ...settings } })),

  setLspEnabled: (language, enabled) =>
    set((state) => ({
      lsp: {
        ...state.lsp,
        enabled: { ...state.lsp.enabled, [language]: enabled },
      },
    })),

  setExperimentalEnabled: (feature, enabled) =>
    set((state) => ({
      experimental: { ...state.experimental, [feature]: enabled },
    })),

  addMcpServer: (server) =>
    set((state) => ({
      mcp: {
        ...state.mcp,
        servers: [
          ...state.mcp.servers,
          { ...server, id: `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` },
        ],
      },
    })),

  updateMcpServer: (id, server) =>
    set((state) => ({
      mcp: {
        ...state.mcp,
        servers: state.mcp.servers.map((s) => (s.id === id ? { ...s, ...server } : s)),
      },
    })),

  removeMcpServer: (id) =>
    set((state) => ({
      mcp: {
        ...state.mcp,
        servers: state.mcp.servers.filter((s) => s.id !== id),
      },
      mcpRunningServerIds: state.mcpRunningServerIds.filter((runningId) => runningId !== id),
    })),

  setMcpServerRunning: (id, running) =>
    set((state) => ({
      mcpRunningServerIds: running
        ? [...state.mcpRunningServerIds, id]
        : state.mcpRunningServerIds.filter((runningId) => runningId !== id),
    })),

  toggleMcpServerRunning: (id) =>
    set((state) => {
      const running = state.mcpRunningServerIds.includes(id);
      return {
        mcpRunningServerIds: running
          ? state.mcpRunningServerIds.filter((runningId) => runningId !== id)
          : [...state.mcpRunningServerIds, id],
      };
    }),

  addCustomTheme: (theme) =>
    set((state) => ({
      customThemes: { ...state.customThemes, [theme.metadata.id]: theme },
    })),

  deleteCustomTheme: (id) =>
    set((state) => {
      const next = { ...state.customThemes };
      delete next[id];
      return { customThemes: next };
    }),

  importSettings: (partial) =>
    set((state) => ({
      ...state,
      editor: { ...state.editor, ...partial.editor },
      terminal: { ...state.terminal, ...partial.terminal },
      ai: { ...state.ai, ...partial.ai },
      theme: partial.theme ?? state.theme,
      themeMode: partial.themeMode ?? state.themeMode,
      keymap: partial.keymap ?? state.keymap,
      layout: { ...state.layout, ...partial.layout },
      workspace: { ...state.workspace, ...partial.workspace },
      statusbar: { ...state.statusbar, ...partial.statusbar },
      git: { ...state.git, ...partial.git },
      mcp: { ...state.mcp, ...partial.mcp },
      lsp: { ...state.lsp, ...partial.lsp },
      experimental: { ...state.experimental, ...partial.experimental },
      mcpRunningServerIds: partial.mcpRunningServerIds ?? state.mcpRunningServerIds,
      customThemes: { ...state.customThemes, ...partial.customThemes },
      shortcuts: { ...state.shortcuts, ...partial.shortcuts },
    })),

  updateProvider: (provider, config) =>
    set((state) => ({
      ai: {
        ...state.ai,
        providers: {
          ...state.ai.providers,
          [provider]: { ...state.ai.providers[provider], ...config },
        },
      },
    })),

  setShortcut: (actionId, binding) =>
    set((state) => ({
      shortcuts: { ...state.shortcuts, [actionId]: binding },
    })),

  resetShortcut: (actionId) =>
    set((state) => ({
      shortcuts: {
        ...state.shortcuts,
        [actionId]: getDefaultShortcuts(getIsMac())[actionId],
      },
    })),

  resetAllShortcuts: () =>
    set({
      shortcuts: getDefaultShortcuts(getIsMac()),
    }),

  resetToDefaults: () => set({ ...defaultSettings }),
}));

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(settingsStoreCreator, {
    name: STORAGE_KEY,
    partialize: (state) => ({
      ...state,
      // Running state is session-only and should not survive app restarts.
      mcpRunningServerIds: [],
    }),
  }),
);
