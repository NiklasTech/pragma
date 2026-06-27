import { useCallback, useState } from "react";
import {
  CaretRight,
  CaretDown,
  Spinner,
  ClockCounterClockwise,
  File,
  FolderPlus,
  PencilSimple,
  Trash,
} from "@phosphor-icons/react";
import { cn } from "@/shared/lib/utils";
import { getFileIconPath } from "@/shared/lib/file-icons";
import { getFolderIconPath } from "@/shared/lib/folder-icons";
import { useEditorStore } from "@/shared/stores/editor";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/shared/components/ui/context-menu";
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

  const [createDialog, setCreateDialog] = useState<{ open: boolean; isDirectory: boolean }>({
    open: false,
    isDirectory: false,
  });
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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
    onDelete(node.path);
    setDeleteOpen(false);
  }, [node.path, onDelete]);

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
              <ContextMenuItem onClick={() => setCreateDialog({ open: true, isDirectory: false })}>
                <File size={14} />
                <span>New File</span>
              </ContextMenuItem>
              <ContextMenuItem onClick={() => setCreateDialog({ open: true, isDirectory: true })}>
                <FolderPlus size={14} />
                <span>New Folder</span>
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => setRenameOpen(true)}>
                <PencilSimple size={14} />
                <span>Rename</span>
              </ContextMenuItem>
              <ContextMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash size={14} />
                <span>Delete</span>
              </ContextMenuItem>
            </>
          ) : (
            <>
              <ContextMenuItem onClick={handleClick}>
                <File size={14} />
                <span>Open</span>
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={handleShowLocalHistory}>
                <ClockCounterClockwise size={14} />
                <span>Local History</span>
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => setRenameOpen(true)}>
                <PencilSimple size={14} />
                <span>Rename</span>
              </ContextMenuItem>
              <ContextMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash size={14} />
                <span>Delete</span>
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
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

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {node.isDirectory ? "Folder" : "File"}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{node.name}&quot;? This cannot be undone.
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
