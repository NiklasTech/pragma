import { useCallback, useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  CornersIn,
  CornersOut,
  FloppyDisk,
  GearSix,
  Minus,
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
import { formatShortcut, getIsMac } from "@/shared/lib/shortcuts";
import { ICON_SIZE } from "@/shared/components/ui/icon-button";
import { RunConfigWidget } from "@/features/run-config/components";
import { ContextPaneToggle } from "@/features/ai/components/ContextPaneToggle";
import { cn } from "@/shared/lib/utils";

import { GoToButton } from "./GoToButton";
import { SpaceTabs } from "./SpaceTabs";
import { StatusPill } from "./StatusPill";
import { WorkspaceMenu } from "./WorkspaceMenu";

const ICON_BUTTON =
  "flex size-7 items-center justify-center rounded-control text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default";

/// The only permanent chrome: the space, its tabs, the agent status, Go to and the window controls.
export function Strip() {
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
  const inEditor = useUiMode() === "editor";
  const isMac = getIsMac();

  useEffect(() => {
    const unlisten = win.onResized(() => {
      void win.isMaximized().then(setIsMaximized);
    });
    void win.isMaximized().then(setIsMaximized);
    return () => {
      void unlisten.then(unlistenQuietly).catch(() => {});
    };
  }, [win]);

  const handleMinimize = useCallback(() => void win.minimize(), [win]);
  const handleToggleMaximize = useCallback(() => void win.toggleMaximize(), [win]);
  const handleClose = useCallback(() => void win.close(), [win]);

  return (
    <div
      data-tauri-drag-region
      className="relative z-[60] flex h-header shrink-0 items-center gap-1 bg-bg-ground pr-2 pl-2.5 select-none"
    >
      <div data-tauri-drag-region className="flex min-w-0 flex-1 items-center gap-1">
        {isMac && <div data-tauri-drag-region className="w-[68px] shrink-0 self-stretch" />}
        <WorkspaceMenu />
        <span aria-hidden="true" className="mx-1 h-4.5 w-px shrink-0 bg-border" />
        <SpaceTabs />
      </div>

      <div data-tauri-drag-region className="flex shrink-0 items-center gap-1.5">
        <StatusPill />
        <GoToButton />
        <RunConfigWidget />

        {inEditor && sidebar.position !== "hidden" && (
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={sidebar.collapsed ? "Show sidebar" : "Hide sidebar"}
            aria-pressed={!sidebar.collapsed}
            title={`${sidebar.collapsed ? "Show" : "Hide"} Sidebar (${formatShortcut(shortcuts["view.toggleSidebar"], isMac)})`}
            className={cn(ICON_BUTTON, !sidebar.collapsed && "text-fg-default")}
          >
            <SidebarSimple size={ICON_SIZE.md} weight={sidebar.collapsed ? "regular" : "fill"} />
          </button>
        )}

        {!isMac && inEditor && (
          <button
            type="button"
            onClick={saveFile}
            disabled={!canSave}
            aria-label="Save file"
            className={cn(ICON_BUTTON, "disabled:cursor-not-allowed disabled:opacity-40")}
            title={`Save File (${formatShortcut(shortcuts["file.save"], isMac)})`}
          >
            <FloppyDisk size={ICON_SIZE.md} />
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
              "flex h-7 items-center gap-1.5 rounded-control px-2.5 text-ui-xs font-medium transition-colors",
              aiOpen
                ? "bg-bg-active text-fg-default"
                : "text-fg-muted hover:bg-bg-hover hover:text-fg-default",
            )}
          >
            <Sparkle size={ICON_SIZE.sm} weight={aiOpen ? "fill" : "regular"} />
            Chat
          </button>
        )}

        <button
          type="button"
          onClick={() => addFloatingPanel("settings")}
          aria-label="Settings"
          className={ICON_BUTTON}
          title={`Settings (${formatShortcut(shortcuts["view.openSettings"], isMac)})`}
        >
          <GearSix size={ICON_SIZE.md} />
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
              <Minus size={ICON_SIZE.sm} weight="bold" />
            </button>
            <button
              type="button"
              onClick={handleToggleMaximize}
              className={ICON_BUTTON}
              aria-label={isMaximized ? "Restore" : "Maximize"}
            >
              {isMaximized ? (
                <CornersIn size={ICON_SIZE.sm} weight="bold" />
              ) : (
                <CornersOut size={ICON_SIZE.sm} weight="bold" />
              )}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="flex size-7 items-center justify-center rounded-control text-fg-muted transition-colors hover:bg-status-error hover:text-fg-inverse"
              aria-label="Close"
            >
              <X size={ICON_SIZE.sm} weight="bold" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
