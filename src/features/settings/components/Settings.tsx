"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";
import { useSettingsStore } from "@/shared/stores/settings";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
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
import {
  Code,
  Terminal,
  Robot,
  Palette,
  PlugsConnected,
  GitBranch,
  Layout,
  MagnifyingGlass,
  ArrowCounterClockwise,
  DownloadSimple,
  UploadSimple,
} from "@phosphor-icons/react";
import { AISettings } from "./AISettings";
import { EditorSettings } from "./EditorSettings";
import { TerminalSettings } from "./TerminalSettings";
import { ThemeSettings } from "./ThemeSettings";
import { McpSettings } from "./McpSettings";
import { GitSettings } from "./GitSettings";
import { LayoutSettings } from "./LayoutSettings";
import { exportSettings, importSettings } from "./settings-io";

type Category = "editor" | "terminal" | "ai" | "theme" | "mcp" | "git" | "layout";

interface CategoryDef {
  id: Category;
  label: string;
  icon: React.ElementType;
}

const CATEGORIES: CategoryDef[] = [
  { id: "editor", label: "Editor", icon: Code },
  { id: "terminal", label: "Terminal", icon: Terminal },
  { id: "ai", label: "AI", icon: Robot },
  { id: "theme", label: "Theme", icon: Palette },
  { id: "mcp", label: "MCP", icon: PlugsConnected },
  { id: "git", label: "Git", icon: GitBranch },
  { id: "layout", label: "Layout", icon: Layout },
];

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
    category: "ai",
  },
  {
    id: "ai-inline-completion",
    label: "Inline Completion",
    keywords: "inline completion ghost text ai",
    category: "ai",
  },
  {
    id: "ai-terminal-suggestions",
    label: "AI Terminal Suggestions",
    keywords: "ai terminal suggestions",
    category: "ai",
  },
  {
    id: "ai-debounce",
    label: "Completion Debounce",
    keywords: "debounce ai completion delay",
    category: "ai",
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
    id: "git-user-name",
    label: "Git User Name",
    keywords: "git user name author commit",
    category: "git",
  },
  {
    id: "git-user-email",
    label: "Git User Email",
    keywords: "git user email author commit",
    category: "git",
  },
  {
    id: "git-sign-off",
    label: "Git Sign-Off",
    keywords: "git sign off signed-off-by commit",
    category: "git",
  },
  {
    id: "git-remote",
    label: "Git Default Remote",
    keywords: "git remote origin push pull",
    category: "git",
  },
  { id: "git-gpg", label: "Git GPG Key", keywords: "git gpg sign commit", category: "git" },
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
];

export function Settings() {
  const [activeCategory, setActiveCategory] = React.useState<Category>("editor");
  const [query, setQuery] = React.useState("");
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
    } catch (err) {
      console.error("[Settings Export]", err);
    }
  };

  const handleImport = async () => {
    try {
      await importSettings();
    } catch (err) {
      console.error("[Settings Import]", err);
    }
  };

  const activeLabel = CATEGORIES.find((c) => c.id === activeCategory)?.label ?? "Settings";

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="flex w-44 shrink-0 flex-col gap-3">
          <div className="relative">
            <MagnifyingGlass
              size={14}
              className="absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-subtle"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search settings..."
              className="h-7 pl-8 text-ui-sm"
            />
          </div>

          {filteredItems.length > 0 ? (
            <div className="flex flex-col gap-0.5 rounded-md border border-border/60 bg-bg-root p-1">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectCategory(item.category)}
                  className="flex flex-col gap-0.5 rounded px-2 py-1.5 text-left transition-colors hover:bg-bg-hover"
                >
                  <span className="text-ui-sm text-fg-default">{item.label}</span>
                  <span className="text-ui-xs text-fg-subtle">
                    {CATEGORIES.find((c) => c.id === item.category)?.label}
                  </span>
                </button>
              ))}
            </div>
          ) : query.trim() ? (
            <div className="px-1 text-ui-xs text-fg-subtle">No settings found.</div>
          ) : null}

          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-0.5 pr-2">
              {CATEGORIES.map((category) => {
                const Icon = category.icon;
                const active = activeCategory === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => handleSelectCategory(category.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-ui-sm font-medium transition-colors",
                      active
                        ? "bg-bg-active text-primary"
                        : "text-fg-muted hover:bg-bg-hover hover:text-fg-default",
                    )}
                  >
                    <Icon size={16} />
                    {category.label}
                  </button>
                );
              })}
            </div>
          </ScrollArea>

          <div className="flex flex-col gap-1.5 border-t border-border/40 pt-3">
            <Button
              variant="outline"
              size="xs"
              onClick={handleExport}
              className="justify-start gap-1.5"
            >
              <DownloadSimple size={14} />
              Export
            </Button>
            <Button
              variant="outline"
              size="xs"
              onClick={handleImport}
              className="justify-start gap-1.5"
            >
              <UploadSimple size={14} />
              Import
            </Button>
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="ghost"
                    size="xs"
                    className="justify-start gap-1.5 text-fg-muted hover:text-status-error"
                  >
                    <ArrowCounterClockwise size={14} />
                    Reset Defaults
                  </Button>
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

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mb-3 border-b border-border/40 pb-2">
            <h2 className="font-heading text-sm font-semibold text-fg-default">{activeLabel}</h2>
          </div>
          <ScrollArea className="h-[calc(100%-2rem)]">
            <div className="pr-3">
              {activeCategory === "editor" && <EditorSettings />}
              {activeCategory === "terminal" && <TerminalSettings />}
              {activeCategory === "ai" && <AISettings />}
              {activeCategory === "theme" && <ThemeSettings />}
              {activeCategory === "mcp" && <McpSettings />}
              {activeCategory === "git" && <GitSettings />}
              {activeCategory === "layout" && <LayoutSettings />}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
