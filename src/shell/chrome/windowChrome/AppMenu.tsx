import { getCurrentWindow } from "@tauri-apps/api/window";
import { List } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { ICON_SIZE } from "@/shared/components/ui/icon-button";
import { dispatchMenuAction } from "@/shared/lib/menuAction";
import { formatShortcut } from "@/shared/lib/shortcuts";
import { useEditorStore } from "@/shared/stores/editor";
import { useSettingsStore } from "@/shared/stores/settings";
import { useAgentsUiStore } from "@/features/ai/store/agentsUi";
import { useLayoutStore } from "@/shell/layout";
import { useUiMode } from "@/shell/mode";

import {
  APP_MENU_FOOTER,
  APP_MENU_GROUPS,
  type AppMenuEntry,
  type MenuToggle,
} from "./appMenuModel";

const RECENT_LIMIT = 10;

function folderName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

function useToggles(): Record<MenuToggle, boolean> {
  const sidebarCollapsed = useLayoutStore((state) => state.sidebar.collapsed);
  const threadsOpen = useAgentsUiStore((state) => state.threadsOpen);
  const terminalOpen = useLayoutStore((state) => state.terminal.mode !== "hidden");
  const aiOpen = useLayoutStore((state) => state.ai.mode !== "hidden");
  const inAgents = useUiMode() === "agents";
  return {
    sidebar: inAgents ? threadsOpen : !sidebarCollapsed,
    terminal: terminalOpen,
    ai: aiOpen,
  };
}

/// The menu bar of macOS behind one button, for Windows and Linux.
export function AppMenu() {
  const shortcuts = useSettingsStore((state) => state.shortcuts);
  const recentFolders = useSettingsStore((state) => state.workspace.recentFolders);
  const canSave = useEditorStore((state) => {
    const tab = state.tabs.find((candidate) => candidate.id === state.activeTabId);
    return tab?.kind === "file" ? tab.isModified : false;
  });
  const toggles = useToggles();

  const shortcutOf = (id: string) => {
    const binding = id in shortcuts ? shortcuts[id as keyof typeof shortcuts] : null;
    return binding ? formatShortcut(binding, false) : "";
  };

  const renderEntry = (entry: AppMenuEntry, index: number) => {
    if (entry.kind === "separator") return <DropdownMenuSeparator key={`separator-${index}`} />;
    if (entry.kind === "recent") {
      return (
        <DropdownMenuSub key="recent">
          <DropdownMenuSubTrigger>Open Recent</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-w-[320px] min-w-[200px]">
            {recentFolders.length === 0 ? (
              <DropdownMenuItem disabled>No recent folders</DropdownMenuItem>
            ) : (
              recentFolders.slice(0, RECENT_LIMIT).map((path) => (
                <DropdownMenuItem
                  key={path}
                  title={path}
                  onClick={() => dispatchMenuAction("file.openRecent", path)}
                >
                  <span className="truncate">{folderName(path)}</span>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      );
    }
    const shortcut = shortcutOf(entry.id);
    if (entry.kind === "toggle") {
      return (
        <DropdownMenuCheckboxItem
          key={entry.id}
          checked={toggles[entry.toggle]}
          onClick={() => dispatchMenuAction(entry.id)}
        >
          {entry.label}
          {shortcut && <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut>}
        </DropdownMenuCheckboxItem>
      );
    }
    return (
      <DropdownMenuItem
        key={entry.id}
        disabled={entry.id === "file.save" && !canSave}
        onClick={() => dispatchMenuAction(entry.id)}
      >
        {entry.label}
        {shortcut && <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut>}
      </DropdownMenuItem>
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Menu" title="Menu" className="shrink-0">
            <List size={ICON_SIZE.md} />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="min-w-[200px]">
        {APP_MENU_GROUPS.map((group) => (
          <DropdownMenuSub key={group.label}>
            <DropdownMenuSubTrigger>{group.label}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-[240px]">
              {group.entries.map(renderEntry)}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
        <DropdownMenuSeparator />
        {APP_MENU_FOOTER.map(renderEntry)}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void getCurrentWindow().close()}>Exit</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
