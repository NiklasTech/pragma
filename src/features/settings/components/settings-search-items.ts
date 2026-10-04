import type { Category } from "./settings-categories";

interface SearchItem {
  id: string;
  label: string;
  keywords: string;
  category: Category;
}

export const SEARCH_ITEMS: SearchItem[] = [
  {
    id: "editor-vim",
    label: "Vim Mode",
    keywords: "vim keybindings editor modal",
    category: "editor",
  },
  {
    id: "editor-font-size",
    label: "Editor Font Size",
    keywords: "font size editor text",
    category: "editor",
  },
  {
    id: "editor-font-family",
    label: "Editor Font Family",
    keywords: "font family editor mono",
    category: "editor",
  },
  {
    id: "editor-tab-size",
    label: "Tab Size",
    keywords: "tab indentation editor",
    category: "editor",
  },
  {
    id: "editor-insert-spaces",
    label: "Insert Spaces",
    keywords: "spaces tabs indentation",
    category: "editor",
  },
  { id: "editor-word-wrap", label: "Word Wrap", keywords: "wrap line editor", category: "editor" },
  {
    id: "editor-line-numbers",
    label: "Line Numbers",
    keywords: "line numbers gutter editor",
    category: "editor",
  },
  { id: "editor-auto-save", label: "Auto Save", keywords: "auto save editor", category: "editor" },
  {
    id: "editor-format-on-save",
    label: "Format on Save",
    keywords: "format save editor",
    category: "editor",
  },
  {
    id: "editor-sticky-lines",
    label: "Sticky Lines",
    keywords: "sticky lines context editor",
    category: "editor",
  },
  {
    id: "terminal-shell",
    label: "Terminal Shell",
    keywords: "shell zsh bash terminal",
    category: "terminal",
  },
  {
    id: "terminal-font-size",
    label: "Terminal Font Size",
    keywords: "font size terminal",
    category: "terminal",
  },
  {
    id: "terminal-font-family",
    label: "Terminal Font Family",
    keywords: "font family terminal mono",
    category: "terminal",
  },
  {
    id: "terminal-ai-suggestions",
    label: "Terminal AI Suggestions",
    keywords: "ai suggestions terminal command",
    category: "terminal",
  },
  {
    id: "terminal-scrollback",
    label: "Terminal Scrollback",
    keywords: "scrollback buffer terminal history",
    category: "terminal",
  },
  {
    id: "ai-provider",
    label: "AI Provider",
    keywords: "ai provider model openai anthropic ollama",
    category: "agents",
  },
  {
    id: "ai-inline-completion",
    label: "Inline Completion",
    keywords: "inline completion ghost text ai",
    category: "agents",
  },
  {
    id: "ai-debounce",
    label: "Completion Debounce",
    keywords: "debounce ai completion delay",
    category: "agents",
  },
  {
    id: "agent-mode",
    label: "Approvals",
    keywords: "agent auto approve allowed commands step limit",
    category: "agents",
  },
  {
    id: "agent-notifications",
    label: "Notifications",
    keywords: "notifications notify badge dock taskbar session finished failed approval status",
    category: "agents",
  },
  {
    id: "voice-input",
    label: "Voice Input",
    keywords: "voice dictation dictate microphone speech whisper parakeet push to talk hold",
    category: "voice",
  },
  {
    id: "theme-mode",
    label: "Theme Mode",
    keywords: "theme dark light system mode",
    category: "theme",
  },
  {
    id: "theme-select",
    label: "Theme",
    keywords: "theme color scheme appearance",
    category: "theme",
  },
  {
    id: "mcp-servers",
    label: "MCP Servers",
    keywords: "mcp servers model context protocol",
    category: "mcp",
  },
  {
    id: "lsp-servers",
    label: "Language Servers",
    keywords: "lsp language server typescript rust python go java c cpp html css",
    category: "languages",
  },
  {
    id: "layout-reset",
    label: "Reset Panel Sizes",
    keywords: "layout reset panels size",
    category: "layout",
  },
  {
    id: "statusbar-items",
    label: "Statusbar Items",
    keywords: "statusbar items layout",
    category: "layout",
  },
  {
    id: "keyboard-shortcuts",
    label: "Keyboard Shortcuts",
    keywords: "keyboard shortcuts keymap hotkey bindings",
    category: "keyboard",
  },
  {
    id: "about-version",
    label: "Version",
    keywords: "about version update release pragma",
    category: "about",
  },
  {
    id: "about-license",
    label: "License",
    keywords: "about license legal copyright apache",
    category: "about",
  },
];
