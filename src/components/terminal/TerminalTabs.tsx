import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useTerminalStore, type TerminalSession } from "@/stores/terminal";

interface TerminalTabsProps {
  sessions: TerminalSession[];
  activeSessionId: string | null;
}

export function TerminalTabs({ sessions, activeSessionId }: TerminalTabsProps) {
  const { setActiveSession, removeSession } = useTerminalStore();

  if (sessions.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-0.5 border-b border-border/60 bg-card px-2 py-1 overflow-x-auto">
      {sessions.map((session) => {
        const isActive = session.id === activeSessionId;
        return (
          <div
            key={session.id}
            className={cn(
              "group flex items-center gap-1.5 rounded px-2 py-1 text-[11px] transition-colors cursor-default select-none",
              isActive
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
            onClick={() => setActiveSession(session.id)}
          >
            <span className="truncate max-w-[140px]">{session.name}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeSession(session.id);
              }}
              className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent"
              aria-label={`Close ${session.name}`}
            >
              <X size={10} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
