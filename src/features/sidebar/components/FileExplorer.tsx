import { FolderOpen, Spinner } from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/button";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from "@/shared/components/ui/context-menu";
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

  const handleCreateFile = () => {
    if (!rootPath) return;
    const name = window.prompt("New file name:");
    if (name?.trim()) void createNode(rootPath, name.trim(), false);
  };

  const handleCreateFolder = () => {
    if (!rootPath) return;
    const name = window.prompt("New folder name:");
    if (name?.trim()) void createNode(rootPath, name.trim(), true);
  };

  if (!rootPath) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
        <p className="text-sm text-muted-foreground">No folder open</p>
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
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
            <span className="text-xs font-semibold text-foreground truncate" title={rootPath}>
              {rootName}
            </span>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size={20} className="animate-spin text-muted-foreground" />
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
        <ContextMenuItem onClick={handleCreateFile}>New File</ContextMenuItem>
        <ContextMenuItem onClick={handleCreateFolder}>New Folder</ContextMenuItem>
        <ContextMenuItem onClick={selectRoot}>Open Different Folder</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
