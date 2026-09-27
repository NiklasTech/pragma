import { CaretDown, FileText, FolderOpen, GitBranch, Plus, Star, X } from "@phosphor-icons/react";
import { open } from "@tauri-apps/plugin-dialog";

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
import { useFileExplorer } from "@/shared/hooks/useFileExplorer";
import { useOpenFile } from "@/shared/hooks/useOpenFile";
import { getWorkspaceName } from "@/shared/lib/workspaceName";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useGitStore } from "@/shared/stores/git";
import { useSettingsStore } from "@/shared/stores/settings";

export function WorkspaceMenu() {
  const openFile = useOpenFile();
  const { selectRoot } = useFileExplorer();
  const recentFolders = useSettingsStore((s) => s.workspace.recentFolders);
  const favoriteFolders = useSettingsStore((s) => s.workspace.favoriteFolders);
  const addFavoriteFolder = useSettingsStore((s) => s.addFavoriteFolder);
  const removeFavoriteFolder = useSettingsStore((s) => s.removeFavoriteFolder);
  const rootPath = useFileExplorerStore((s) => s.rootPath);
  const workspaceName = getWorkspaceName(rootPath);
  const branch = useGitStore((s) => s.snapshot?.repo.branch ?? null);

  const handleAddFavorite = async () => {
    const path = await open({ multiple: false, directory: true });
    if (typeof path === "string" && path.length > 0) {
      addFavoriteFolder(path);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex h-7 max-w-[280px] min-w-0 items-center gap-2 rounded-full pr-2.5 pl-1.5 text-ui-sm transition-colors hover:bg-bg-hover"
            title={rootPath ?? "Open folder or file"}
          >
            <img src="/pragma_logo.svg" alt="" className="h-4 w-auto shrink-0" />
            <span className="min-w-0 truncate font-semibold text-fg-default">
              {workspaceName || "Open Folder"}
            </span>
            {branch && (
              <span className="flex min-w-0 items-center gap-1 text-ui-xs text-fg-subtle">
                <GitBranch size={12} className="shrink-0" />
                <span className="truncate">{branch}</span>
              </span>
            )}
            <CaretDown size={10} weight="bold" className="shrink-0 text-fg-subtle" />
          </button>
        }
      />
      <DropdownMenuContent align="start" className="min-w-[240px]">
        <DropdownMenuItem onClick={() => void selectRoot()}>
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
              <DropdownMenuItem onClick={() => addFavoriteFolder(rootPath)}>
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
  );
}
