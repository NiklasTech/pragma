"use client";

import { useCallback, useState } from "react";
import { DotsThree, PencilSimple, Trash } from "@phosphor-icons/react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Input } from "@/shared/components/ui/input";
import type { ChatSession } from "@/shared/stores/ai";
import { cn } from "@/shared/lib/utils";

import { formatRelativeTime, type ThreadStatus } from "./helpers";

const STATUS_STYLES: Record<ThreadStatus, string> = {
  idle: "bg-fg-subtle",
  running: "bg-status-success animate-pulse",
  "waiting-approval": "bg-status-warning",
  error: "bg-status-error",
};

const STATUS_LABELS: Record<ThreadStatus, string> = {
  idle: "Idle",
  running: "Running",
  "waiting-approval": "Waiting for approval",
  error: "Error",
};

interface ThreadRowProps {
  session: ChatSession;
  isActive: boolean;
  status: ThreadStatus;
  onSelect: (sessionId: string) => void;
  onRename: (sessionId: string, title: string) => void;
  onDelete: (sessionId: string) => void;
}

export function ThreadRow({
  session,
  isActive,
  status,
  onSelect,
  onRename,
  onDelete,
}: ThreadRowProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draft, setDraft] = useState(session.title);

  const startRename = useCallback(() => {
    setDraft(session.title);
    setIsRenaming(true);
  }, [session.title]);

  const commitRename = useCallback(() => {
    setIsRenaming(false);
    onRename(session.id, draft);
  }, [draft, onRename, session.id]);

  return (
    <div
      className={cn(
        "group relative flex items-center gap-0.5 rounded-md px-1 transition-colors",
        isActive ? "bg-bg-active/50" : "hover:bg-bg-hover",
      )}
      data-thread-status={status}
    >
      {isRenaming ? (
        <form
          className="flex min-w-0 flex-1 items-center"
          onSubmit={(event) => {
            event.preventDefault();
            commitRename();
          }}
        >
          <Input
            value={draft}
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setIsRenaming(false);
              }
            }}
            aria-label="Thread title"
            className="h-6 text-ui-xs"
          />
        </form>
      ) : (
        <button
          type="button"
          onClick={() => onSelect(session.id)}
          aria-current={isActive ? "true" : undefined}
          className="flex min-w-0 flex-1 items-center gap-1.5 px-1 py-1.5 text-left"
        >
          <span
            className={cn("size-1.5 shrink-0 rounded-full", STATUS_STYLES[status])}
            title={STATUS_LABELS[status]}
            aria-label={`Status: ${STATUS_LABELS[status]}`}
          />
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-ui-xs",
              isActive ? "font-medium text-fg-default" : "text-fg-muted",
            )}
            title={session.title}
          >
            {session.title}
          </span>
          <span className="shrink-0 text-ui-2xs text-fg-subtle">
            {formatRelativeTime(session.updatedAt)}
          </span>
        </button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label="Thread actions"
              title="Thread actions"
              className="flex size-5 shrink-0 items-center justify-center rounded-sm text-fg-muted opacity-0 transition-colors group-hover:opacity-100 focus:opacity-100 hover:bg-bg-hover hover:text-fg-default"
            >
              <DotsThree size={13} weight="bold" />
            </button>
          }
        />
        <DropdownMenuContent align="end" className="min-w-[140px]">
          <DropdownMenuItem onClick={startRename}>
            <PencilSimple size={13} />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDelete(session.id)}>
            <Trash size={13} />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
