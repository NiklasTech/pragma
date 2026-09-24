import { create, type StateCreator } from "zustand";
import { persist } from "zustand/middleware";
import { crossWindowSync } from "./sync/crossWindowSync";
import { getDefaultShortcuts, getIsMac } from "@/shared/lib/shortcuts";
import { defaultSettings } from "./settings/defaults";
import { mergePartial, mergeWithDefaults } from "./settings/migrations";
import type { SettingsActions, SettingsState } from "./settings/types";

export type {
  AgentAutoApprove,
  AgentSettings,
  AIProvider,
  AISettings,
  AutoSave,
  EditorSettings,
  ExperimentalSettings,
  ExtensionSettings,
  FontSelection,
  LayoutSettings,
  LspSettings,
  McpServerConfig,
  McpSettings,
  ProviderSettings,
  SettingsState,
  StatusbarItem,
  StatusbarSettings,
  TerminalSettings,
  ThemeMode,
  VoiceEngine,
  WorkspaceSettings,
} from "./settings/types";

export { migrateAISettings } from "./settings/migrations";

const settingsStoreCreator: StateCreator<SettingsState & SettingsActions> = crossWindowSync<
  SettingsState & SettingsActions
>("settings")((set) => ({
  ...defaultSettings,

  setEditorSettings: (settings) => set((state) => ({ editor: { ...state.editor, ...settings } })),

  setTerminalSettings: (settings) =>
    set((state) => ({ terminal: { ...state.terminal, ...settings } })),

  setAISettings: (settings) => set((state) => ({ ai: { ...state.ai, ...settings } })),

  setYoloMode: (enabled) =>
    set((state) => ({
      ai: { ...state.ai, yoloMode: enabled },
    })),

  setShowThinking: (enabled) =>
    set((state) => ({
      ai: { ...state.ai, showThinking: enabled },
    })),

  setShowUnavailableProviders: (enabled) =>
    set((state) => ({
      ai: { ...state.ai, showUnavailableProviders: enabled },
    })),

  setTheme: (theme) => set({ theme }),
  setThemeMode: (themeMode) => set({ themeMode }),

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

  setAgentSettings: (settings) => set((state) => ({ agent: { ...state.agent, ...settings } })),

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
    })),

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

  setExtensionEnabled: (id, enabled) =>
    set((state) => ({
      extensions: {
        ...state.extensions,
        [id]: { enabled, settings: state.extensions[id]?.settings },
      },
    })),

  setExtensionSettings: (id, settings) =>
    set((state) => ({
      extensions: {
        ...state.extensions,
        [id]: { enabled: state.extensions[id]?.enabled ?? true, settings },
      },
    })),

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
      agent: mergePartial(defaultSettings.agent, partial.agent),
      customThemes: { ...state.customThemes, ...partial.customThemes },
      extensions: { ...state.extensions, ...partial.extensions },
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

const STORAGE_KEY = "pragma.settings.v1";

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(settingsStoreCreator, {
    name: STORAGE_KEY,
    merge: (persisted, current) => mergeWithDefaults(persisted, current),
  }),
);
