import { useCallback, useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  FloppyDisk,
  GearSix,
  Minus,
  CornersOut,
  CornersIn,
  SidebarSimple,
  Sparkle,
  X,
} from "@phosphor-icons/react";
import { unlistenQuietly } from "@/shared/lib/unlisten";
import { useSaveFile } from "@/shared/hooks/useSaveFile";
import { useEditorStore } from "@/shared/stores/editor";
import { useSettingsStore } from "@/shared/stores/settings";
import { useLayoutStore } from "@/shell/layout";
import { useUiMode } from "@/shell/mode";
import { ModeSwitch } from "@/shell/chrome/ModeSwitch";
import { formatShortcut, getIsMac } from "@/shared/lib/shortcuts";
import { RunConfigWidget } from "@/features/run-config/components";
import { ContextPaneToggle } from "@/features/ai/components/ContextPaneToggle";
import { cn } from "@/shared/lib/utils";

import { CommandCenter } from "./CommandCenter";
import { WorkspaceMenu } from "./WorkspaceMenu";

const ICON_BUTTON =
  "flex size-7 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default";

export function Titlebar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const win = getCurrentWindow();
  const saveFile = useSaveFile();
  const canSave = useEditorStore((s) => {
    const tab = s.tabs.find((candidate) => candidate.id === s.activeTabId);
    return tab?.kind === "file" ? tab.isModified : false;
  });
  const shortcuts = useSettingsStore((s) => s.shortcuts);
  const addFloatingPanel = useLayoutStore((s) => s.addFloatingPanel);
  const sidebar = useLayoutStore((s) => s.sidebar);
  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar);
  const aiOpen = useLayoutStore((s) => s.ai.mode !== "hidden");
  const toggleAI = useLayoutStore((s) => s.toggleAI);
  const uiMode = useUiMode();
  const isMac = getIsMac();
  const inEditor = uiMode === "editor";

  useEffect(() => {
    const unlisten = win.onResized(() => {
      void win.isMaximized().then(setIsMaximized);
    });
    void win.isMaximized().then(setIsMaximized);
    return () => {
      void unlisten.then(unlistenQuietly).catch(() => {});
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
      className="relative z-[60] grid h-header shrink-0 grid-cols-[1fr_minmax(0,540px)_1fr] items-center gap-3 bg-bg-chrome px-2 select-none"
    >
      <div data-tauri-drag-region className="flex min-w-0 items-center gap-1">
        {isMac && <div data-tauri-drag-region className="w-[68px] shrink-0 self-stretch" />}
        {inEditor && sidebar.position !== "hidden" && (
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={sidebar.collapsed ? "Show sidebar" : "Hide sidebar"}
            aria-pressed={!sidebar.collapsed}
            title={`${sidebar.collapsed ? "Show" : "Hide"} Sidebar (${formatShortcut(shortcuts["view.toggleSidebar"], isMac)})`}
            className={cn(ICON_BUTTON, !sidebar.collapsed && "text-fg-default")}
          >
            <SidebarSimple size={16} weight={sidebar.collapsed ? "regular" : "fill"} />
          </button>
        )}
        {!isMac && <WorkspaceMenu />}
      </div>

      <div
        data-tauri-drag-region
        className="flex h-8 min-w-0 items-center gap-1 rounded-full border border-border bg-bg-root p-0.5 shadow-[var(--shadow-sm)]"
      >
        <ModeSwitch />
        <div aria-hidden="true" className="h-4 w-px shrink-0 bg-border" />
        <CommandCenter />
      </div>

      <div data-tauri-drag-region className="flex min-w-0 items-center justify-end gap-1">
        <RunConfigWidget />

        {!isMac && (
          <button
            type="button"
            onClick={saveFile}
            disabled={!canSave}
            className={cn(ICON_BUTTON, "disabled:cursor-not-allowed disabled:opacity-40")}
            title={`Save File (${formatShortcut(shortcuts["file.save"], isMac)})`}
          >
            <FloppyDisk size={15} />
          </button>
        )}

        {!inEditor && <ContextPaneToggle />}

        {inEditor && (
          <button
            type="button"
            onClick={toggleAI}
            aria-pressed={aiOpen}
            title={`AI Chat (${formatShortcut(shortcuts["ai.toggle"], isMac)})`}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-full px-2.5 text-ui-xs font-medium transition-colors",
              aiOpen
                ? "bg-accent-subtle text-primary"
                : "text-fg-muted hover:bg-bg-hover hover:text-fg-default",
            )}
          >
            <Sparkle size={14} weight={aiOpen ? "fill" : "regular"} />
            Chat
          </button>
        )}

        <button
          type="button"
          onClick={() => addFloatingPanel("settings")}
          className={ICON_BUTTON}
          title={`Settings (${formatShortcut(shortcuts["view.openSettings"], isMac)})`}
        >
          <GearSix size={16} />
        </button>

        {!isMac && (
          <>
            <div className="mx-1 h-4 w-px bg-border" />
            <button
              type="button"
              onClick={handleMinimize}
              className={ICON_BUTTON}
              aria-label="Minimize"
            >
              <Minus size={15} weight="bold" />
            </button>
            <button
              type="button"
              onClick={handleToggleMaximize}
              className={ICON_BUTTON}
              aria-label={isMaximized ? "Restore" : "Maximize"}
            >
              {isMaximized ? (
                <CornersIn size={15} weight="bold" />
              ) : (
                <CornersOut size={15} weight="bold" />
              )}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="flex size-7 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-status-error hover:text-fg-inverse"
              aria-label="Close"
            >
              <X size={15} weight="bold" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
