import { useState } from "react";
import { FolderOpen, Spinner } from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/button";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from "@/shared/components/ui/context-menu";
import { InputDialog } from "@/shared/components/ui/input-dialog";
import { useFileExplorer } from "@/shared/hooks/useFileExplorer";
import { useLocalHistory } from "@/shared/hooks/useLocalHistory";
import { FileTreeNode } from "./FileTreeNode";

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

  const [createDialog, setCreateDialog] = useState<{
    open: boolean;
    isDirectory: boolean;
  }>({ open: false, isDirectory: false });

  const handleCreateConfirm = (name: string) => {
    if (!rootPath || !name) return;
    void createNode(rootPath, name, createDialog.isDirectory);
  };

  const openCreateFile = () => setCreateDialog({ open: true, isDirectory: false });
  const openCreateFolder = () => setCreateDialog({ open: true, isDirectory: true });

  if (!rootPath) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
        <p className="text-ui-sm text-fg-muted">No folder open</p>
        <Button variant="outline" size="sm" onClick={selectRoot} className="gap-2">
          <FolderOpen size={16} />
          Open Folder
        </Button>
      </div>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
            <span className="truncate text-ui-xs font-semibold text-fg-default" title={rootPath}>
              {rootName}
            </span>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size={20} className="animate-spin text-fg-muted" />
              </div>
            ) : (
              <div className="py-1">
                {tree.map((node) => (
                  <FileTreeNode
                    key={node.path}
                    node={node}
                    depth={0}
                    expandedDirs={expandedDirs}
                    selectedPath={selectedPath}
                    onToggleDir={toggleDirectory}
                    onOpenFile={openFileByPath}
                    onCreate={createNode}
                    onRename={renameNode}
                    onDelete={deleteNode}
                    onShowLocalHistory={openPanel}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={openCreateFile}>New File</ContextMenuItem>
        <ContextMenuItem onClick={openCreateFolder}>New Folder</ContextMenuItem>
        <ContextMenuItem onClick={selectRoot}>Open Different Folder</ContextMenuItem>
      </ContextMenuContent>
      <InputDialog
        open={createDialog.open}
        onOpenChange={(open) => setCreateDialog((prev) => ({ ...prev, open }))}
        title={createDialog.isDirectory ? "New Folder" : "New File"}
        description={`Create a new ${createDialog.isDirectory ? "folder" : "file"} in the project root.`}
        label="Name"
        confirmLabel="Create"
        onConfirm={handleCreateConfirm}
      />
    </ContextMenu>
  );
}
