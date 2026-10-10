import type { Theme } from "@/theme/types";
import type { ShortcutActionId, ShortcutBinding, ShortcutMap } from "@/shared/lib/shortcuts";

export type AutoSave = "off" | "onFocusChange" | "afterDelay";

export type RenderWhitespace = "none" | "boundary" | "all";

export type EditorCursorStyle = "line" | "block" | "underline";

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
  renderWhitespace: RenderWhitespace;
  rulers: number[];
  indentGuides: boolean;
  bracketPairColorization: boolean;
  cursorStyle: EditorCursorStyle;
  cursorBlinking: boolean;
  lineHeight: number;
  fontLigatures: boolean;
  trimTrailingWhitespace: boolean;
  insertFinalNewline: boolean;
  overviewMarkers: boolean;
}

export type TerminalCursorStyle = "block" | "underline" | "bar";

export interface TerminalEnvVar {
  key: string;
  value: string;
}

export interface TerminalSettings {
  shell: string;
  fontSize: number;
  fontFamily: string;
  fontId: string;
  aiSuggestions: boolean;
  scrollback: number;
  cursorStyle: TerminalCursorStyle;
  cursorBlink: boolean;
  copyOnSelect: boolean;
  lineHeight: number;
  /** Workspace root path -> environment variables for shells started in that workspace. */
  envByWorkspace: Record<string, TerminalEnvVar[]>;
  restoreScrollback: boolean;
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

export type VoiceEngine = "web-speech" | "whisper" | "parakeet";

export type ParakeetModel = "parakeet-v3" | "parakeet-v3-compact";

export type WhisperModel = "large-v3-turbo-q5_0";

export interface AISettings {
  defaultProvider: AIProvider;
  defaultModel: string;
  /** Coding CLI the chat runs on, restored on startup. */
  cliProvider: string | null;
  inlineCompletion: boolean;
  completionDebounce: number;
  /** Suggest the next edit elsewhere in the file after a change. */
  nextEditPrediction: boolean;
  terminalSuggestions: boolean;
  terminalSuggestionProvider: AIProvider | null;
  terminalSuggestionModel: string | null;
  yoloMode: boolean;
  showThinking: boolean;
  showUnavailableProviders: boolean;
  voiceInput: boolean;
  voiceEngine: VoiceEngine;
  parakeetModel: ParakeetModel;
  whisperModel: WhisperModel;
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
  | "subscriptionUsage"
  | "theme";

export interface StatusbarSettings {
  visible: boolean;
  items: StatusbarItem[];
  /** Internal marker for one-time migrations. */
  migrationRevision?: number;
}

export type ThemeMode = "dark" | "light" | "system";

export type McpTransport = "stdio" | "http";

export interface McpServerConfig {
  id: string;
  name: string;
  /** Missing in configs written before remote servers; means stdio. */
  transport?: McpTransport;
  command: string;
  args: string[];
  env: Record<string, string>;
  /** Env names whose values live in the OS keychain, never in `env`. */
  secretEnv: string[];
  /** Streamable HTTP endpoint of a remote server. */
  url?: string;
  headers?: Record<string, string>;
  /** Header names whose values live in the OS keychain, never in `headers`. */
  secretHeaders?: string[];
  autostart: boolean;
}

export interface McpSettings {
  servers: McpServerConfig[];
  /** Internal marker for one-time migrations. */
  migrationRevision?: number;
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

export interface NotificationSettings {
  sessionFinished: boolean;
  sessionFailed: boolean;
  approvalNeeded: boolean;
  badge: boolean;
  statusSummary: boolean;
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
  notifications: NotificationSettings;
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
  setNotificationSettings: (settings: Partial<NotificationSettings>) => void;
  addMcpServer: (server: Omit<McpServerConfig, "id">) => string;
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
