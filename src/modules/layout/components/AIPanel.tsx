import { useEffect } from "react";
import { useLayoutStore } from "../store";
import { Robot, X } from "@phosphor-icons/react";
import { ChatPanel } from "@/components/chat/ChatPanel";

export function AIPanel() {
  const { setAIPanelOpen } = useLayoutStore();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setAIPanelOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setAIPanelOpen]);

  return (
    <div className="flex h-full flex-col bg-card border-l border-border/60">
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

      <div className="flex-1 min-h-0 overflow-hidden">
        <ChatPanel />
      </div>
    </div>
  );
}
