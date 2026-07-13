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
import { formatShortcut, getIsMac } from "@/shared/lib/shortcuts";
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
  const { tabs, activeTabId } = useEditorStore();
  const shortcuts = useSettingsStore((s) => s.shortcuts);
  const recentFolders = useSettingsStore((s) => s.workspace.recentFolders);
  const favoriteFolders = useSettingsStore((s) => s.workspace.favoriteFolders);
  const addFavoriteFolder = useSettingsStore((s) => s.addFavoriteFolder);
  const removeFavoriteFolder = useSettingsStore((s) => s.removeFavoriteFolder);
  const rootPath = useFileExplorerStore((s) => s.rootPath);
  const isMac = getIsMac();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const canSave = activeTab?.kind === "file" ? activeTab.isModified : false;

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

  const { addFloatingPanel } = useLayoutStore();

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
      className="relative z-[60] flex h-header shrink-0 items-center select-none border-b border-border/40"
      style={{
        background: "linear-gradient(180deg, var(--bg-surface) 0%, rgba(18,18,26,0.95) 100%)",
      }}
    >
      <div className="flex items-center gap-2.5 px-3">
        <div className="flex items-center justify-center rounded-lg bg-bg-elevated p-1 shadow-sm">
          <img src="/pragma_logo.svg" alt="" className="h-4 w-4" />
        </div>
        <span className="text-ui-xs font-semibold tracking-wide text-fg-default">Pragma</span>

        <div className="mx-1 h-4 w-px bg-border/30" />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex h-8 items-center justify-center gap-1 rounded-lg px-2.5 text-fg-muted transition-all duration-fast hover:bg-bg-hover hover:text-fg-default hover:shadow-sm"
                title="Open folder or file"
              >
                <FolderOpen size={16} weight="regular" />
                <CaretDown size={10} className="opacity-50" />
              </button>
            }
          />
          <DropdownMenuContent align="start" className="min-w-[240px] rounded-xl border-border/50 glass-strong">
            <DropdownMenuItem onClick={handleOpenFolder} className="rounded-lg">
              <FolderOpen size={14} />
              Open Folder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={openFile} className="rounded-lg">
              <FileText size={14} />
              Open File
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/30" />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="rounded-lg">
                <Star size={14} />
                Favorites
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-[240px] rounded-xl border-border/50 glass-strong">
                {favoriteFolders.length === 0 && (
                  <DropdownMenuItem disabled className="rounded-lg">
                    <span className="text-fg-subtle">No favorites yet</span>
                  </DropdownMenuItem>
                )}
                {favoriteFolders.map((path) => (
                  <DropdownMenuItem
                    key={path}
                    onClick={() => selectRoot(path)}
                    className="group justify-between rounded-lg"
                  >
                    <span className="truncate">{path}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFavoriteFolder(path);
                      }}
                      className="ml-2 rounded-md p-0.5 text-fg-subtle opacity-0 transition-all hover:bg-bg-hover hover:text-status-error group-focus-within:opacity-100 group-hover:opacity-100"
                      title="Remove favorite"
                    >
                      <X size={12} />
                    </button>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="bg-border/30" />
                <DropdownMenuItem onClick={handleAddFavorite} className="rounded-lg">
                  <Plus size={14} />
                  Add Favorite…
                </DropdownMenuItem>
                {rootPath && (
                  <DropdownMenuItem onClick={handleAddCurrentFolder} className="rounded-lg">
                    <Star size={14} />
                    Add Current Folder
                  </DropdownMenuItem>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            {recentFolders.length > 0 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="rounded-lg">
                  <FolderOpen size={14} />
                  Open Recent
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-[240px] rounded-xl border-border/50 glass-strong">
                  {recentFolders.slice(0, 5).map((path) => (
                    <DropdownMenuItem key={path} onClick={() => selectRoot(path)} className="rounded-lg">
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
          className="flex h-8 w-9 items-center justify-center rounded-lg text-fg-muted transition-all duration-fast hover:bg-bg-hover hover:text-fg-default hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-30"
          title={`Save File (${formatShortcut(shortcuts["file.save"], isMac)})`}
        >
          <FloppyDisk size={16} weight={canSave ? "fill" : "regular"} />
        </button>

        <div className="mx-1 h-4 w-px bg-border/30" />
        <RunConfigWidget />
      </div>

      <div className="flex-1" data-tauri-drag-region />

      <div className="flex items-center">
        <div className="flex items-center border-l border-border/30">
          <button
            type="button"
            onClick={() => addFloatingPanel("settings")}
            className="flex h-header w-10 items-center justify-center rounded-lg text-fg-muted transition-all duration-fast hover:bg-bg-hover hover:text-fg-default m-0.5"
            title={`Settings (${formatShortcut(shortcuts["view.openSettings"], isMac)})`}
          >
            <Gear size={16} />
          </button>
        </div>

        <div className="flex items-center border-l border-border/30">
          <button
            type="button"
            onClick={handleMinimize}
            className="flex h-8 w-12 items-center justify-center rounded-lg text-fg-muted transition-all duration-fast hover:bg-bg-hover hover:text-fg-default m-0.5"
            aria-label="Minimize"
          >
            <Minus size={16} weight="bold" />
          </button>
          <button
            type="button"
            onClick={handleToggleMaximize}
            className="flex h-8 w-12 items-center justify-center rounded-lg text-fg-muted transition-all duration-fast hover:bg-bg-hover hover:text-fg-default m-0.5"
            aria-label={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? (
              <CornersIn size={16} weight="bold" />
            ) : (
              <CornersOut size={16} weight="bold" />
            )}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-8 w-12 items-center justify-center rounded-lg text-fg-muted transition-all duration-fast hover:bg-status-error/90 hover:text-fg-inverse m-0.5"
            aria-label="Close"
          >
            <X size={16} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  );
}
