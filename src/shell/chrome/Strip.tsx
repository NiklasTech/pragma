import { useCallback, useEffect, useState } from "react";
import { openSettings } from "@/features/settings/openSettings";
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
import { Button } from "@/shared/components/ui/button";
import { ICON_SIZE, IconButton } from "@/shared/components/ui/icon-button";
import { RunConfigWidget } from "@/features/run-config/components";
import { useAgentsUiStore } from "@/features/ai/store/agentsUi";
import { ExtensionStatusItems } from "@/features/extensions/components/ExtensionStatusItems";
import { cn } from "@/shared/lib/utils";

import { GoToButton } from "./GoToButton";
import { NewTaskButton } from "./NewTaskButton";
import { SpaceTabs } from "./SpaceTabs";
import { StatusPill } from "./StatusPill";
import { SpaceButton } from "./SpaceButton";

/// The only permanent chrome: the space, its tabs, the agent status and Go to. macOS keeps the other
/// controls in the native menu bar; Windows and Linux show them here with the window controls.
export function Strip() {
  const [isMaximized, setIsMaximized] = useState(false);
  const win = getCurrentWindow();
  const saveFile = useSaveFile();
  const canSave = useEditorStore((s) => {
    const tab = s.tabs.find((candidate) => candidate.id === s.activeTabId);
    return tab?.kind === "file" ? tab.isModified : false;
  });
  const shortcuts = useSettingsStore((s) => s.shortcuts);
  const sidebar = useLayoutStore((s) => s.sidebar);
  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar);
  const threadsOpen = useAgentsUiStore((s) => s.threadsOpen);
  const toggleThreads = useAgentsUiStore((s) => s.toggleThreads);
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
      <div data-tauri-drag-region className="flex min-w-0 flex-1 items-center gap-1 self-stretch">
        {isMac && <div data-tauri-drag-region className="w-[68px] shrink-0 self-stretch" />}
        <SpaceButton />
        <span aria-hidden="true" className="mr-3 ml-1 h-4 w-px shrink-0 bg-fg-default/15" />
        <SpaceTabs />
      </div>

      <div data-tauri-drag-region className="flex shrink-0 items-center gap-1.5">
        <ExtensionStatusItems alignment="left" />
        <ExtensionStatusItems alignment="right" />
        <StatusPill />
        <GoToButton />
        <NewTaskButton />
        <RunConfigWidget runningOnly={isMac} />

        {!isMac && inEditor && sidebar.position !== "hidden" && (
          <IconButton
            icon={SidebarSimple}
            weight={sidebar.collapsed ? "regular" : "fill"}
            label={sidebar.collapsed ? "Show sidebar" : "Hide sidebar"}
            shortcut={formatShortcut(shortcuts["view.toggleSidebar"], isMac)}
            aria-pressed={!sidebar.collapsed}
            data-drawer-toggle
            className={cn(!sidebar.collapsed && "text-fg-default")}
            onClick={toggleSidebar}
          />
        )}

        {!isMac && !inEditor && (
          <IconButton
            icon={SidebarSimple}
            weight={threadsOpen ? "fill" : "regular"}
            label={threadsOpen ? "Hide threads" : "Show threads"}
            shortcut={formatShortcut(shortcuts["view.toggleSidebar"], isMac)}
            aria-pressed={threadsOpen}
            data-drawer-toggle
            className={cn(threadsOpen && "text-fg-default")}
            onClick={toggleThreads}
          />
        )}

        {!isMac && inEditor && (
          <IconButton
            icon={FloppyDisk}
            label="Save file"
            shortcut={formatShortcut(shortcuts["file.save"], isMac)}
            disabled={!canSave}
            onClick={saveFile}
          />
        )}

        {!isMac && inEditor && (
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={aiOpen}
            title={`AI Chat (${formatShortcut(shortcuts["ai.toggle"], isMac)})`}
            className={cn(aiOpen && "bg-bg-active text-fg-default")}
            onClick={toggleAI}
          >
            <Sparkle size={ICON_SIZE.sm} weight={aiOpen ? "fill" : "regular"} />
            Chat
          </Button>
        )}

        {!isMac && (
          <>
            <IconButton
              icon={GearSix}
              label="Settings"
              shortcut={formatShortcut(shortcuts["view.openSettings"], isMac)}
              onClick={() => openSettings()}
            />
            <div className="mx-1 h-4 w-px bg-border" />
            <IconButton
              icon={Minus}
              weight="bold"
              size="sm"
              label="Minimize"
              className="size-7"
              onClick={handleMinimize}
            />
            <IconButton
              icon={isMaximized ? CornersIn : CornersOut}
              weight="bold"
              size="sm"
              label={isMaximized ? "Restore" : "Maximize"}
              className="size-7"
              onClick={handleToggleMaximize}
            />
            <IconButton
              icon={X}
              weight="bold"
              size="sm"
              label="Close"
              className="size-7 hover:bg-status-error hover:text-fg-inverse"
              onClick={handleClose}
            />
          </>
        )}
      </div>
    </div>
  );
}
