import { cn } from "@/shared/lib/utils";
import { useLayoutStore } from "../store";
import { hasMountedAIPanel } from "../aiPlacement";
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

    const handleMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      onResize(dx);
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

/// The AI panel is an optional editor dock. Floating and bottom-sheet modes are
/// no longer first-class, so any stored placement renders as the right drawer.
export function AIChatHost() {
  const { ai, root, floating, setAISize } = useLayoutStore();

  // The AI panel is already docked, floated or tabbed, so the host must not render ChatPanel again.
  if (hasMountedAIPanel({ root, floating })) return null;

  if (ai.mode === "hidden") return null;

  const isLeft = ai.mode === "drawer-left";

  return (
    <div
      className={cn(
        "relative flex h-full shrink-0 flex-col border-border bg-bg-surface",
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
