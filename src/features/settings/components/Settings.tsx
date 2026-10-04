"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";
import { useSettingsStore } from "@/shared/stores/settings";
import { Input } from "@/shared/components/ui/input";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/components/ui/alert-dialog";
import type { Icon } from "@phosphor-icons/react";
import {
  Code,
  Terminal,
  Robot,
  Palette,
  PlugsConnected,
  Layout,
  Keyboard,
  Info,
  MagnifyingGlass,
  ArrowCounterClockwise,
  DownloadSimple,
  UploadSimple,
  BracketsAngle,
  Check,
  PuzzlePiece,
  Microphone,
} from "@phosphor-icons/react";
import { AISettings } from "./AISettings";
import { AgentSettings } from "./AgentSettings";
import { NotificationSettings } from "./NotificationSettings";
import { EditorSettings } from "./EditorSettings";
import { TerminalSettings } from "./TerminalSettings";
import { ThemeSettings } from "./ThemeSettings";
import { McpSettings } from "./McpSettings";
import { LayoutSettings } from "./LayoutSettings";
import { KeyboardSettings } from "./KeyboardSettings";
import { AboutSettings } from "./AboutSettings";
import { ExtensionSettings } from "./ExtensionSettings";
import { LspSettings } from "./LspSettings";
import { VoiceSettings } from "./VoiceSettings";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { exportSettings, importSettings } from "./settings-io";

type Category =
  | "editor"
  | "terminal"
  | "agents"
  | "voice"
  | "theme"
  | "mcp"
  | "layout"
  | "keyboard"
  | "languages"
  | "extensions"
  | "about";

interface CategoryDef {
  id: Category;
  label: string;
  icon: Icon;
  group: string;
  description: string;
}

const CATEGORIES: CategoryDef[] = [
  {
    id: "editor",
    label: "Editor",
    icon: Code,
    group: "Workspace",
    description: "Typing, formatting and how code is displayed.",
  },
  {
    id: "terminal",
    label: "Terminal",
    icon: Terminal,
    group: "Workspace",
    description: "Shell, fonts and suggestions in the integrated terminal.",
  },
  {
    id: "layout",
    label: "Layout",
    icon: Layout,
    group: "Workspace",
    description: "Sidebar, panels and what the status bar shows.",
  },
  {
    id: "keyboard",
    label: "Keyboard",
    icon: Keyboard,
    group: "Workspace",
    description: "Every shortcut in one place. Click a binding to change it.",
  },
  {
    id: "agents",
    label: "Agents",
    icon: Robot,
    group: "Intelligence",
    description: "AI providers, models and how agents ask before they act.",
  },
  {
    id: "voice",
    label: "Voice",
    icon: Microphone,
    group: "Intelligence",
    description: "Dictate into the chat by click or by holding a shortcut.",
  },
  {
    id: "mcp",
    label: "MCP",
    icon: PlugsConnected,
    group: "Intelligence",
    description: "Connect Model Context Protocol servers as extra tools.",
  },
  {
    id: "languages",
    label: "Languages",
    icon: BracketsAngle,
    group: "Intelligence",
    description: "Language servers for completion, diagnostics and navigation.",
  },
  {
    id: "theme",
    label: "Theme",
    icon: Palette,
    group: "Appearance",
    description: "Colors, light and dark mode and your own themes.",
  },
  {
    id: "extensions",
    label: "Extensions",
    icon: PuzzlePiece,
    group: "More",
    description: "Install and manage Pragma extensions.",
  },
  {
    id: "about",
    label: "About",
    icon: Info,
    group: "More",
    description: "Version, updates and open source licenses.",
  },
];

const CATEGORY_GROUPS = Array.from(new Set(CATEGORIES.map((category) => category.group)));

interface SearchItem {
  id: string;
  label: string;
  keywords: string;
  category: Category;
}

