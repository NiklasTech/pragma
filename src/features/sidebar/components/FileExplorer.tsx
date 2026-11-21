import { useEffect, useMemo, useState } from "react";
import {
  ArrowsInLineVertical,
  FilePlus,
  FolderOpen,
  FolderPlus,
  Files,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/button";
import { IconButton } from "@/shared/components/ui/icon-button";
import { Input } from "@/shared/components/ui/input";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from "@/shared/components/ui/context-menu";
import { InputDialog } from "@/shared/components/ui/input-dialog";
import { PanelEmptyState } from "@/shared/components/PanelEmptyState";
import { useFileExplorer } from "@/shared/hooks/useFileExplorer";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";
import { getVisibleNodes, useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useGitStore } from "@/shared/stores/git";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { buildGitDecorations } from "@/features/sidebar/lib/gitDecorations";
import { useFileSelectionStore } from "@/features/sidebar/lib/fileSelection";
import { filterWorkspaceFiles } from "@/features/sidebar/lib/treeFilter";
import { useWorkspaceFileList } from "@/features/sidebar/hooks/useWorkspaceFileList";
import { useRepositoryTree } from "@/features/sidebar/hooks/useRepositoryTree";
import { useRepositoryWorktrees } from "@/features/sidebar/worktrees/useRepositoryWorktrees";
import { useWorktreeViewStore } from "@/features/sidebar/worktrees/worktreeView";
import { WorktreeRootRow } from "@/features/sidebar/worktrees/WorktreeRootRow";
import { WorktreeTree } from "@/features/sidebar/worktrees/WorktreeTree";
import { FileTreeRows } from "./FileTreeRows";

export function FileExplorer() {
  const { selectRoot, toggleDirectory, createNode } = useFileExplorer();
  const rootPath = useFileExplorerStore((s) => s.rootPath);
  const tree = useFileExplorerStore((s) => s.tree);
  const expandedDirs = useFileExplorerStore((s) => s.expandedDirs);
  const isLoading = useFileExplorerStore((s) => s.isLoading);

  const showTreeLoading = useDelayedLoading(isLoading);

  const collapseAll = useFileExplorerStore((s) => s.collapseAll);
  const showAll = useFileExplorerStore((s) => s.showAllRepositories);
  const setShowAll = useFileExplorerStore((s) => s.setShowAllRepositories);
  const repositoryCount = useOpenRepositoriesStore((s) => s.paths.length);
  useRepositoryTree();
  const gitSnapshot = useGitStore((s) => s.snapshot);
  const decorations = useMemo(
    () => buildGitDecorations(gitSnapshot, rootPath),
    [gitSnapshot, rootPath],
  );
  const [createAtRoot, setCreateAtRoot] = useState<{ open: boolean; isDirectory: boolean }>({
    open: false,
    isDirectory: false,
  });

  const rootName = rootPath ? rootPath.replace(/\\/g, "/").split("/").pop() || rootPath : null;

  const [filter, setFilter] = useState("");
  const filtering = filter.trim() !== "";
  const workspaceFiles = useWorkspaceFileList(rootPath, filtering);
  const visibleNodes = useMemo(
    () =>
      filtering && rootPath
        ? filterWorkspaceFiles(rootPath, workspaceFiles ?? [], filter)
        : getVisibleNodes(tree, expandedDirs),
    [tree, expandedDirs, filter, filtering, rootPath, workspaceFiles],
  );

  useEffect(() => {
    useFileSelectionStore.getState().reset(null);
  }, [rootPath]);

  // While filtering, every folder that holds a match shows open.
  const shownOpen = useMemo(
    () =>
      filtering
        ? new Set(
            visibleNodes.filter((item) => item.node.isDirectory).map((item) => item.node.path),
          )
        : expandedDirs,
    [filtering, visibleNodes, expandedDirs],
  );

  const { worktrees, shown } = useRepositoryWorktrees(showAll ? null : rootPath);
  const collapseWorktree = useWorktreeViewStore((s) => s.collapse);
  const mainChanged = gitSnapshot?.changed_files.length ?? 0;
  const branch = gitSnapshot?.repo.branch || null;

  if (!rootPath) {
    return (
      <PanelEmptyState
        icon={Files}
        title="No folder open"
        description="Open a workspace folder to browse files and start coding."
      >
        <Button variant="outline" size="sm" onClick={() => void selectRoot()} className="gap-2">
          <FolderOpen size={16} />
          Open Folder
        </Button>
      </PanelEmptyState>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger className="h-full">
        <div className="flex h-full flex-col">
          <div className="flex h-11 shrink-0 items-center gap-2 pr-1.5 pl-3.5">
            <span className="text-ui-sm font-semibold text-fg-default" title={rootPath}>
              Files
            </span>
            {(showAll || repositoryCount > 1) && (
              <SegmentedControl<"space" | "all">
                label="Show files from"
                value={showAll ? "all" : "space"}
                onValueChange={(value) => setShowAll(value === "all")}
                options={[
                  { value: "space", label: "This space" },
                  { value: "all", label: "All" },
                ]}
              />
            )}
            <span className="ml-auto flex items-center">
              <IconButton
                icon={ArrowsInLineVertical}
                label="Collapse all folders"
                onClick={() => (shown ? collapseWorktree(shown.environment.path) : collapseAll())}
              />
            </span>
          </div>
          <label className="mx-2.5 mb-1.5 flex h-7.5 shrink-0 items-center gap-2 rounded-control bg-control px-2.5 text-fg-subtle ring-inset focus-within:ring-2 focus-within:ring-border-focus">
            <MagnifyingGlass size={13} aria-hidden="true" />
            <Input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && filter) {
                  event.stopPropagation();
                  setFilter("");
                }
              }}
              placeholder={`Filter files in ${rootName ?? "the folder"}`}
              aria-label="Filter files"
              className="h-full min-w-0 flex-1 bg-transparent px-0 ring-0 hover:ring-0 focus-visible:ring-0"
            />
          </label>
          {!showAll && rootPath && shown ? (
            <WorktreeTree
              key={shown.environment.id}
              rootPath={rootPath}
              branch={branch}
              worktrees={worktrees}
              worktree={shown}
              mainChanged={mainChanged}
              filter={filter}
            />
          ) : (
            <>
              {!showAll && gitSnapshot && (
                <WorktreeRootRow
                  rootPath={rootPath}
                  branch={branch}
                  worktrees={worktrees}
                  shown={null}
                  changed={mainChanged}
                  mainChanged={mainChanged}
                />
              )}
              <FileTreeRows
                nodes={visibleNodes}
                expandedDirs={shownOpen}
                onToggleDir={toggleDirectory}
                decorations={decorations}
                dropRoot={rootPath}
                loading={showTreeLoading}
                emptyText={
                  filtering
                    ? workspaceFiles === null
                      ? "Searching…"
                      : "No file matches."
                    : "Empty folder"
                }
              />
            </>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => setCreateAtRoot({ open: true, isDirectory: false })}>
          <FilePlus size={14} />
          <span>New File</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => setCreateAtRoot({ open: true, isDirectory: true })}>
          <FolderPlus size={14} />
          <span>New Folder</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => void selectRoot()}>
          <FolderOpen size={14} />
          <span>Open Folder</span>
        </ContextMenuItem>
      </ContextMenuContent>
      <InputDialog
        open={createAtRoot.open}
        onOpenChange={(open) => setCreateAtRoot((prev) => ({ ...prev, open }))}
        title={createAtRoot.isDirectory ? "New Folder" : "New File"}
        description={`Create a new ${createAtRoot.isDirectory ? "folder" : "file"} in ${rootName ?? "the workspace"}.`}
        label="Name"
        confirmLabel="Create"
        onConfirm={(name) => {
          if (name)
            void createNode(shown?.environment.path ?? rootPath, name, createAtRoot.isDirectory);
        }}
      />
    </ContextMenu>
  );
}
