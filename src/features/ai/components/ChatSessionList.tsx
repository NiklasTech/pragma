"use client";

import { useCallback, useState } from "react";
import { ClockCounterClockwise, Trash, ChatCircle, Warning } from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/components/ui/alert-dialog";
import { useAIStore } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { cn } from "@/shared/lib/utils";

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
  const { chatSessions, activeChatSessionId, setActiveChatSession, deleteSession } = useAIStore();
  const rootPath = useFileExplorerStore((state) => state.rootPath) ?? "default";
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  const handleSelect = useCallback(
    (sessionId: string) => {
      setActiveChatSession(sessionId);
    },
    [setActiveChatSession],
  );

  const handleConfirmDelete = useCallback(() => {
    if (sessionToDelete) {
      void deleteSession(rootPath, sessionToDelete);
      setSessionToDelete(null);
    }
  }, [deleteSession, rootPath, sessionToDelete]);

  const sessionToDeleteTitle = chatSessions.find((s) => s.id === sessionToDelete)?.title ?? "";

  return (
    <>
      <Popover>
        <PopoverTrigger
          className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-bg-hover text-fg-muted hover:text-fg-default transition-colors shrink-0"
          title="Chat History"
        >
          <ClockCounterClockwise size={14} />
        </PopoverTrigger>
        <PopoverContent side="bottom" align="end" className="w-64 p-0">
          <div className="px-3 py-2 border-b border-border/40">
            <span className="text-xs font-medium text-fg-default">Chat History</span>
            <span className="text-ui-xs text-fg-muted ml-1.5">
              {chatSessions.length} session{chatSessions.length !== 1 ? "s" : ""}
            </span>
          </div>

          {chatSessions.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-fg-muted">
              No sessions yet. Start a new chat to create one.
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto py-1">
              {chatSessions.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    "group w-full flex items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-bg-hover cursor-pointer",
                    session.id === activeChatSessionId && "bg-bg-active/50",
                  )}
                  onClick={() => handleSelect(session.id)}
                >
                  <ChatCircle size={14} className="mt-0.5 shrink-0 text-fg-muted" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-medium truncate">{session.title}</span>
                      <span className="text-ui-xs text-fg-muted shrink-0">
                        {formatSessionDate(session.updatedAt)}
                      </span>
                    </div>
                    <p className="text-ui-xs text-fg-muted truncate mt-0.5">
                      {getSessionPreview(session)}
                    </p>
                  </div>
                  <AlertDialog open={sessionToDelete === session.id} onOpenChange={() => {}}>
                    <AlertDialogTrigger
                      onClick={(e) => {
                        e.stopPropagation();
                        setSessionToDelete(session.id);
                      }}
                      className="mt-0.5 p-1 rounded-sm hover:bg-status-error/10 text-fg-muted hover:text-status-error transition-colors shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title="Delete session"
                    >
                      <Trash size={12} />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogMedia>
                          <Warning size={20} className="text-status-warning" />
                        </AlertDialogMedia>
                        <AlertDialogTitle>Delete chat?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete &quot;{sessionToDeleteTitle}&quot;? This
                          action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setSessionToDelete(null)}>
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={handleConfirmDelete}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </>
  );
}
