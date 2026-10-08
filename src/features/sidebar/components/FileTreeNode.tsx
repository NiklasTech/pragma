import { useCallback, useState } from "react";
import { CaretRight, CaretDown, Spinner } from "@phosphor-icons/react";
import { cn } from "@/shared/lib/utils";
import { getFileIconPath } from "@/shared/lib/file-icons";
import { getFolderIconPath } from "@/shared/lib/folder-icons";
import { parentPath } from "@/shared/lib/fileDisk";
import { PRAGMA_PATH_MIME, PRAGMA_PATHS_MIME } from "@/shared/lib/pragma-drag";
import { useEditorStore } from "@/shared/stores/editor";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";
import { ContextMenu, ContextMenuTrigger } from "@/shared/components/ui/context-menu";
import { InputDialog } from "@/shared/components/ui/input-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import type { FileSystemNode } from "@/shared/stores/fileExplorer";
import type { GitDecoration, GitDecorationKind } from "@/features/sidebar/lib/gitDecorations";
import { selectionTargets, useFileSelectionStore } from "@/features/sidebar/lib/fileSelection";
import { useFileTreeDrop } from "@/features/sidebar/hooks/useFileTreeDrop";
import { FileTreeContextMenu } from "./FileTreeContextMenu";

const INDENT = 12;

