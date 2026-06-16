import { useCallback, useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  FloppyDisk,
  FolderOpen,
  Gear,
  Minus,
  Robot,
  CornersOut,
  CornersIn,
  X,
  Layout,
  Sidebar,
  Terminal as TerminalIcon,
  CaretDown,
} from "@phosphor-icons/react";
import { cn } from "@/shared/lib/utils";
import { useOpenFile } from "@/shared/hooks/useOpenFile";
import { useSaveFile } from "@/shared/hooks/useSaveFile";
import { useEditorStore } from "@/shared/stores/editor";
import { useLayoutStore } from "@/shell/layout";
import { layoutPresets, presetLabels } from "@/shell/layout/presets";
import { RunConfigWidget } from "@/features/run-config/components";
import { AISettings } from "@/features/settings/components/AISettings";
import { StatusbarSettings } from "@/features/settings/components/StatusbarSettings";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

const aiModeLabels: Record<string, string> = {
  hidden: "Hidden",
  floating: "Floating",
  "drawer-left": "Drawer Left",
  "drawer-right": "Drawer Right",
  "bottom-sheet": "Bottom Sheet",
};

const sidebarPositionLabels: Record<string, string> = {
  left: "Left",
  right: "Right",
  hidden: "Hidden",
};

const terminalModeLabels: Record<string, string> = {
  "docked-bottom": "Docked",
  "floating-tab": "Floating",
  hidden: "Hidden",
};

export function Titlebar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const win = getCurrentWindow();
  const openFile = useOpenFile();
  const saveFile = useSaveFile();
  const { tabs, activeTabId } = useEditorStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const canSave = activeTab?.kind === "file" ? activeTab.isModified : false;

  const {
    sidebar,
    ai,
    terminal,
    activePreset,
    toggleAI,
    setSidebarPosition,
    setTerminalMode,
    applyPreset,
  } = useLayoutStore();

  const aiOpen = ai.mode !== "hidden";

  useEffect(() => {
    const unlisten = win.onResized(() => {
      void win.isMaximized().then(setIsMaximized);
    });
    void win.isMaximized().then(setIsMaximized);
    return () => {
      void unlisten.then((f) => f());
    };
  }, [win]);

  const handleMinimize = useCallback(() => {
    void win.minimize();
  }, [win]);

  const handleToggleMaximize = useCallback(() => {
    void win.toggleMaximize();
  }, [win]);

  const handleClose = useCallback(() => {
    void win.close();
  }, [win]);

  return (
    <div
      data-tauri-drag-region
      className="flex h-header shrink-0 items-center justify-between select-none border-b border-border/60 bg-bg-surface"
    >
      <div className="flex items-center gap-2 px-3">
        <img src="/favicon.svg" alt="" className="h-5 w-5" />
        <span className="text-ui-xs font-semibold text-fg-default">Pragma</span>
        <button
          type="button"
          onClick={openFile}
          className="ml-2 flex h-8 items-center gap-1.5 rounded-md px-3 text-ui-sm text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
          title="Open File"
        >
          <FolderOpen size={16} />
          <span>Open</span>
        </button>
        <button
          type="button"
          onClick={saveFile}
          disabled={!canSave}
          className="flex h-8 items-center gap-1.5 rounded-md px-3 text-ui-sm text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default disabled:cursor-not-allowed disabled:opacity-40"
          title="Save File"
        >
          <FloppyDisk size={16} />
          <span>Save</span>
        </button>

        <div className="mx-1 h-4 w-px bg-border/60" />
        <RunConfigWidget />

        <button
          type="button"
          onClick={toggleAI}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-md px-3 text-ui-sm transition-colors",
            aiOpen
              ? "bg-accent-subtle text-primary"
              : "text-fg-muted hover:bg-bg-hover hover:text-fg-default",
          )}
          title="Toggle AI Chat (Ctrl+Shift+A)"
        >
          <Robot size={16} />
          <span>AI</span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-md px-3 text-ui-sm text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default outline-none",
              activePreset && "text-fg-default",
            )}
            title="Layout"
          >
            <Layout size={16} />
            <span>Layout</span>
            <CaretDown size={12} className="ml-0.5 opacity-70" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Presets</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {Object.keys(layoutPresets).map((id) => (
                  <DropdownMenuItem
                    key={id}
                    onClick={() => applyPreset(id)}
                    className={cn(activePreset === id && "bg-bg-active")}
                  >
                    <div className="flex flex-col">
                      <span>{presetLabels[id]?.name ?? id}</span>
                      <span className="text-ui-2xs text-fg-muted">
                        {presetLabels[id]?.description}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator />

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>AI Chat</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {Object.keys(aiModeLabels).map((mode) => (
                  <DropdownMenuItem
                    key={mode}
                    onClick={() => useLayoutStore.getState().setAIMode(mode as typeof ai.mode)}
                    className={cn(ai.mode === mode && "bg-bg-active")}
                  >
                    {aiModeLabels[mode]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Sidebar</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {Object.keys(sidebarPositionLabels).map((pos) => (
                  <DropdownMenuItem
                    key={pos}
                    onClick={() => setSidebarPosition(pos as typeof sidebar.position)}
                    className={cn(sidebar.position === pos && "bg-bg-active")}
                  >
                    <Sidebar size={14} className="mr-2" />
                    {sidebarPositionLabels[pos]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Terminal</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {Object.keys(terminalModeLabels).map((mode) => (
                  <DropdownMenuItem
                    key={mode}
                    onClick={() => setTerminalMode(mode as typeof terminal.mode)}
                    className={cn(terminal.mode === mode && "bg-bg-active")}
                  >
                    <TerminalIcon size={14} className="mr-2" />
                    {terminalModeLabels[mode]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>

        <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
          <SheetTrigger
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-md px-3 text-ui-sm transition-colors",
              settingsOpen
                ? "bg-accent-subtle text-primary"
                : "text-fg-muted hover:bg-bg-hover hover:text-fg-default",
            )}
            title="Settings"
          >
            <Gear size={16} />
            <span>Settings</span>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Settings</SheetTitle>
            </SheetHeader>
            <div className="py-4 space-y-6">
              <AISettings />
              <StatusbarSettings />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex-1" data-tauri-drag-region />

      <div className="flex items-center">
        <button
          type="button"
          onClick={handleMinimize}
          className="flex h-header w-14 items-center justify-center text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
          aria-label="Minimize"
        >
          <Minus size={18} weight="bold" />
        </button>
        <button
          type="button"
          onClick={handleToggleMaximize}
          className="flex h-header w-14 items-center justify-center text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
          aria-label={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? (
            <CornersIn size={18} weight="bold" />
          ) : (
            <CornersOut size={18} weight="bold" />
          )}
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="flex h-header w-14 items-center justify-center text-fg-muted transition-colors hover:bg-status-error hover:text-fg-inverse"
          aria-label="Close"
        >
          <X size={18} weight="bold" />
        </button>
      </div>
    </div>
  );
}
