import { useCallback } from "react";
import { cn } from "@/shared/lib/utils";
import { useLayoutStore } from "../store";
import { FloatingWindow } from "./FloatingWindow";
import { ChatPanel } from "@/features/ai/components/ChatPanel";

function ResizeHandle({
  className,
  onResize,
}: {
  className?: string;
  onResize: (delta: number) => void;
}) {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;

    const handleMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      onResize(dx + dy);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      className={cn("absolute z-10 hover:bg-primary/20", className)}
      onMouseDown={handleMouseDown}
      aria-hidden="true"
    />
  );
}

export function AIChatHost() {
  const { ai, setAIMode, setAIFloating, setAISize } = useLayoutStore();

  const handleMove = useCallback(
    (x: number, y: number) => {
      setAIFloating({ x, y });
    },
    [setAIFloating],
  );

  const handleResize = useCallback(
    (width: number, height: number) => {
      setAIFloating({ width, height });
    },
    [setAIFloating],
  );

  if (ai.mode === "hidden") return null;

  if (ai.mode === "floating") {
    return (
      <FloatingWindow
        x={ai.floating.x}
        y={ai.floating.y}
        width={ai.floating.width}
        height={ai.floating.height}
        minWidth={300}
        minHeight={360}
        title={<span />}
        onMove={handleMove}
        onResize={handleResize}
        onClose={() => setAIMode("hidden")}
        className="rounded-2xl border-border/60 bg-bg-surface shadow-2xl"
      >
        <ChatPanel />
      </FloatingWindow>
    );
  }

  if (ai.mode === "drawer-left" || ai.mode === "drawer-right") {
    const isLeft = ai.mode === "drawer-left";
    return (
      <div
        className={cn(
          "relative flex h-full shrink-0 flex-col border-border/60 bg-bg-surface",
          isLeft ? "border-r" : "border-l",
        )}
        style={{ width: ai.size }}
      >
        <ResizeHandle
          className={cn("top-0 bottom-0 w-1 cursor-ew-resize", isLeft ? "right-0" : "left-0")}
          onResize={(delta) => setAISize(ai.size + (isLeft ? delta : -delta))}
        />
        <div className="flex-1 min-h-0 overflow-hidden">
          <ChatPanel />
        </div>
      </div>
    );
  }

  // bottom-sheet
  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-40 flex flex-col border-t border-border/60 bg-bg-surface"
      style={{ height: ai.size }}
    >
      <ResizeHandle
        className="left-0 right-0 top-0 h-1 cursor-ns-resize"
        onResize={(delta) => setAISize(ai.size + delta)}
      />
      <div className="flex-1 min-h-0 overflow-hidden">
        <ChatPanel />
      </div>
    </div>
  );
}
