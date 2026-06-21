import { X } from "@phosphor-icons/react";
import { cn } from "@/shared/lib/utils";
import { useTerminalStore, type TerminalSession } from "@/shared/stores/terminal";

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
    <div className="flex h-tab items-center gap-1 overflow-x-auto border-b border-border/60 bg-bg-surface px-2">
      {sessions.map((session) => {
        const isActive = session.id === activeSessionId;
        return (
          <div
            key={session.id}
            data-active={isActive}
            onClick={() => setActiveSession(session.id)}
            className={cn("pragma-pill-tab group cursor-default", isActive && "data-active=true")}
          >
            <span className="max-w-[140px] truncate">{session.name}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeSession(session.id);
              }}
              className="ml-0.5 rounded-sm p-0.5 text-fg-muted opacity-0 transition-opacity hover:text-fg-default group-hover:opacity-100"
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
