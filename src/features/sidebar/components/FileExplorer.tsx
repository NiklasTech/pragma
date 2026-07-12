import { useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FolderOpen, Spinner } from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/button";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from "@/shared/components/ui/context-menu";
import { useFileExplorer } from "@/shared/hooks/useFileExplorer";
import { useLocalHistory } from "@/shared/hooks/useLocalHistory";
import { getVisibleNodes } from "@/shared/stores/fileExplorer";
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

  const { openPanel } = useLocalHistory();

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
      <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
        <p className="text-ui-sm text-fg-muted">No folder open</p>
        <Button variant="outline" size="sm" onClick={() => void selectRoot()} className="gap-2">
          <FolderOpen size={16} />
          Open Folder
        </Button>
      </div>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger className="h-full">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
            <span
              className="flex items-center gap-1.5 truncate text-ui-xs font-semibold text-fg-default"
              title={rootPath}
            >
              <FolderOpen size={12} className="text-fg-muted" />
              {rootName}
            </span>
          </div>
          <div ref={containerRef} className="min-h-0 flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size={20} className="animate-spin text-fg-muted" />
              </div>
            ) : visibleNodes.length === 0 ? (
              <div className="px-3 py-6 text-center text-ui-sm text-fg-muted">Empty folder</div>
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
                      className="absolute left-0 right-0"
                      style={{ transform: `translateY(${virtualItem.start}px)` }}
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
        <ContextMenuItem onClick={() => void selectRoot()}>
          <FolderOpen size={14} />
          <span>Open Folder</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
