import type { Theme } from "@/theme/types";
import type { ShortcutActionId, ShortcutBinding, ShortcutMap } from "@/shared/lib/shortcuts";

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
  inlayHints: boolean;
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
  | "copilot"
  | "grok"
  | "cursor"
  | "opencode"
  | "hermes";

export interface ProviderSettings {
  model: string;
  baseUrl?: string;
}

export type VoiceEngine = "web-speech" | "whisper";

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
  showUnavailableProviders: boolean;
  voiceInput: boolean;
  voiceEngine: VoiceEngine;
  providers: Record<AIProvider, ProviderSettings>;
  /** Internal marker for one-time default migrations. */
  migrationRevision?: number;
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

export type AgentAutoApprove = "never" | "edits" | "all";

export interface AgentSettings {
  enabled: boolean;
  autoApprove: AgentAutoApprove;
  allowedCommands: string[];
  useProjectRules: boolean;
  stepLimit: number | null;
}

export interface ExtensionSettings {
  enabled: boolean;
  settings: unknown;
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
  agent: AgentSettings;
  customThemes: Record<string, Theme>;
  extensions: Record<string, ExtensionSettings>;
  shortcuts: ShortcutMap;
}

export interface FontSelection {
  fontId: string;
  fontFamily: string;
}

export interface SettingsActions {
  setEditorSettings: (settings: Partial<EditorSettings>) => void;
  setTerminalSettings: (settings: Partial<TerminalSettings>) => void;
  setAISettings: (settings: Partial<AISettings>) => void;
  setYoloMode: (enabled: boolean) => void;
  setShowThinking: (enabled: boolean) => void;
  setShowUnavailableProviders: (enabled: boolean) => void;
  setTheme: (theme: string) => void;
  setThemeMode: (mode: ThemeMode) => void;
  addRecentFolder: (path: string) => void;
  addRecentFile: (path: string) => void;
  addFavoriteFolder: (path: string) => void;
  removeFavoriteFolder: (path: string) => void;
  setStatusbarSettings: (settings: Partial<StatusbarSettings>) => void;
  setMcpSettings: (settings: Partial<McpSettings>) => void;
  setLspEnabled: (language: string, enabled: boolean) => void;
  setExperimentalEnabled: (feature: keyof ExperimentalSettings, enabled: boolean) => void;
  setAgentSettings: (settings: Partial<AgentSettings>) => void;
  addMcpServer: (server: Omit<McpServerConfig, "id">) => void;
  updateMcpServer: (id: string, server: Partial<Omit<McpServerConfig, "id">>) => void;
  removeMcpServer: (id: string) => void;
  addCustomTheme: (theme: Theme) => void;
  deleteCustomTheme: (id: string) => void;
  setExtensionEnabled: (id: string, enabled: boolean) => void;
  setExtensionSettings: (id: string, settings: unknown) => void;
  importSettings: (partial: Partial<SettingsState>) => void;
  updateProvider: (provider: AIProvider, config: Partial<ProviderSettings>) => void;
  setShortcut: (actionId: ShortcutActionId, binding: ShortcutBinding | null) => void;
  resetShortcut: (actionId: ShortcutActionId) => void;
  resetAllShortcuts: () => void;
  resetToDefaults: () => void;
}
