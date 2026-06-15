import { useCallback } from "react";
import {
  Folder,
  FolderOpen,
  CaretRight,
  CaretDown,
  Spinner,
  ClockCounterClockwise,
} from "@phosphor-icons/react";
import { cn } from "@/shared/lib/utils";
import { getFileIcon } from "@/shared/lib/file-icons";
import { useEditorStore } from "@/shared/stores/editor";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/shared/components/ui/context-menu";
import type { FileSystemNode } from "@/shared/stores/fileExplorer";

interface FileTreeNodeProps {
  node: FileSystemNode;
  depth: number;
  expandedDirs: Set<string>;
  selectedPath: string | null;
  onToggleDir: (path: string) => void;
  onOpenFile: (path: string) => void;
  onCreate: (parentPath: string, name: string, isDirectory: boolean) => void;
  onRename: (path: string, newName: string) => void;
  onDelete: (path: string) => void;
  onShowLocalHistory?: (path: string) => void;
}

export function FileTreeNode({
  node,
  depth,
  expandedDirs,
  selectedPath,
  onToggleDir,
  onOpenFile,
  onCreate,
  onRename,
  onDelete,
  onShowLocalHistory,
}: FileTreeNodeProps) {
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const isExpanded = expandedDirs.has(node.path);
  const isSelected = selectedPath === node.path;
  const isActiveFile = activeTabId === node.path;

  const handleClick = useCallback(() => {
    if (node.isDirectory) {
      onToggleDir(node.path);
    } else {
      onOpenFile(node.path);
    }
  }, [node, onToggleDir, onOpenFile]);

  const handleCreateFile = useCallback(() => {
    const name = window.prompt("New file name:");
    if (name?.trim()) onCreate(node.path, name.trim(), false);
  }, [node.path, onCreate]);

  const handleCreateFolder = useCallback(() => {
    const name = window.prompt("New folder name:");
    if (name?.trim()) onCreate(node.path, name.trim(), true);
  }, [node.path, onCreate]);

  const handleRename = useCallback(() => {
    const name = window.prompt("Rename to:", node.name);
    if (name?.trim() && name.trim() !== node.name) {
      onRename(node.path, name.trim());
    }
  }, [node, onRename]);

  const handleDelete = useCallback(() => {
    const confirmed = window.confirm(`Delete "${node.name}"?`);
    if (confirmed) onDelete(node.path);
  }, [node, onDelete]);

  const handleShowLocalHistory = useCallback(() => {
    if (onShowLocalHistory) {
      onShowLocalHistory(node.path);
    }
  }, [node.path, onShowLocalHistory]);

  const paddingLeft = depth * 12 + 4;

  const content = (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-sm py-[3px] pr-2 text-ui-base cursor-pointer select-none transition-colors",
        isActiveFile
          ? "bg-bg-active text-primary"
          : isSelected
            ? "bg-bg-hover text-fg-default"
            : "text-fg-default hover:bg-bg-hover",
      )}
      style={{ paddingLeft }}
      onClick={handleClick}
    >
      {node.isDirectory ? (
        <>
          <span className="text-fg-subtle">
            {isExpanded ? (
              <CaretDown size={12} weight="bold" />
            ) : (
              <CaretRight size={12} weight="bold" />
            )}
          </span>
          {node.isLoading ? (
            <Spinner size={14} className="animate-spin text-fg-muted" />
          ) : (
            <span className={cn("shrink-0", isExpanded ? "text-primary" : "text-fg-muted")}>
              {isExpanded ? <FolderOpen size={14} /> : <Folder size={14} />}
            </span>
          )}
        </>
      ) : (
        <span className="w-3 shrink-0" />
      )}

      {node.isDirectory ? null : (
        <span className="shrink-0 text-fg-muted">
          {(() => {
            const Icon = getFileIcon(node.name);
            return <Icon size={14} />;
          })()}
        </span>
      )}

      <span className={cn("truncate", node.isDirectory && "font-medium")}>{node.name}</span>

      {node.error && (
        <span className="ml-auto shrink-0 text-ui-xs text-status-error" title={node.error}>
          err
        </span>
      )}
    </div>
  );

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger>{content}</ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          {node.isDirectory ? (
            <>
              <ContextMenuItem onClick={handleCreateFile}>New File</ContextMenuItem>
              <ContextMenuItem onClick={handleCreateFolder}>New Folder</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={handleRename}>Rename</ContextMenuItem>
              <ContextMenuItem variant="destructive" onClick={handleDelete}>
                Delete
              </ContextMenuItem>
            </>
          ) : (
            <>
              <ContextMenuItem onClick={handleClick}>Open</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={handleShowLocalHistory}>
                <ClockCounterClockwise size={14} className="mr-2" />
                Local History
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={handleRename}>Rename</ContextMenuItem>
              <ContextMenuItem variant="destructive" onClick={handleDelete}>
                Delete
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {node.isDirectory && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expandedDirs={expandedDirs}
              selectedPath={selectedPath}
              onToggleDir={onToggleDir}
              onOpenFile={onOpenFile}
              onCreate={onCreate}
              onRename={onRename}
              onDelete={onDelete}
              onShowLocalHistory={onShowLocalHistory}
            />
          ))}
        </div>
      )}
    </div>
  );
}
