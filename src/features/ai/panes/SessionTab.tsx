import type { ReactNode } from "react";
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import { X } from "@phosphor-icons/react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
} from "@/shared/components/ui/context-menu";
import { cn } from "@/shared/lib/utils";

interface SessionTabProps {
  title: string;
  icon?: ReactNode;
  showTitle?: boolean;
  isActive: boolean;
  canCloseOthers: boolean;
  canCloseToRight: boolean;
  onSelect: () => void;
  onClose: () => void;
  onCloseOthers: () => void;
  onCloseToRight: () => void;
  isDragging: boolean;
  dropIndicator: "before" | "after" | null;
  onDragStart: (event: React.DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}

export function SessionTab({
  title,
  icon,
  showTitle = true,
  isActive,
  canCloseOthers,
  canCloseToRight,
  onSelect,
  onClose,
  onCloseOthers,
  onCloseToRight,
  isDragging,
  dropIndicator,
  onDragStart,
  onDragEnd,
}: SessionTabProps) {
  return (
    <ContextMenu>
      <ContextMenuPrimitive.Trigger
        render={(props) => (
          <button
            {...props}
            type="button"
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={onSelect}
            onAuxClick={(event) => {
              props.onAuxClick?.(event);
              if (event.button === 1) {
                event.preventDefault();
                onClose();
              }
            }}
            title={title}
            aria-label={showTitle ? undefined : title}
            data-active={isActive}
            data-session-tab=""
            className={cn(
              props.className,
              "pragma-pill-tab relative max-w-[180px] px-2.5",
              showTitle ? "min-w-12 shrink" : "shrink-0",
              isDragging && "opacity-50",
              dropIndicator === "before" &&
                "before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-primary",
              dropIndicator === "after" &&
                "after:absolute after:inset-y-1 after:right-0 after:w-0.5 after:rounded-full after:bg-primary",
            )}
          >
            {icon}
            {showTitle && <span className="truncate">{title}</span>}
          </button>
        )}
      />
      <ContextMenuContent className="w-44">
        <ContextMenuItem onClick={onClose}>
          <X size={14} />
          <span>Close</span>
        </ContextMenuItem>
        <ContextMenuItem disabled={!canCloseOthers} onClick={onCloseOthers}>
          <span>Close Others</span>
        </ContextMenuItem>
        <ContextMenuItem disabled={!canCloseToRight} onClick={onCloseToRight}>
          <span>Close to the Right</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
