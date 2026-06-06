import { useState, useCallback } from "react";
import { X } from "@phosphor-icons/react";
import { getFileIcon } from "@/lib/file-icons";
import { useEditorStore } from "@/stores/editor";
import { cn } from "@/lib/utils";

export function TabBar() {
  const { openFiles, activeTabId, setActiveTab, closeFile, reorderTabs } = useEditorStore();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggedIndex !== null && draggedIndex !== index) {
        setDragOverIndex(index);
      }
    },
    [draggedIndex],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      if (draggedIndex !== null) {
        reorderTabs(draggedIndex, targetIndex);
      }
      setDraggedIndex(null);
      setDragOverIndex(null);
    },
    [draggedIndex, reorderTabs],
  );

  if (openFiles.length === 0) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-1 overflow-x-auto">
      {openFiles.map((file, index) => {
        const isActive = activeTabId === file.id;
        const Icon = getFileIcon(file.name);
        const isDropTarget = dragOverIndex === index;

        return (
          <div
            key={file.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            className={cn(
              "group flex shrink-0 cursor-pointer items-center gap-2 border-r border-border px-3 py-2 text-xs transition-colors select-none",
              isActive
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              isDropTarget && draggedIndex !== index && "bg-primary/10",
            )}
            onClick={() => setActiveTab(file.id)}
          >
            <Icon size={14} className="shrink-0 text-muted-foreground" />
            <span className="max-w-[140px] truncate">{file.name}</span>
            {file.isModified && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeFile(file.id);
              }}
              className={cn(
                "ml-0.5 shrink-0 rounded-sm p-0.5 text-muted-foreground transition-opacity hover:text-foreground",
                isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
              )}
              aria-label={`Close ${file.name}`}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
