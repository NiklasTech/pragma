import { useCallback, useState, type ReactNode } from "react";
import { CaretRight, CaretDown, Spinner } from "@phosphor-icons/react";
import { cn } from "@/shared/lib/utils";
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
import { RepositoryColorDot } from "@/shared/components/RepositoryColorDot";
import { splitExtension } from "@/features/sidebar/lib/extensionTint";
import type { TreeGuide } from "@/features/sidebar/lib/treeGuides";

const INDENT = 14;
// Center of the caret column, where a folder's line to its children runs.
const LINE_X = 13;

const DECORATION_TEXT: Record<GitDecorationKind, string> = {
  added: "text-git-added",
  untracked: "text-git-untracked",
  modified: "text-git-modified",
  deleted: "text-git-deleted",
  conflict: "text-status-error",
};

interface FileTreeNodeProps {
  node: FileSystemNode;
  depth: number;
  guide: TreeGuide;
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
  /** Shown before the git letter, for example the agent that changed the file. */
  changeMark?: ReactNode;
  hasChanges?: boolean;
}

export function FileTreeNode({
  node,
  depth,
  guide,
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
  changeMark,
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
      // A repository folder never joins a selection, so it cannot be deleted or moved with it.
      if (!node.repositoryRoot && (event.metaKey || event.ctrlKey)) {
        onMultiSelect(node.path, "toggle");
        return;
      }
      if (!node.repositoryRoot && event.shiftKey) {
        onMultiSelect(node.path, "range");
        return;
      }
      useFileSelectionStore.getState().reset(node.path);
      activate();
    },
    [node.path, node.repositoryRoot, onMultiSelect, activate],
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

  const paddingLeft = depth * INDENT + 8;
  const ownLineX = (depth - 1) * INDENT + LINE_X;
  const nameParts = splitExtension(node.name);
  const lineClass = "pointer-events-none absolute w-px bg-fg-default/15";

  const content = (
    <div
      draggable={!node.repositoryRoot}
      onDragStart={(event) => {
        event.dataTransfer.setData(PRAGMA_PATH_MIME, node.path);
        event.dataTransfer.setData(PRAGMA_PATHS_MIME, JSON.stringify(targets));
        event.dataTransfer.effectAllowed = "copyMove";
      }}
      {...drop.handlers}
      className={cn(
        "group relative mx-1.5 flex h-full items-center gap-1.5 rounded-[4px] pr-2 font-mono text-ui-xs cursor-pointer select-none transition-colors",
        drop.over && "ring-1 ring-primary ring-inset",
        isActiveFile
          ? "bg-primary/10 text-fg-default"
          : isSelected
            ? "bg-bg-hover text-fg-default"
            : "text-fg-muted hover:bg-bg-hover hover:text-fg-default",
      )}
      style={{ paddingLeft }}
      onClick={handleClick}
    >
      {isActiveFile && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-1 left-0 w-0.5 rounded-full bg-primary"
        />
      )}
      {guide.through.map((through, index) =>
        through ? (
          <span
            key={index}
            aria-hidden="true"
            className={cn(lineClass, "inset-y-0")}
            style={{ left: index * INDENT + LINE_X }}
          />
        ) : null,
      )}
      {depth > 0 && (
        <>
          <span
            aria-hidden="true"
            className={cn(
              lineClass,
              "top-0",
              guide.last ? "h-1/2" : "bottom-0",
              isActiveFile && "bg-primary/70",
            )}
            style={{ left: ownLineX }}
          />
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute top-1/2 h-px bg-fg-default/15",
              isActiveFile && "bg-primary/70",
            )}
            style={{ left: ownLineX, width: paddingLeft - ownLineX + (node.isDirectory ? -2 : 12) }}
          />
        </>
      )}
      <span className="flex w-2.5 shrink-0 items-center justify-center text-fg-subtle">
        {node.isDirectory &&
          (showDirLoading ? (
            <Spinner size={11} className="animate-spin" />
          ) : isExpanded ? (
            <CaretDown size={9} weight="fill" />
          ) : (
            <CaretRight size={9} weight="fill" />
          ))}
      </span>

      {node.repositoryRoot && <RepositoryColorDot path={node.path} />}
      {node.isDirectory ? (
        <span className="min-w-0 truncate text-fg-default">
          {node.name}
          <span className="text-fg-subtle">/</span>
        </span>
      ) : (
        <span
          className={cn(
            "min-w-0 truncate",
            isActiveFile && "text-fg-default",
            decoration && DECORATION_TEXT[decoration.kind],
            decoration?.kind === "deleted" && "line-through",
          )}
        >
          {decoration ? (
            node.name
          ) : (
            <>
              {nameParts.base}
              {nameParts.ext && <span className={nameParts.tint}>{nameParts.ext}</span>}
            </>
          )}
        </span>
      )}

      {changeMark && <span className="ml-auto flex shrink-0 items-center">{changeMark}</span>}
      {decoration && (
        <span
          className={cn(
            "inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] bg-current/15 text-[10px] font-bold",
            !changeMark && "ml-auto",
            DECORATION_TEXT[decoration.kind],
          )}
          title={decoration.kind}
        >
          {decoration.letter}
        </span>
      )}
      {!decoration && hasChanges && (
        <span
          aria-label="Contains changes"
          className="ml-auto size-1.5 shrink-0 rounded-[1px] bg-git-modified/80"
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
