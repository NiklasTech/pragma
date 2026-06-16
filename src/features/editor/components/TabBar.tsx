import { useState, useCallback } from "react";
import { X, GitDiff } from "@phosphor-icons/react";
import { getFileIcon } from "@/shared/lib/file-icons";
import { useEditorStore } from "@/shared/stores/editor";
import { cn } from "@/shared/lib/utils";

interface TabBarProps {
  panelId?: string;
}

export function TabBar({ panelId }: TabBarProps) {
  const { tabs, getPanelActiveTabId, setActiveTab, setPanelActiveTab, closeTab, reorderTabs } =
    useEditorStore();
  const activeTabId = getPanelActiveTabId(panelId ?? null);
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
    <div className="flex h-tab min-w-0 shrink-0 items-center gap-1 overflow-x-auto border-b border-border/60 bg-bg-surface px-2">
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
            onClick={() => (panelId ? setPanelActiveTab(panelId, tab.id) : setActiveTab(tab.id))}
            title={tab.name}
            data-active={isActive}
            className={cn(
              "pragma-pill-tab group relative max-w-[180px] cursor-pointer",
              isDropTarget && draggedIndex !== index && "bg-accent-subtle",
            )}
          >
            <Icon
              size={13}
              className={cn(
                "shrink-0",
                tab.kind === "diff"
                  ? "text-status-success"
                  : "text-fg-muted group-hover:text-fg-default data-[active=true]:text-fg-default",
              )}
            />
            <span className="min-w-0 flex-1 truncate">{tab.name}</span>
            {tab.kind === "file" && tab.isModified && (
              <span className="size-1.5 shrink-0 rounded-full bg-primary" />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className={cn(
                "ml-0.5 shrink-0 rounded-sm p-0.5 text-fg-muted transition-opacity hover:text-fg-default",
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
