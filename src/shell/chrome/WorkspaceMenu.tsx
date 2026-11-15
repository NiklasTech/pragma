import {
  CaretDown,
  Check,
  FileText,
  FolderOpen,
  FolderSimpleMinus,
  Plus,
  Star,
  X,
} from "@phosphor-icons/react";
import { open } from "@tauri-apps/plugin-dialog";

import { PragmaMark } from "@/shared/components/PragmaMark";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useFileExplorer } from "@/shared/hooks/useFileExplorer";
import { useCloseRepository } from "@/shared/hooks/useOpenRepositories";
import { useOpenFile } from "@/shared/hooks/useOpenFile";
import { getWorkspaceName } from "@/shared/lib/workspaceName";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useGitStore } from "@/shared/stores/git";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { useSettingsStore } from "@/shared/stores/settings";
import { RepositoryColorDot } from "@/shared/components/RepositoryColorDot";

import { RepositoryColorMenu } from "./RepositoryColorMenu";

export function WorkspaceMenu() {
  const openFile = useOpenFile();
  const { selectRoot } = useFileExplorer();
  const closeRepository = useCloseRepository();
  const repositories = useOpenRepositoriesStore((s) => s.paths);
  const activeRepository = useOpenRepositoriesStore((s) => s.activePath);
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
          <Button
            variant="ghost"
            aria-label={`Switch space, current: ${workspaceName || "none"}`}
            className="max-w-[260px] min-w-0 justify-start pr-2 pl-1.5 font-semibold text-fg-default"
            title={branch ? `${rootPath} (${branch})` : (rootPath ?? "Open folder or file")}
          >
            {workspaceName ? (
              <span
                aria-hidden="true"
                className="flex size-5 shrink-0 items-center justify-center rounded-[6px] bg-bg-active text-[11px] text-fg-muted"
              >
                {workspaceName.charAt(0).toUpperCase()}
              </span>
            ) : (
              <PragmaMark variant="compact" className="size-4 shrink-0 text-fg-default" />
            )}
            <RepositoryColorDot path={activeRepository} />
            <span className="min-w-0 truncate">{workspaceName || "Open Folder"}</span>
            <CaretDown size={12} className="shrink-0 text-fg-subtle" />
          </Button>
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
        {repositories.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Repositories</DropdownMenuLabel>
              {repositories.map((path) => (
                <DropdownMenuItem
                  key={path}
                  onClick={() => void selectRoot(path)}
                  className="group justify-between"
                  title={path}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Check
                      size={14}
                      className={path === activeRepository ? "shrink-0" : "invisible shrink-0"}
                    />
                    <RepositoryColorDot path={path} />
                    <span className="truncate">{getWorkspaceName(path)}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Close repository"
                    title="Close repository"
                    onClick={(e) => {
                      e.stopPropagation();
                      void closeRepository(path);
                    }}
                    className="ml-2 text-fg-subtle opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-status-error"
                  >
                    <X size={12} />
                  </Button>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            {activeRepository && <RepositoryColorMenu path={activeRepository} />}
            {activeRepository && (
              <DropdownMenuItem onClick={() => void closeRepository(activeRepository)}>
                <FolderSimpleMinus size={14} />
                Close Repository
              </DropdownMenuItem>
            )}
          </>
        )}
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
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Remove favorite"
                  title="Remove favorite"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFavoriteFolder(path);
                  }}
                  className="ml-2 text-fg-subtle opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-status-error"
                >
                  <X size={12} />
                </Button>
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
