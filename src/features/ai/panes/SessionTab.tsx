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
  isActive: boolean;
  canCloseOthers: boolean;
  canCloseToRight: boolean;
  onSelect: () => void;
  onClose: () => void;
  onCloseOthers: () => void;
  onCloseToRight: () => void;
  onDragStart: (event: React.DragEvent<HTMLElement>) => void;
}

export function SessionTab({
  title,
  isActive,
  canCloseOthers,
  canCloseToRight,
  onSelect,
  onClose,
  onCloseOthers,
  onCloseToRight,
  onDragStart,
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
            onClick={onSelect}
            onAuxClick={(event) => {
              props.onAuxClick?.(event);
              if (event.button === 1) {
                event.preventDefault();
                onClose();
              }
            }}
            title={title}
            data-active={isActive}
            className={cn(props.className, "pragma-pill-tab max-w-[180px] shrink-0 px-2.5")}
          >
            <span className="truncate">{title}</span>
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
