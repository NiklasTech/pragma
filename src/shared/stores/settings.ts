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
  fontId: string;
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
  fontId: string;
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
  | "openrouter"
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
  yoloMode: boolean;
  showThinking: boolean;
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
  favoriteFolders: string[];
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
  mcp: McpSettings;
  lsp: LspSettings;
  experimental: ExperimentalSettings;
  mcpRunningServerIds: string[];
  customThemes: Record<string, Theme>;
  shortcuts: ShortcutMap;
}

export interface FontSelection {
  fontId: string;
  fontFamily: string;
}

interface SettingsActions {
  setEditorSettings: (settings: Partial<EditorSettings>) => void;
  setTerminalSettings: (settings: Partial<TerminalSettings>) => void;
  setEditorFont: (selection: FontSelection) => void;
  setTerminalFont: (selection: FontSelection) => void;
  setAISettings: (settings: Partial<AISettings>) => void;
  setYoloMode: (enabled: boolean) => void;
  setShowThinking: (enabled: boolean) => void;
  setTheme: (theme: string) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setKeymap: (keymap: string) => void;
  setLayoutSettings: (settings: Partial<LayoutSettings>) => void;
  addRecentFolder: (path: string) => void;
  addRecentFile: (path: string) => void;
  addFavoriteFolder: (path: string) => void;
  removeFavoriteFolder: (path: string) => void;
  clearRecentFolders: () => void;
  clearRecentFiles: () => void;
  setStatusbarSettings: (settings: Partial<StatusbarSettings>) => void;
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
    fontId: "",
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
    fontId: "",
    aiSuggestions: true,
    scrollback: 10000,
  },
  ai: {
    defaultProvider: "anthropic",
    defaultModel: "",
    inlineCompletion: true,
    completionDebounce: 500,
    terminalSuggestions: true,
    terminalSuggestionProvider: null,
    terminalSuggestionModel: null,
    yoloMode: false,
    showThinking: true,
    providers: {
      openai: { model: "" },
      anthropic: { model: "" },
      ollama: { baseUrl: "http://localhost:11434", model: "" },
      deepseek: { baseUrl: "https://api.deepseek.com", model: "" },
      kimi: { baseUrl: "https://api.kimi.com/coding/v1", model: "" },
      gemini: { baseUrl: "https://generativelanguage.googleapis.com", model: "" },
      openrouter: { baseUrl: "https://openrouter.ai/api/v1", model: "" },
      custom: { baseUrl: "", model: "" },
      copilot: { model: "" },
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
    favoriteFolders: [],
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

  setEditorFont: ({ fontId, fontFamily }) =>
    set((state) => ({ editor: { ...state.editor, fontId, fontFamily } })),

  setTerminalFont: ({ fontId, fontFamily }) =>
    set((state) => ({ terminal: { ...state.terminal, fontId, fontFamily } })),

  setAISettings: (settings) => set((state) => ({ ai: { ...state.ai, ...settings } })),

  setYoloMode: (enabled) =>
    set((state) => ({
      ai: { ...state.ai, yoloMode: enabled },
    })),

  setShowThinking: (enabled) =>
    set((state) => ({
      ai: { ...state.ai, showThinking: enabled },
    })),

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

  addFavoriteFolder: (path) =>
    set((state) => ({
      workspace: {
        ...state.workspace,
        favoriteFolders: [path, ...state.workspace.favoriteFolders.filter((p) => p !== path)].slice(
          0,
          50,
        ),
      },
    })),

  removeFavoriteFolder: (path) =>
    set((state) => ({
      workspace: {
        ...state.workspace,
        favoriteFolders: state.workspace.favoriteFolders.filter((p) => p !== path),
      },
    })),

  clearRecentFolders: () =>
    set((state) => ({ workspace: { ...state.workspace, recentFolders: [] } })),

  clearRecentFiles: () => set((state) => ({ workspace: { ...state.workspace, recentFiles: [] } })),

  setStatusbarSettings: (settings) =>
    set((state) => ({ statusbar: { ...state.statusbar, ...settings } })),

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
      editor: mergePartial(defaultSettings.editor, partial.editor),
      terminal: mergePartial(defaultSettings.terminal, partial.terminal),
      ai: mergePartial(defaultSettings.ai, partial.ai),
      theme: partial.theme ?? state.theme,
      themeMode: partial.themeMode ?? state.themeMode,
      keymap: partial.keymap ?? state.keymap,
      layout: mergePartial(defaultSettings.layout, partial.layout),
      workspace: mergePartial(defaultSettings.workspace, partial.workspace),
      statusbar: mergePartial(defaultSettings.statusbar, partial.statusbar),
      mcp: mergePartial(defaultSettings.mcp, partial.mcp),
      lsp: mergePartial(defaultSettings.lsp, partial.lsp),
      experimental: mergePartial(defaultSettings.experimental, partial.experimental),
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

function mergePartial<T extends object>(defaults: T, partial?: Partial<T> | null): T {
  if (!partial || typeof partial !== "object") {
    return { ...defaults };
  }

  const result = { ...defaults };
  for (const [key, value] of Object.entries(partial)) {
    const defaultValue = result[key as keyof T];
    if (Array.isArray(value)) {
      result[key as keyof T] = value as T[keyof T];
    } else if (
      value &&
      typeof value === "object" &&
      defaultValue &&
      typeof defaultValue === "object" &&
      !Array.isArray(defaultValue)
    ) {
      result[key as keyof T] = mergePartial(
        defaultValue as Record<string, unknown>,
        value as Record<string, unknown>,
      ) as T[keyof T];
    } else {
      result[key as keyof T] = value as T[keyof T];
    }
  }
  return result;
}

const OLD_MOONSHOT_MODELS = new Set(["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"]);

function migrateAISettings(ai: Partial<AISettings> | undefined): Partial<AISettings> | undefined {
  if (!ai || !ai.providers) return ai;

  const providers = { ...ai.providers };
  const kimi = providers.kimi;
  let defaultModel = ai.defaultModel;

  if (
    kimi &&
    (OLD_MOONSHOT_MODELS.has(kimi.model ?? "") || kimi.baseUrl === "https://api.moonshot.cn/v1")
  ) {
    providers.kimi = {
      ...kimi,
      baseUrl: "https://api.kimi.com/coding/v1",
      model: "",
    };
  }

  if (ai.defaultProvider === "kimi" && OLD_MOONSHOT_MODELS.has(defaultModel ?? "")) {
    defaultModel = "";
  }

  const updated: Partial<AISettings> = { ...ai, providers };
  if (defaultModel !== ai.defaultModel) {
    updated.defaultModel = defaultModel;
  }
  return updated;
}

function mergeWithDefaults(
  persisted: unknown,
  defaults: SettingsState & SettingsActions,
): SettingsState & SettingsActions {
  if (!persisted || typeof persisted !== "object") {
    return { ...defaults };
  }

  const partial = persisted as Partial<SettingsState> & Record<string, unknown>;

  // Drop legacy persisted keys that have been removed from the settings schema.
  const { git: _, ...restPartial } = partial;

  const migratedAi = migrateAISettings(partial.ai);

  return {
    ...defaults,
    ...restPartial,
    editor: mergePartial(defaults.editor, partial.editor),
    terminal: mergePartial(defaults.terminal, partial.terminal),
    ai: mergePartial(defaults.ai, migratedAi),
    layout: mergePartial(defaults.layout, partial.layout),
    workspace: mergePartial(defaults.workspace, partial.workspace),
    statusbar: mergePartial(defaults.statusbar, partial.statusbar),
    mcp: mergePartial(defaults.mcp, partial.mcp),
    lsp: mergePartial(defaults.lsp, partial.lsp),
    experimental: mergePartial(defaults.experimental, partial.experimental),
    customThemes: { ...defaults.customThemes, ...partial.customThemes },
    shortcuts: { ...defaults.shortcuts, ...partial.shortcuts },
  };
}

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(settingsStoreCreator, {
    name: STORAGE_KEY,
    merge: (persisted, current) => mergeWithDefaults(persisted, current),
    partialize: (state) => ({
      ...state,
      // Running state is session-only and should not survive app restarts.
      mcpRunningServerIds: [],
    }),
  }),
);
