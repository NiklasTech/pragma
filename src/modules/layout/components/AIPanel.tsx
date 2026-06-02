import { useEffect, useRef, useCallback } from "react";
import { useLayoutStore } from "../store";
import { cn } from "@/lib/utils";
import { ChatCircle, Robot, X } from "@phosphor-icons/react";

export function AIPanel() {
  const { aiPanelOpen, aiPanelWidth, setAIPanelOpen, setAIPanelWidth } = useLayoutStore();
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const isResizing = useRef(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        useLayoutStore.getState().toggleAIPanel();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && aiPanelOpen) {
        setAIPanelOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [aiPanelOpen, setAIPanelOpen]);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizing.current = true;
      resizeStartX.current = e.clientX;
      resizeStartWidth.current = useLayoutStore.getState().aiPanelWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isResizing.current) return;
        const delta = resizeStartX.current - moveEvent.clientX;
        const newWidth = resizeStartWidth.current + delta;
        setAIPanelWidth(newWidth);
      };

      const handleMouseUp = () => {
        isResizing.current = false;
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [setAIPanelWidth],
  );

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 bg-black/30 z-40 transition-opacity duration-200",
          aiPanelOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        onClick={() => setAIPanelOpen(false)}
      />

      <div
        className={cn(
          "fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-card border-l border-border/60 shadow-2xl",
          "transition-transform duration-200 ease-out",
          aiPanelOpen ? "translate-x-0" : "translate-x-full",
        )}
        style={{ width: aiPanelWidth }}
      >
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors z-10"
          onMouseDown={handleResizeStart}
          title="Resize"
        />

        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/60 shrink-0">
          <Robot size={16} className="text-primary shrink-0" />
          <span className="text-sm font-semibold truncate">AI Assistant</span>
          <button
            onClick={() => setAIPanelOpen(false)}
            className="ml-auto p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
            title="Close (Esc)"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 min-h-0 p-4 overflow-auto">
          <div className="flex items-start gap-3">
            <div className="mt-1 p-1.5 rounded-full bg-primary/10 shrink-0">
              <ChatCircle size={14} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">Pragma AI</p>
              <p className="text-sm text-muted-foreground mt-1">How can I help you today?</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
