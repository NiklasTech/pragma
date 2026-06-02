import { useEffect } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { useLayoutStore } from "@/stores/layout";
import { CaretRight, ChatCircle, Robot } from "@phosphor-icons/react";

export function AIChatPanel({
  panelRef,
}: {
  panelRef: React.RefObject<PanelImperativeHandle | null>;
}) {
  const { aiPanelWidth } = useLayoutStore();

  const isCollapsed = aiPanelWidth <= 10;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        panelRef.current?.resize(isCollapsed ? 25 : 8);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCollapsed, panelRef]);

  const handleToggle = () => {
    panelRef.current?.resize(isCollapsed ? 25 : 8);
  };

  if (isCollapsed) {
    return (
      <div className="flex h-full flex-col items-center bg-card border-l border-border py-2">
        <button
          onClick={handleToggle}
          className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Expand AI Panel (Ctrl+Shift+A)"
        >
          <CaretRight size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-card border-l border-border">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <Robot size={16} className="text-primary shrink-0" />
        <span className="text-sm font-semibold truncate">AI Assistant</span>
        <button
          onClick={handleToggle}
          className="ml-auto p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
          title="Collapse AI Panel (Ctrl+Shift+A)"
        >
          <CaretRight size={16} />
        </button>
      </div>
      <div className="flex-1 p-4 overflow-auto">
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
  );
}
