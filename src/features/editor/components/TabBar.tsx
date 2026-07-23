import { useState, useCallback } from "react";
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import { GitDiff, X } from "@phosphor-icons/react";
import { getFileIconPath } from "@/shared/lib/file-icons";
import { useEditorStore } from "@/shared/stores/editor";
import { cn } from "@/shared/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/shared/components/ui/context-menu";

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

  const handleCloseTab = useCallback(
    (tabId: string) => (e?: React.MouseEvent | React.KeyboardEvent) => {
      e?.stopPropagation();
      closeTab(tabId);
    },
    [closeTab],
  );

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="my-1 flex h-tab min-w-0 shrink-0 items-center gap-1.5 overflow-x-auto px-2">
      {tabs.map((tab, index) => {
        const isActive = activeTabId === tab.id;
        const isDropTarget = dragOverIndex === index;
        const fileIconPath = tab.kind === "file" ? getFileIconPath(tab.name) : null;

        const handleCloseOthers = () => {
          tabs.forEach((t) => {
            if (t.id !== tab.id) closeTab(t.id);
          });
        };

        const handleCloseToRight = () => {
          for (let i = index + 1; i < tabs.length; i++) {
            closeTab(tabs[i].id);
          }
        };

        const handleCloseAll = () => {
          tabs.forEach((t) => closeTab(t.id));
        };

        const handleActivate = () => {
          if (panelId) {
            setPanelActiveTab(panelId, tab.id);
          } else {
            setActiveTab(tab.id);
          }
        };

        return (
          <ContextMenu key={tab.id}>
            <ContextMenuPrimitive.Trigger
              render={(props) => (
                <div
                  {...props}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onClick={() => handleActivate()}
                  onAuxClick={(e) => {
                    props.onAuxClick?.(e);
                    if (e.button === 1) {
                      e.preventDefault();
                      closeTab(tab.id);
                    }
                  }}
                  title={tab.name}
                  data-active={isActive}
                  className={cn(
                    props.className,
                    "pragma-pill-tab group relative max-w-[180px] cursor-pointer",
                    isDropTarget && draggedIndex !== index && "bg-accent-subtle",
                  )}
                >
                  {tab.kind === "diff" ? (
                    <GitDiff size={16} className="shrink-0 text-status-success" />
                  ) : (
                    <img src={fileIconPath ?? undefined} alt="" className="size-4 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{tab.name}</span>
                  {tab.kind === "file" && tab.isModified && (
                    <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                  )}
                  <button
                    onClick={handleCloseTab(tab.id)}
                    className={cn(
                      "ml-0.5 shrink-0 rounded-sm p-0.5 text-fg-muted transition-opacity hover:text-fg-default",
                      isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                    )}
                    aria-label={`Close ${tab.name}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            />
            <ContextMenuContent className="w-48">
              <ContextMenuItem onClick={() => closeTab(tab.id)}>
                <X size={14} />
                <span>Close</span>
              </ContextMenuItem>
              <ContextMenuItem onClick={handleCloseOthers}>
                <span>Close Others</span>
              </ContextMenuItem>
              <ContextMenuItem onClick={handleCloseToRight}>
                <span>Close to the Right</span>
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={handleCloseAll}>
                <span>Close All</span>
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
    </div>
  );
}
