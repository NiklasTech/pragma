import { useCallback, useRef, useState, type ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

interface FloatingWindowProps {
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  title: ReactNode;
  onMove: (x: number, y: number) => void;
  onResize: (width: number, height: number) => void;
  onClose?: () => void;
  className?: string;
  children: ReactNode;
}

export function FloatingWindow({
  x,
  y,
  width,
  height,
  minWidth = 320,
  minHeight = 240,
  title,
  onMove,
  onResize,
  onClose,
  className,
  children,
}: FloatingWindowProps) {
  const windowRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
      e.preventDefault();
      setIsDragging(true);

      const startX = e.clientX;
      const startY = e.clientY;
      const startPosX = x;
      const startPosY = y;

      const handleMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        onMove(startPosX + dx, startPosY + dy);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [x, y, onMove],
  );

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);

      const startX = e.clientX;
      const startY = e.clientY;
      const startW = width;
      const startH = height;

      const handleMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        onResize(Math.max(minWidth, startW + dx), Math.max(minHeight, startH + dy));
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [width, height, minWidth, minHeight, onResize],
  );

  return (
    <div
      ref={windowRef}
      className={cn(
        "fixed z-50 flex flex-col overflow-hidden rounded-lg border border-border/60 bg-bg-elevated shadow-xl",
        isDragging && "cursor-grabbing select-none",
        isResizing && "select-none",
        className,
      )}
      style={{
        left: x,
        top: y,
        width,
        height,
      }}
    >
      <div
        className="flex shrink-0 items-center gap-2 px-3 py-2 border-b border-border/60 cursor-grab active:cursor-grabbing"
        onMouseDown={handleDragStart}
      >
        {title}
        {onClose && (
          <button
            type="button"
            data-no-drag
            onClick={onClose}
            className="ml-auto rounded p-1 text-fg-muted hover:bg-bg-hover hover:text-fg-default transition-colors"
            aria-label="Close"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path
                d="M1 1L11 11M11 1L1 11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>

      <div
        className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
        onMouseDown={handleResizeStart}
        aria-hidden="true"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className="absolute bottom-1 right-1 text-fg-muted/50"
        >
          <path
            d="M8 11L11 11L11 8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path d="M4 11L11 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
