import { useCallback, useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  FloppyDisk,
  FolderOpen,
  Gear,
  Minus,
  CornersOut,
  CornersIn,
  X,
  CaretDown,
  FileText,
  Star,
  Plus,
} from "@phosphor-icons/react";
import { open } from "@tauri-apps/plugin-dialog";
import { useOpenFile } from "@/shared/hooks/useOpenFile";
import { useSaveFile } from "@/shared/hooks/useSaveFile";
import { useFileExplorer } from "@/shared/hooks/useFileExplorer";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useEditorStore } from "@/shared/stores/editor";
import { useSettingsStore } from "@/shared/stores/settings";
import { useLayoutStore } from "@/shell/layout";
import { ModeSwitch } from "@/shell/chrome/ModeSwitch";
import { formatShortcut, getIsMac } from "@/shared/lib/shortcuts";
import { getWorkspaceName } from "@/shared/lib/workspaceName";
import { RunConfigWidget } from "@/features/run-config/components";
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

export function Titlebar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const win = getCurrentWindow();
  const openFile = useOpenFile();
  const saveFile = useSaveFile();
  const { selectRoot } = useFileExplorer();
  const canSave = useEditorStore((s) => {
    const tab = s.tabs.find((candidate) => candidate.id === s.activeTabId);
    return tab?.kind === "file" ? tab.isModified : false;
  });
  const shortcuts = useSettingsStore((s) => s.shortcuts);
  const recentFolders = useSettingsStore((s) => s.workspace.recentFolders);
  const favoriteFolders = useSettingsStore((s) => s.workspace.favoriteFolders);
  const addFavoriteFolder = useSettingsStore((s) => s.addFavoriteFolder);
  const removeFavoriteFolder = useSettingsStore((s) => s.removeFavoriteFolder);
  const rootPath = useFileExplorerStore((s) => s.rootPath);
  const isMac = getIsMac();
  const workspaceName = getWorkspaceName(rootPath);

  const handleOpenFolder = async () => {
    await selectRoot();
  };

  const handleAddFavorite = async () => {
    const path = await open({ multiple: false, directory: true });
    if (typeof path === "string" && path.length > 0) {
      addFavoriteFolder(path);
    }
  };

  const handleAddCurrentFolder = () => {
    if (rootPath) {
      addFavoriteFolder(rootPath);
    }
  };

  const addFloatingPanel = useLayoutStore((s) => s.addFloatingPanel);

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
      className="relative z-[60] flex h-header shrink-0 items-center select-none border-b border-border bg-bg-surface"
    >
      <div className="flex items-center gap-1.5 px-2">
        <img src="/pragma_logo.svg" alt="" className="h-4.5 w-4.5" />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex h-7 max-w-[200px] min-w-0 items-center gap-1 rounded-md px-2 text-ui-xs font-medium text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
                title={rootPath ?? "Open folder or file"}
              >
                <span className="min-w-0 truncate">{workspaceName || "Open Folder"}</span>
                <CaretDown size={10} className="shrink-0 opacity-60" />
              </button>
            }
          />
          <DropdownMenuContent align="start" className="min-w-[240px]">
            <DropdownMenuItem onClick={handleOpenFolder}>
              <FolderOpen size={14} />
              Open Folder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={openFile}>
              <FileText size={14} />
              Open File
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Star size={14} />
                Favorites
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-[240px]">
                {favoriteFolders.length === 0 && (
                  <DropdownMenuItem disabled>
                    <span className="text-fg-subtle">No favorites yet</span>
                  </DropdownMenuItem>
                )}
                {favoriteFolders.map((path) => (
                  <DropdownMenuItem
                    key={path}
                    onClick={() => selectRoot(path)}
                    className="group justify-between"
                  >
                    <span className="truncate">{path}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFavoriteFolder(path);
                      }}
                      className="ml-2 rounded p-0.5 text-fg-subtle opacity-0 transition-opacity hover:bg-bg-hover hover:text-status-error group-focus-within:opacity-100 group-hover:opacity-100"
                      title="Remove favorite"
                    >
                      <X size={12} />
                    </button>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleAddFavorite}>
                  <Plus size={14} />
                  Add Favorite…
                </DropdownMenuItem>
                {rootPath && (
                  <DropdownMenuItem onClick={handleAddCurrentFolder}>
                    <Star size={14} />
                    Add Current Folder
                  </DropdownMenuItem>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            {recentFolders.length > 0 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FolderOpen size={14} />
                  Open Recent
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-[240px]">
                  {recentFolders.slice(0, 5).map((path) => (
                    <DropdownMenuItem key={path} onClick={() => selectRoot(path)}>
                      <span className="truncate">{path}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          onClick={saveFile}
          disabled={!canSave}
          className="flex h-7 w-8 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default disabled:cursor-not-allowed disabled:opacity-40"
          title={`Save File (${formatShortcut(shortcuts["file.save"], isMac)})`}
        >
          <FloppyDisk size={15} />
        </button>

        <div className="mx-1 h-4 w-px bg-border/60" />
        <RunConfigWidget />
      </div>

      <div className="flex flex-1 items-center justify-center" data-tauri-drag-region>
        <ModeSwitch />
      </div>

      <div className="flex items-center gap-1 px-2">
        <button
          type="button"
          onClick={() => addFloatingPanel("settings")}
          className="flex h-7 w-8 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
          title={`Settings (${formatShortcut(shortcuts["view.openSettings"], isMac)})`}
        >
          <Gear size={15} />
        </button>

        <button
          type="button"
          onClick={handleMinimize}
          className="flex h-7 w-8 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
          aria-label="Minimize"
        >
          <Minus size={15} weight="bold" />
        </button>
        <button
          type="button"
          onClick={handleToggleMaximize}
          className="flex h-7 w-8 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
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
          className="flex h-7 w-8 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-status-error hover:text-fg-inverse"
          aria-label="Close"
        >
          <X size={15} weight="bold" />
        </button>
      </div>
    </div>
  );
}
