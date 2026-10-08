import {
  At,
  ClockCounterClockwise,
  Copy,
  CopySimple,
  File,
  Files,
  FolderOpen,
  FolderPlus,
  PencilSimple,
  TerminalWindow,
  Trash,
} from "@phosphor-icons/react";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/shared/components/ui/context-menu";
import { getIsMac } from "@/shared/lib/shortcuts";
import type { FileSystemNode } from "@/shared/stores/fileExplorer";
import {
  addPathsToChat,
  copyPaths,
  duplicatePath,
  openInTerminal,
  revealInFileManager,
} from "@/features/sidebar/lib/fileTreeActions";

const REVEAL_LABEL = getIsMac()
  ? "Reveal in Finder"
  : typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent)
    ? "Reveal in Explorer"
    : "Reveal in File Manager";

interface FileTreeContextMenuProps {
  node: FileSystemNode;
  /** Paths the menu acts on: the multi-selection when the node is part of it. */
  targets: string[];
  onOpen: () => void;
  onCreate: (isDirectory: boolean) => void;
  onRename: () => void;
  onDelete: () => void;
  onShowLocalHistory: () => void;
}

export function FileTreeContextMenu({
  node,
  targets,
  onOpen,
  onCreate,
  onRename,
  onDelete,
  onShowLocalHistory,
}: FileTreeContextMenuProps) {
  if (targets.length > 1) {
    return (
      <ContextMenuContent className="w-52">
        <ContextMenuItem onClick={() => void addPathsToChat(targets)}>
          <At size={14} />
          <span>Add {targets.length} Items to Chat</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => void copyPaths(targets, false)}>
          <Copy size={14} />
          <span>Copy Paths</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => void copyPaths(targets, true)}>
          <CopySimple size={14} />
          <span>Copy Relative Paths</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={onDelete}>
          <Trash size={14} />
          <span>Delete {targets.length} Items</span>
        </ContextMenuItem>
      </ContextMenuContent>
    );
  }

  return (
    <ContextMenuContent className="w-52">
      {node.isDirectory ? (
        <>
          <ContextMenuItem onClick={() => onCreate(false)}>
            <File size={14} />
            <span>New File</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onCreate(true)}>
            <FolderPlus size={14} />
            <span>New Folder</span>
          </ContextMenuItem>
        </>
      ) : (
        <ContextMenuItem onClick={onOpen}>
          <File size={14} />
          <span>Open</span>
        </ContextMenuItem>
      )}
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => void addPathsToChat([node.path])}>
        <At size={14} />
        <span>Add to Chat</span>
      </ContextMenuItem>
      {!node.isDirectory && (
        <ContextMenuItem onClick={onShowLocalHistory}>
          <ClockCounterClockwise size={14} />
          <span>Local History</span>
        </ContextMenuItem>
      )}
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => void copyPaths([node.path], false)}>
        <Copy size={14} />
        <span>Copy Path</span>
      </ContextMenuItem>
      <ContextMenuItem onClick={() => void copyPaths([node.path], true)}>
        <CopySimple size={14} />
        <span>Copy Relative Path</span>
      </ContextMenuItem>
      <ContextMenuItem onClick={() => void revealInFileManager(node.path)}>
        <FolderOpen size={14} />
        <span>{REVEAL_LABEL}</span>
      </ContextMenuItem>
      <ContextMenuItem onClick={() => openInTerminal(node.path, node.isDirectory)}>
        <TerminalWindow size={14} />
        <span>Open in Terminal</span>
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => void duplicatePath(node.path)}>
        <Files size={14} />
        <span>Duplicate</span>
      </ContextMenuItem>
      <ContextMenuItem onClick={onRename}>
        <PencilSimple size={14} />
        <span>Rename</span>
      </ContextMenuItem>
      <ContextMenuItem variant="destructive" onClick={onDelete}>
        <Trash size={14} />
        <span>Delete</span>
      </ContextMenuItem>
    </ContextMenuContent>
  );
}
