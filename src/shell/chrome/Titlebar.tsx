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
import { TitlebarButton } from "./TitlebarButton";
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
      className="relative z-[60] flex h-header shrink-0 items-center select-none border-b border-border/60 bg-bg-surface"
    >
      <div className="flex items-center gap-2 px-3">
        <img src="/pragma_logo.svg" alt="" className="h-5 w-5" />
        <span className="text-ui-xs font-semibold text-fg-default">Pragma</span>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <TitlebarButton className="h-8 gap-0.5 px-2" title="Open folder or file">
                <FolderOpen size={16} />
                <CaretDown size={10} className="opacity-60" />
              </TitlebarButton>
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

        <TitlebarButton
          onClick={saveFile}
          disabled={!canSave}
          className="size-8"
          title={`Save File (${formatShortcut(shortcuts["file.save"], isMac)})`}
        >
          <FloppyDisk size={16} />
        </TitlebarButton>

        <div className="mx-1 h-4 w-px bg-border/60" />
        <RunConfigWidget />
      </div>

      <div className="flex-1" data-tauri-drag-region />

      <div className="flex items-center">
        <div className="flex items-center border-l border-border/40">
          <TitlebarButton
            onClick={() => addFloatingPanel("settings")}
            className="h-header w-10"
            title={`Settings (${formatShortcut(shortcuts["view.openSettings"], isMac)})`}
          >
            <Gear size={16} />
          </TitlebarButton>
        </div>

        <TitlebarButton onClick={handleMinimize} className="h-header w-14" aria-label="Minimize">
          <Minus size={18} weight="bold" />
        </TitlebarButton>
        <TitlebarButton
          onClick={handleToggleMaximize}
          className="h-header w-14"
          aria-label={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? (
            <CornersIn size={18} weight="bold" />
          ) : (
            <CornersOut size={18} weight="bold" />
          )}
        </TitlebarButton>
        <TitlebarButton
          onClick={handleClose}
          variant="danger"
          className="h-header w-14"
          aria-label="Close"
        >
          <X size={18} weight="bold" />
        </TitlebarButton>
      </div>
    </div>
  );
}