const SEARCH_ITEMS: SearchItem[] = [
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

export function Settings() {
  const [activeCategory, setActiveCategory] = React.useState<Category>("editor");
  const [query, setQuery] = React.useState("");
  const [saveIndicator, setSaveIndicator] = React.useState<"idle" | "saved">("idle");
  const resetToDefaults = useSettingsStore((s) => s.resetToDefaults);

  const filteredItems = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return SEARCH_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(normalized) ||
        item.keywords.toLowerCase().includes(normalized),
    );
  }, [query]);

  const handleSelectCategory = (category: Category) => {
    setActiveCategory(category);
    setQuery("");
  };

  const handleExport = async () => {
    try {
      await exportSettings();
    } catch {}
  };

  const handleImport = async () => {
    try {
      await importSettings();
    } catch {}
  };

  const activeCategoryDef = CATEGORIES.find((c) => c.id === activeCategory);
  const activeLabel = activeCategoryDef?.label ?? "Settings";

  React.useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const unsub = useSettingsStore.subscribe(() => {
      setSaveIndicator("saved");
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => setSaveIndicator("idle"), 1500);
    });
    return () => {
      unsub();
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setSaveIndicator("saved");
        const timeout = setTimeout(() => setSaveIndicator("idle"), 1500);
        return () => clearTimeout(timeout);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <TooltipProvider delay={100}>
      <div className="flex h-full flex-col">
        <div className="flex min-h-0 flex-1 gap-0">
          <div className="flex w-56 shrink-0 flex-col overflow-hidden border-r border-border-subtle bg-bg-chrome/40">
            <div className="relative shrink-0 p-3">
              <MagnifyingGlass
                size={14}
                className="absolute top-1/2 left-5.5 -translate-y-1/2 text-fg-subtle"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search settings"
                className="h-8 rounded-lg pl-8 text-ui-sm"
              />

              {(filteredItems.length > 0 || query.trim()) && (
                <div className="absolute top-full right-0 left-0 z-50 mx-3 -mt-1 rounded-lg border border-border bg-bg-elevated/95 p-1 shadow-[var(--shadow-md)] backdrop-blur-xl">
                  {filteredItems.length > 0 ? (
                    filteredItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectCategory(item.category)}
                        className="flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-bg-hover"
                      >
                        <span className="text-ui-sm text-fg-default">{item.label}</span>
                        <span className="text-ui-xs text-fg-subtle">
                          {CATEGORIES.find((c) => c.id === item.category)?.label}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-ui-xs text-fg-subtle">No settings found.</div>
                  )}
                </div>
              )}
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-3 px-2 pb-2">
                {CATEGORY_GROUPS.map((group) => (
                  <div key={group} className="flex flex-col gap-0.5">
                    <span className="px-2.5 pb-1 text-ui-2xs font-medium text-fg-subtle">
                      {group}
                    </span>
                    {CATEGORIES.filter((category) => category.group === group).map((category) => {
                      const Icon = category.icon;
                      const active = activeCategory === category.id;
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => handleSelectCategory(category.id)}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-left text-ui-sm transition-colors",
                            active
                              ? "bg-bg-hover font-medium text-fg-default"
                              : "text-fg-muted hover:bg-bg-hover hover:text-fg-default",
                          )}
                        >
                          <Icon
                            size={16}
                            weight={active ? "fill" : "regular"}
                            className={active ? "text-primary" : undefined}
                          />
                          {category.label}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex shrink-0 flex-col gap-0.5 border-t border-border-subtle p-2">
              <button
                type="button"
                onClick={handleExport}
                className="flex h-7 items-center gap-2.5 rounded-md px-2.5 text-left text-ui-xs text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
              >
                <DownloadSimple size={14} />
                Export
              </button>
              <button
                type="button"
                onClick={handleImport}
                className="flex h-7 items-center gap-2.5 rounded-md px-2.5 text-left text-ui-xs text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
              >
                <UploadSimple size={14} />
                Import
              </button>
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <button
                      type="button"
                      className="flex h-7 items-center gap-2.5 rounded-md px-2.5 text-left text-ui-xs text-fg-muted transition-colors hover:bg-bg-hover hover:text-status-error"
                    >
                      <ArrowCounterClockwise size={14} />
                      Reset Defaults
                    </button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset all settings?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will restore all settings to their default values. Your custom themes and
                      API keys will not be affected.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={resetToDefaults}>Reset</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="mx-auto flex w-full max-w-3xl shrink-0 items-start justify-between gap-4 px-8 pt-7 pb-4">
              <div className="flex min-w-0 flex-col gap-1">
                <h2 className="text-xl font-semibold tracking-tight text-fg-default">
                  {activeLabel}
                </h2>
                {activeCategoryDef && (
                  <p className="text-ui-sm text-fg-subtle">{activeCategoryDef.description}</p>
                )}
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full bg-status-success/10 px-2 py-0.5 text-ui-xs text-status-success transition-opacity duration-200",
                  saveIndicator === "saved" ? "opacity-100" : "opacity-0",
                )}
                aria-live="polite"
              >
                <Check size={12} />
                Saved
              </span>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="mx-auto w-full max-w-3xl px-8 pb-10">
                {activeCategory === "editor" && <EditorSettings />}
                {activeCategory === "terminal" && <TerminalSettings />}
                {activeCategory === "agents" && (
                  <div className="flex flex-col gap-8">
                    <AISettings />
                    <AgentSettings />
                    <NotificationSettings />
                  </div>
                )}
                {activeCategory === "voice" && <VoiceSettings />}
                {activeCategory === "theme" && <ThemeSettings />}
                {activeCategory === "mcp" && <McpSettings />}
                {activeCategory === "layout" && <LayoutSettings />}
                {activeCategory === "keyboard" && <KeyboardSettings />}
                {activeCategory === "languages" && <LspSettings />}
                {activeCategory === "extensions" && <ExtensionSettings />}
                {activeCategory === "about" && <AboutSettings />}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
