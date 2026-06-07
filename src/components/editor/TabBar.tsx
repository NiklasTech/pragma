import { useState, useCallback } from "react";
import { X, GitDiff } from "@phosphor-icons/react";
import { getFileIcon } from "@/lib/file-icons";
import { useEditorStore } from "@/stores/editor";
import { cn } from "@/lib/utils";

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab, reorderTabs } = useEditorStore();
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

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-1 overflow-x-auto">
      {tabs.map((tab, index) => {
        const isActive = activeTabId === tab.id;
        const isDropTarget = dragOverIndex === index;

        const Icon = tab.kind === "diff" ? GitDiff : getFileIcon(tab.name);

        return (
          <div
            key={tab.id}
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
            onClick={() => setActiveTab(tab.id)}
          >
            <Icon
              size={14}
              className={cn(
                "shrink-0",
                tab.kind === "diff" ? "text-emerald-400" : "text-muted-foreground",
              )}
            />
            <span className="max-w-[140px] truncate">{tab.name}</span>
            {tab.kind === "file" && tab.isModified && (
              <span className="size-1.5 shrink-0 rounded-full bg-primary" />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className={cn(
                "ml-0.5 shrink-0 rounded-sm p-0.5 text-muted-foreground transition-opacity hover:text-foreground",
                isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
              )}
              aria-label={`Close ${tab.name}`}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
