import { useCallback } from "react";
import { ClockCounterClockwise, Trash, ChatCircle } from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAIStore } from "@/stores/ai";
import { cn } from "@/lib/utils";

function formatSessionDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return "Yesterday";
  }

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getSessionPreview(session: {
  messages: Array<{ role: string; content: string }>;
}): string {
  const firstUserMsg = session.messages.find((m) => m.role === "user");
  if (firstUserMsg) {
    return firstUserMsg.content.slice(0, 60) + (firstUserMsg.content.length > 60 ? "..." : "");
  }
  return "No messages yet";
}

export function ChatSessionList() {
  const { chatSessions, activeChatSessionId, setActiveChatSession, removeChatSession } =
    useAIStore();

  const handleSelect = useCallback(
    (sessionId: string) => {
      setActiveChatSession(sessionId);
    },
    [setActiveChatSession],
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation();
      removeChatSession(sessionId);
    },
    [removeChatSession],
  );

  const otherSessions = chatSessions.filter((s) => s.id !== activeChatSessionId);

  return (
    <Popover>
      <PopoverTrigger
        className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
        title="Chat History"
      >
        <ClockCounterClockwise size={14} />
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-64 p-0">
        <div className="px-3 py-2 border-b border-border/40">
          <span className="text-xs font-medium text-foreground">Chat History</span>
          <span className="text-[11px] text-muted-foreground ml-1.5">
            {chatSessions.length} session{chatSessions.length !== 1 ? "s" : ""}
          </span>
        </div>

        {otherSessions.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
            No other sessions. Start a new chat to create one.
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto py-1">
            {otherSessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  "group w-full flex items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-accent cursor-pointer",
                  session.id === activeChatSessionId && "bg-accent/50",
                )}
                onClick={() => handleSelect(session.id)}
              >
                <ChatCircle size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-medium truncate">{session.title}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatSessionDate(session.updatedAt)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {getSessionPreview(session)}
                  </p>
                </div>
                <button
                  onClick={(e) => handleDelete(e, session.id)}
                  className="mt-0.5 p-1 rounded-sm hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
                  title="Delete session"
                >
                  <Trash size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
