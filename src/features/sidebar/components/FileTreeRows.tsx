import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Spinner } from "@phosphor-icons/react";

import { useFileExplorer } from "@/shared/hooks/useFileExplorer";
import { useLocalHistory } from "@/shared/hooks/useLocalHistory";
import { useFileExplorerStore, type VisibleFileNode } from "@/shared/stores/fileExplorer";
import type { GitDecorations } from "@/features/sidebar/lib/gitDecorations";
import { useFileSelectionStore } from "@/features/sidebar/lib/fileSelection";
import { movePaths } from "@/features/sidebar/lib/fileTreeActions";
import { useFileTreeDrop } from "@/features/sidebar/hooks/useFileTreeDrop";
import { useUiSize } from "@/theme/useUiMetrics";

import { FileTreeNode } from "./FileTreeNode";

const ROW_HEIGHT = 26;
const OVERSCAN = 12;

interface FileTreeRowsProps {
  nodes: VisibleFileNode[];
  expandedDirs: Set<string>;
  onToggleDir: (path: string) => void;
  decorations: GitDecorations;
  /** The folder a drop on the empty space below the rows moves into. */
  dropRoot: string;
  loading: boolean;
  emptyText: string;
  /** Shown on every changed file, before its git letter. */
  changeMark?: ReactNode;
}

/// The visible rows of a file tree, virtualized, with selection, drag and drop and git letters.
export function FileTreeRows({
  nodes,
  expandedDirs,
  onToggleDir,
  decorations,
  dropRoot,
  loading,
  emptyText,
  changeMark,
}: FileTreeRowsProps) {
  const { openFileByPath, createNode, renameNode, deleteNode } = useFileExplorer();
  const selectedPath = useFileExplorerStore((s) => s.selectedPath);
  const { openPanel } = useLocalHistory();

  const handleMultiSelect = useCallback(
    (path: string, mode: "toggle" | "range") => {
      const selection = useFileSelectionStore.getState();
      if (mode === "toggle") selection.toggle(path);
      else
        selection.extend(
          path,
          nodes.filter((item) => !item.node.repositoryRoot).map((item) => item.node.path),
        );
    },
    [nodes],
  );

  const handleMove = useCallback((paths: string[], targetDir: string) => {
    useFileSelectionStore.getState().reset(null);
    void movePaths(paths, targetDir);
  }, []);

  const rootDrop = useFileTreeDrop(dropRoot, handleMove);

  const containerRef = useRef<HTMLDivElement>(null);
  const rowHeight = useUiSize()(ROW_HEIGHT);
  const virtualizer = useVirtualizer({
    count: nodes.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => rowHeight,
    overscan: OVERSCAN,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [virtualizer, rowHeight]);

  return (
    <div ref={containerRef} className="min-h-0 flex-1 overflow-auto" {...rootDrop.handlers}>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner size={20} className="animate-spin text-fg-muted" />
        </div>
      ) : nodes.length === 0 ? (
        <div className="px-3.5 py-2 text-ui-sm text-fg-muted">{emptyText}</div>
      ) : (
        <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const { node, depth } = nodes[virtualItem.index];
            const decoration = decorations.files.get(node.path);
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
                  expandedDirs={expandedDirs}
                  selectedPath={selectedPath}
                  onToggleDir={onToggleDir}
                  onOpenFile={openFileByPath}
                  onCreate={createNode}
                  onRename={renameNode}
                  onDelete={deleteNode}
                  onMultiSelect={handleMultiSelect}
                  onMove={handleMove}
                  onShowLocalHistory={openPanel}
                  decoration={decoration}
                  changeMark={decoration && !node.isDirectory ? changeMark : undefined}
                  hasChanges={node.isDirectory && decorations.dirtyDirs.has(node.path)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
