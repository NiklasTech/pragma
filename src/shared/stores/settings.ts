import { create } from "zustand";

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

export type ThemeMode = "dark" | "light" | "system";

export interface SettingsState {
  editor: EditorSettings;
  terminal: TerminalSettings;
  ai: AISettings;
  theme: string;
  themeMode: ThemeMode;
  keymap: string;
  layout: LayoutSettings;
}

interface SettingsActions {
  setEditorSettings: (settings: Partial<EditorSettings>) => void;
  setTerminalSettings: (settings: Partial<TerminalSettings>) => void;
  setAISettings: (settings: Partial<AISettings>) => void;
  setTheme: (theme: string) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setKeymap: (keymap: string) => void;
  setLayoutSettings: (settings: Partial<LayoutSettings>) => void;
  updateProvider: (provider: AIProvider, config: Partial<ProviderSettings>) => void;
  resetToDefaults: () => void;
}

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
    shell: "/bin/zsh",
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
  theme: "warm-graphite",
  themeMode: "dark",
  keymap: "default",
  layout: {
    sidebarWidth: 250,
    terminalHeight: "50%",
    chatPanelWidth: 380,
  },
};

export const useSettingsStore = create<SettingsState & SettingsActions>((set) => ({
  ...defaultSettings,

  setEditorSettings: (settings) => set((state) => ({ editor: { ...state.editor, ...settings } })),

  setTerminalSettings: (settings) =>
    set((state) => ({ terminal: { ...state.terminal, ...settings } })),

  setAISettings: (settings) => set((state) => ({ ai: { ...state.ai, ...settings } })),

  setTheme: (theme) => set({ theme }),
  setThemeMode: (themeMode) => set({ themeMode }),
  setKeymap: (keymap) => set({ keymap }),

  setLayoutSettings: (settings) => set((state) => ({ layout: { ...state.layout, ...settings } })),

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

  resetToDefaults: () => set({ ...defaultSettings }),
}));
