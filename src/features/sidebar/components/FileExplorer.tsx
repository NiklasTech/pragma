import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowsInLineVertical,
  FilePlus,
  FolderOpen,
  FolderPlus,
  Files,
  Spinner,
} from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/button";
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
import { buildGitDecorations } from "@/features/sidebar/lib/gitDecorations";
import { FileTreeNode } from "./FileTreeNode";

const ROW_HEIGHT = 26;
const OVERSCAN = 12;

export function FileExplorer() {
  const {
    rootPath,
    tree,
    expandedDirs,
    selectedPath,
    isLoading,
    selectRoot,
    toggleDirectory,
    openFileByPath,
    createNode,
    renameNode,
    deleteNode,
  } = useFileExplorer();

  const showTreeLoading = useDelayedLoading(isLoading);

  const { openPanel } = useLocalHistory();
  const collapseAll = useFileExplorerStore((s) => s.collapseAll);
  const gitSnapshot = useGitStore((s) => s.snapshot);
  const decorations = useMemo(() => buildGitDecorations(gitSnapshot), [gitSnapshot]);
  const [createAtRoot, setCreateAtRoot] = useState<{ open: boolean; isDirectory: boolean }>({
    open: false,
    isDirectory: false,
  });

  const rootName = rootPath ? rootPath.replace(/\\/g, "/").split("/").pop() || rootPath : null;

  const visibleNodes = useMemo(() => getVisibleNodes(tree, expandedDirs), [tree, expandedDirs]);

  const containerRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: visibleNodes.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

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
          <div className="flex h-8 shrink-0 items-center gap-0.5 pr-1.5 pl-3">
            <span
              className="min-w-0 flex-1 truncate text-ui-xs font-semibold text-fg-default"
              title={rootPath}
            >
              {rootName ?? "Workspace"}
            </span>
            <HeaderAction
              label="New file"
              onClick={() => setCreateAtRoot({ open: true, isDirectory: false })}
            >
              <FilePlus size={14} />
            </HeaderAction>
            <HeaderAction
              label="New folder"
              onClick={() => setCreateAtRoot({ open: true, isDirectory: true })}
            >
              <FolderPlus size={14} />
            </HeaderAction>
            <HeaderAction label="Collapse all folders" onClick={collapseAll}>
              <ArrowsInLineVertical size={14} />
            </HeaderAction>
          </div>
          <div ref={containerRef} className="min-h-0 flex-1 overflow-auto">
            {showTreeLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size={20} className="animate-spin text-fg-muted" />
              </div>
            ) : visibleNodes.length === 0 ? (
              <div className="px-3 py-2 text-ui-sm text-fg-muted">Empty folder</div>
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
                        height: `${ROW_HEIGHT}px`,
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      <FileTreeNode
                        node={node}
                        depth={depth}
                        expandedDirs={expandedDirs}
                        selectedPath={selectedPath}
                        onToggleDir={toggleDirectory}
                        onOpenFile={openFileByPath}
                        onCreate={createNode}
                        onRename={renameNode}
                        onDelete={deleteNode}
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

function HeaderAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-6 shrink-0 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-bg-hover hover:text-fg-default"
    >
      {children}
    </button>
  );
}