const DECORATION_TEXT: Record<GitDecorationKind, string> = {
  added: "text-git-added",
  untracked: "text-git-untracked",
  modified: "text-git-modified",
  deleted: "text-git-deleted line-through",
  conflict: "text-status-error",
};

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
  onMultiSelect: (path: string, mode: "toggle" | "range") => void;
  onMove: (paths: string[], targetDir: string) => void;
  onShowLocalHistory?: (path: string) => void;
  decoration?: GitDecoration;
  hasChanges?: boolean;
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
  onMultiSelect,
  onMove,
  onShowLocalHistory,
  decoration,
  hasChanges = false,
}: FileTreeNodeProps) {
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const selection = useFileSelectionStore((s) => s.paths);
  const isExpanded = expandedDirs.has(node.path);
  const isSelected =
    selection.length > 0 ? selection.includes(node.path) : selectedPath === node.path;
  const isActiveFile = activeTabId === node.path;
  const showDirLoading = useDelayedLoading(node.isLoading === true);
  const targets = selectionTargets(node.path, selection);
  const drop = useFileTreeDrop(node.isDirectory ? node.path : parentPath(node.path), onMove);

  const activate = useCallback(() => {
    if (node.isDirectory) {
      onToggleDir(node.path);
    } else {
      onOpenFile(node.path);
    }
  }, [node, onToggleDir, onOpenFile]);

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.metaKey || event.ctrlKey) {
        onMultiSelect(node.path, "toggle");
        return;
      }
      if (event.shiftKey) {
        onMultiSelect(node.path, "range");
        return;
      }
      useFileSelectionStore.getState().reset(node.path);
      activate();
    },
    [node.path, onMultiSelect, activate],
  );

  const [createDialog, setCreateDialog] = useState<{ open: boolean; isDirectory: boolean }>({
    open: false,
    isDirectory: false,
  });
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteTargets, setDeleteTargets] = useState<string[] | null>(null);

  const handleCreateConfirm = useCallback(
    (name: string) => {
      if (name) onCreate(node.path, name, createDialog.isDirectory);
    },
    [node.path, onCreate, createDialog.isDirectory],
  );

  const handleRenameConfirm = useCallback(
    (name: string) => {
      if (name && name !== node.name) {
        onRename(node.path, name);
      }
    },
    [node, onRename],
  );

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTargets) return;
    for (const path of deleteTargets) onDelete(path);
    if (deleteTargets.length > 1) useFileSelectionStore.getState().reset(null);
    setDeleteTargets(null);
  }, [deleteTargets, onDelete]);

  const handleShowLocalHistory = useCallback(() => {
    if (onShowLocalHistory) {
      onShowLocalHistory(node.path);
    }
  }, [node.path, onShowLocalHistory]);

  const paddingLeft = depth * INDENT + 6;

  const content = (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(PRAGMA_PATH_MIME, node.path);
        event.dataTransfer.setData(PRAGMA_PATHS_MIME, JSON.stringify(targets));
        event.dataTransfer.effectAllowed = "copyMove";
      }}
      {...drop.handlers}
      className={cn(
        "group relative mx-1.5 my-px flex h-[calc(100%-2px)] items-center gap-1.5 rounded-md pr-2 text-ui-sm cursor-pointer select-none transition-colors",
        drop.over && "ring-1 ring-primary ring-inset",
        isActiveFile
          ? "bg-accent-subtle text-fg-default"
          : isSelected
            ? "bg-bg-hover text-fg-default"
            : "text-fg-muted hover:bg-bg-hover hover:text-fg-default",
      )}
      style={{ paddingLeft }}
      onClick={handleClick}
    >
      {Array.from({ length: depth }, (_, level) => (
        <span
          key={level}
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-px bg-border"
          style={{ left: level * INDENT + 12 }}
        />
      ))}
      {node.isDirectory ? (
        <>
          <span className="flex size-3 shrink-0 items-center justify-center text-fg-subtle">
            {isExpanded ? (
              <CaretDown size={12} weight="bold" />
            ) : (
              <CaretRight size={12} weight="bold" />
            )}
          </span>
          {showDirLoading ? (
            <Spinner size={14} className="animate-spin text-fg-muted" />
          ) : (
            <img
              src={getFolderIconPath(node.name, isExpanded)}
              alt=""
              className="size-3.5 shrink-0"
            />
          )}
        </>
      ) : (
        <span className="w-3 shrink-0" />
      )}

      {node.isDirectory ? null : (
        <img src={getFileIconPath(node.name)} alt="" className="size-3.5 shrink-0" />
      )}

      <span
        className={cn(
          "min-w-0 truncate",
          isActiveFile && "font-medium",
          decoration && DECORATION_TEXT[decoration.kind],
        )}
      >
        {node.name}
      </span>

      {decoration && (
        <span
          className={cn(
            "ml-auto shrink-0 font-mono text-ui-2xs font-semibold",
            DECORATION_TEXT[decoration.kind],
            "no-underline",
          )}
          title={decoration.kind}
        >
          {decoration.letter}
        </span>
      )}
      {!decoration && hasChanges && (
        <span
          aria-label="Contains changes"
          className="ml-auto size-1.5 shrink-0 rounded-full bg-git-modified/80"
        />
      )}

      {node.error && (
        <span className="ml-auto shrink-0 text-ui-xs text-status-error" title={node.error}>
          err
        </span>
      )}
    </div>
  );

  return (
    <div className="h-full">
      <ContextMenu>
        <ContextMenuTrigger className="block h-full">{content}</ContextMenuTrigger>
        <FileTreeContextMenu
          node={node}
          targets={targets}
          onOpen={activate}
          onCreate={(isDirectory) => setCreateDialog({ open: true, isDirectory })}
          onRename={() => setRenameOpen(true)}
          onDelete={() => setDeleteTargets(targets)}
          onShowLocalHistory={handleShowLocalHistory}
        />
      </ContextMenu>

      <InputDialog
        open={createDialog.open}
        onOpenChange={(open) => setCreateDialog((prev) => ({ ...prev, open }))}
        title={createDialog.isDirectory ? "New Folder" : "New File"}
        description={`Create a new ${createDialog.isDirectory ? "folder" : "file"} in ${node.name}.`}
        label="Name"
        confirmLabel="Create"
        onConfirm={handleCreateConfirm}
      />

      <InputDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="Rename"
        description={`Rename ${node.name} to:`}
        label="New name"
        defaultValue={node.name}
        confirmLabel="Rename"
        onConfirm={handleRenameConfirm}
      />

      <AlertDialog
        open={deleteTargets !== null}
        onOpenChange={(open) => !open && setDeleteTargets(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTargets && deleteTargets.length > 1
                ? `Delete ${deleteTargets.length} Items`
                : `Delete ${node.isDirectory ? "Folder" : "File"}`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTargets && deleteTargets.length > 1
                ? `Are you sure you want to delete ${deleteTargets.length} items? This cannot be undone.`
                : `Are you sure you want to delete "${node.name}"? This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
