import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowsInLineVertical,
  FilePlus,
  FolderOpen,
  FolderPlus,
  Files,
  MagnifyingGlass,
  Spinner,
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
import { useLocalHistory } from "@/shared/hooks/useLocalHistory";
import { getVisibleNodes, useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useGitStore } from "@/shared/stores/git";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { buildGitDecorations } from "@/features/sidebar/lib/gitDecorations";
import { useFileSelectionStore } from "@/features/sidebar/lib/fileSelection";
import { movePaths } from "@/features/sidebar/lib/fileTreeActions";
import { useFileTreeDrop } from "@/features/sidebar/hooks/useFileTreeDrop";
import { filterWorkspaceFiles } from "@/features/sidebar/lib/treeFilter";
import { useWorkspaceFileList } from "@/features/sidebar/hooks/useWorkspaceFileList";
import { useRepositoryTree } from "@/features/sidebar/hooks/useRepositoryTree";
import { useUiSize } from "@/theme/useUiMetrics";
import { FileTreeNode } from "./FileTreeNode";

const ROW_HEIGHT = 26;
const OVERSCAN = 12;

export function FileExplorer() {
  const { selectRoot, toggleDirectory, openFileByPath, createNode, renameNode, deleteNode } =
    useFileExplorer();
  const rootPath = useFileExplorerStore((s) => s.rootPath);
  const tree = useFileExplorerStore((s) => s.tree);
  const expandedDirs = useFileExplorerStore((s) => s.expandedDirs);
  const selectedPath = useFileExplorerStore((s) => s.selectedPath);
  const isLoading = useFileExplorerStore((s) => s.isLoading);

  const showTreeLoading = useDelayedLoading(isLoading);

  const { openPanel } = useLocalHistory();
  const collapseAll = useFileExplorerStore((s) => s.collapseAll);
  const showAll = useFileExplorerStore((s) => s.showAllRepositories);
  const setShowAll = useFileExplorerStore((s) => s.setShowAllRepositories);
  const repositoryCount = useOpenRepositoriesStore((s) => s.paths.length);
  useRepositoryTree();
  const gitSnapshot = useGitStore((s) => s.snapshot);
  const decorations = useMemo(() => buildGitDecorations(gitSnapshot), [gitSnapshot]);
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

  const handleMultiSelect = useCallback(
    (path: string, mode: "toggle" | "range") => {
      const selection = useFileSelectionStore.getState();
      if (mode === "toggle") selection.toggle(path);
      else
        selection.extend(
          path,
          visibleNodes.filter((item) => !item.node.repositoryRoot).map((item) => item.node.path),
        );
    },
    [visibleNodes],
  );

  const handleMove = useCallback((paths: string[], targetDir: string) => {
    useFileSelectionStore.getState().reset(null);
    void movePaths(paths, targetDir);
  }, []);

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

  const rootDrop = useFileTreeDrop(rootPath ?? "", handleMove);

  const containerRef = useRef<HTMLDivElement>(null);
  const rowHeight = useUiSize()(ROW_HEIGHT);
  const virtualizer = useVirtualizer({
    count: visibleNodes.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => rowHeight,
    overscan: OVERSCAN,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [virtualizer, rowHeight]);

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
                  { value: "all", label: "All spaces" },
                ]}
              />
            )}
            <span className="ml-auto flex items-center">
              <IconButton
                icon={ArrowsInLineVertical}
                label="Collapse all folders"
                onClick={collapseAll}
              />
            </span>
          </div>
          <label className="mx-2.5 mb-1.5 flex h-7.5 shrink-0 items-center gap-2 rounded-control bg-control px-2.5 text-fg-subtle">
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
          <div ref={containerRef} className="min-h-0 flex-1 overflow-auto" {...rootDrop.handlers}>
            {showTreeLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size={20} className="animate-spin text-fg-muted" />
              </div>
            ) : visibleNodes.length === 0 ? (
              <div className="px-3.5 py-2 text-ui-sm text-fg-muted">
                {filtering
                  ? workspaceFiles === null
                    ? "Searching…"
                    : "No file matches."
                  : "Empty folder"}
              </div>
            ) : (
              <div
                className="relative w-full"
                style={{ height: `${virtualizer.getTotalSize()}px` }}
              >
                {virtualizer.getVirtualItems().map((virtualItem) => {
                  const { node, depth } = visibleNodes[virtualItem.index];
                  return (
                    <div
                      key={virtualItem.key}
                      className="absolute left-0 right-0 overflow-hidden"
                      style={{
                        height: `${rowHeight}px`,
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      <FileTreeNode
                        node={node}
                        depth={depth}
                        expandedDirs={shownOpen}
                        selectedPath={selectedPath}
                        onToggleDir={toggleDirectory}
                        onOpenFile={openFileByPath}
                        onCreate={createNode}
                        onRename={renameNode}
                        onDelete={deleteNode}
                        onMultiSelect={handleMultiSelect}
                        onMove={handleMove}
                        onShowLocalHistory={openPanel}
                        decoration={decorations.files.get(node.path)}
                        hasChanges={node.isDirectory && decorations.dirtyDirs.has(node.path)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
          if (name) void createNode(rootPath, name, createAtRoot.isDirectory);
        }}
      />
    </ContextMenu>
  );
}
