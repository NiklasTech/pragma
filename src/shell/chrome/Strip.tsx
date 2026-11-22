import { SidebarSimple } from "@phosphor-icons/react";
import { useSettingsStore } from "@/shared/stores/settings";
import { useLayoutStore } from "@/shell/layout";
import { useUiMode } from "@/shell/mode";
import { formatShortcut, getIsMac, getIsWindows } from "@/shared/lib/shortcuts";
import { IconButton } from "@/shared/components/ui/icon-button";
import { RunConfigWidget } from "@/features/run-config/components";
import { useAgentsUiStore } from "@/features/ai/store/agentsUi";
import { ExtensionStatusItems } from "@/features/extensions/components/ExtensionStatusItems";
import { cn } from "@/shared/lib/utils";

import { GoToButton } from "./GoToButton";
import { NewTaskButton } from "./NewTaskButton";
import { SpaceTabs } from "./SpaceTabs";
import { StatusPill } from "./StatusPill";
import { SpaceButton } from "./SpaceButton";
import { AppMenu } from "./windowChrome/AppMenu";
import { useButtonLayout } from "./windowChrome/useButtonLayout";
import { WindowControls } from "./windowChrome/WindowControls";

/// The only permanent chrome: the space, its tabs, the agent status and Go to. macOS keeps the other
/// controls in the native menu bar; Windows and Linux reach them through the menu button and draw
/// their own window buttons, on the side the Linux desktop puts them.
export function Strip() {
  const shortcuts = useSettingsStore((s) => s.shortcuts);
  const sidebar = useLayoutStore((s) => s.sidebar);
  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar);
  const threadsOpen = useAgentsUiStore((s) => s.threadsOpen);
  const toggleThreads = useAgentsUiStore((s) => s.toggleThreads);
  const inEditor = useUiMode() === "editor";
  const isMac = getIsMac();
  const isWindows = getIsWindows();
  const buttons = useButtonLayout(!isMac && !isWindows);
  const look = isWindows ? "caption" : "round";

  return (
    <div
      data-tauri-drag-region
      className={cn(
        "relative z-[60] flex h-header shrink-0 items-center gap-1 bg-bg-ground pl-2.5 select-none",
        isWindows ? "pr-0" : "pr-2",
      )}
    >
      <div
        data-tauri-drag-region
        className="flex min-w-0 flex-1 items-center gap-1 self-stretch overflow-hidden"
      >
        {isMac && <div data-tauri-drag-region className="w-[68px] shrink-0 self-stretch" />}
        {!isMac && <WindowControls buttons={buttons.left} look={look} className="mr-2" />}
        {!isMac && <AppMenu />}
        <SpaceButton />
        <span aria-hidden="true" className="mr-3 ml-1 h-4 w-px shrink-0 bg-fg-default/15" />
        <SpaceTabs />
      </div>

      <div
        data-tauri-drag-region
        className="flex min-w-0 items-center justify-end gap-1.5 overflow-hidden"
      >
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
      </div>

      {!isMac && (
        <WindowControls
          buttons={buttons.right}
          look={look}
          className={isWindows ? "ml-2" : "ml-3"}
        />
      )}
    </div>
  );
}
