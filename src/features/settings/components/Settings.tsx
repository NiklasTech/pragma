"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";
import { useSettingsStore } from "@/shared/stores/settings";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
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
  Layout,
  Keyboard,
  Info,
  MagnifyingGlass,
  ArrowCounterClockwise,
  DownloadSimple,
  UploadSimple,
  BracketsAngle,
  Check,
} from "@phosphor-icons/react";
import { AISettings } from "./AISettings";
import { EditorSettings } from "./EditorSettings";
import { TerminalSettings } from "./TerminalSettings";
import { ThemeSettings } from "./ThemeSettings";
import { McpSettings } from "./McpSettings";
import { LayoutSettings } from "./LayoutSettings";
import { KeyboardSettings } from "./KeyboardSettings";
import { AboutSettings } from "./AboutSettings";
import { LspSettings } from "./LspSettings";
import { exportSettings, importSettings } from "./settings-io";

type Category =
  | "editor"
  | "terminal"
  | "ai"
  | "theme"
  | "mcp"
  | "layout"
  | "keyboard"
  | "languages"
  | "about";

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
  { id: "languages", label: "Languages", icon: BracketsAngle },
  { id: "layout", label: "Layout", icon: Layout },
  { id: "keyboard", label: "Keyboard", icon: Keyboard },
  { id: "about", label: "About", icon: Info },
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
    <TooltipProvider>
      <div className="flex h-full flex-col">
        <div className="flex min-h-0 flex-1 gap-0">
          <div className="flex w-[200px] shrink-0 flex-col overflow-hidden border-r border-border/30">
            <div className="relative shrink-0 p-3 pb-2">
              <MagnifyingGlass
                size={14}
                className="absolute top-1/2 left-5 -translate-y-1/2 text-fg-subtle"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search settings..."
                className="h-7 pl-8 text-ui-sm"
              />

              {(filteredItems.length > 0 || query.trim()) && (
                <div className="absolute top-full right-0 left-0 z-50 mx-3 mt-1 rounded-md border border-border/60 bg-bg-surface p-1 shadow-lg">
                  {filteredItems.length > 0 ? (
                    filteredItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectCategory(item.category)}
                        className="flex w-full flex-col gap-0.5 rounded px-2 py-1.5 text-left transition-colors hover:bg-bg-hover"
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

            <ScrollArea className="min-h-0 flex-1 px-2">
              <div className="flex flex-col py-1">
                {CATEGORIES.map((category) => {
                  const Icon = category.icon;
                  const active = activeCategory === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => handleSelectCategory(category.id)}
                      className={cn(
                        "flex items-center gap-2 border-l-2 px-2.5 py-1.5 text-left text-ui-sm font-medium transition-colors",
                        active
                          ? "border-primary text-fg-default"
                          : "border-transparent text-fg-muted hover:text-fg-default",
                      )}
                    >
                      <Icon size={16} />
                      {category.label}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="flex shrink-0 items-center justify-between border-t border-border/30 p-2">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button variant="ghost" size="icon-xs" onClick={handleExport}>
                      <DownloadSimple size={14} />
                    </Button>
                  }
                />
                <TooltipContent>Export settings</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button variant="ghost" size="icon-xs" onClick={handleImport}>
                      <UploadSimple size={14} />
                    </Button>
                  }
                />
                <TooltipContent>Import settings</TooltipContent>
              </Tooltip>

              <AlertDialog>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <AlertDialogTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="text-fg-muted hover:text-status-error"
                          >
                            <ArrowCounterClockwise size={14} />
                          </Button>
                        }
                      />
                    }
                  />
                  <TooltipContent>Reset defaults</TooltipContent>
                </Tooltip>
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
            <ScrollArea className="min-h-0 flex-1">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-heading text-sm font-semibold text-fg-default">
                    {activeLabel}
                  </h2>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-ui-xs text-status-success transition-opacity duration-200",
                      saveIndicator === "saved" ? "opacity-100" : "opacity-0",
                    )}
                    aria-live="polite"
                  >
                    <Check size={12} />
                    Saved
                  </span>
                </div>
                <div className="mt-5">
                  {activeCategory === "editor" && <EditorSettings />}
                  {activeCategory === "terminal" && <TerminalSettings />}
                  {activeCategory === "ai" && <AISettings />}
                  {activeCategory === "theme" && <ThemeSettings />}
                  {activeCategory === "mcp" && <McpSettings />}
                  {activeCategory === "layout" && <LayoutSettings />}
                  {activeCategory === "keyboard" && <KeyboardSettings />}
                  {activeCategory === "languages" && <LspSettings />}
                  {activeCategory === "about" && <AboutSettings />}
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
