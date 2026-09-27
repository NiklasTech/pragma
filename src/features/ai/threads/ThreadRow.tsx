"use client";

import { useCallback, useState } from "react";
import type { Icon } from "@phosphor-icons/react";
import {
  ChatCircle,
  DotsThree,
  GitBranch,
  PencilSimple,
  Robot,
  TerminalWindow,
  Trash,
} from "@phosphor-icons/react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Input } from "@/shared/components/ui/input";
import type { ChatSession } from "@/shared/stores/ai";
import { cn } from "@/shared/lib/utils";

import { formatRelativeTime, type ThreadStatus } from "./helpers";

const STATUS_STYLES: Record<ThreadStatus, string> = {
  idle: "bg-fg-subtle",
  running: "bg-linear-to-r from-brand-from to-brand-to animate-pulse",
  "waiting-approval": "bg-status-warning",
  error: "bg-status-error",
};

const STATUS_LABELS: Record<ThreadStatus, string> = {
  idle: "Idle",
  running: "Running",
  "waiting-approval": "Waiting for approval",
  error: "Error",
};

const STATUS_TEXT: Record<ThreadStatus, string | null> = {
  idle: null,
  running: "Working",
  "waiting-approval": "Needs your approval",
  error: "Stopped with an error",
};

const KIND_ICONS: Record<NonNullable<ChatSession["kind"]>, Icon> = {
  ask: ChatCircle,
  agent: Robot,
  terminal: TerminalWindow,
};

interface ThreadRowProps {
  session: ChatSession;
  isActive: boolean;
  status: ThreadStatus;
  onSelect: (sessionId: string) => void;
  onRename: (sessionId: string, title: string) => void;
  onDelete: (sessionId: string) => void;
  onDiscard: (sessionId: string) => void;
}

export function ThreadRow({
  session,
  isActive,
  status,
  onSelect,
  onRename,
  onDelete,
  onDiscard,
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

  const KindIcon = KIND_ICONS[session.kind ?? "agent"];
  const statusText = STATUS_TEXT[status];

  return (
    <div
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg py-1.5 pr-1 pl-2 transition-colors",
        isActive
          ? "bg-bg-root shadow-[var(--shadow-sm)] ring-1 ring-border-subtle"
          : "hover:bg-bg-hover",
      )}
      data-thread-status={status}
    >
      <span
        className={cn(
          "relative flex size-7 shrink-0 items-center justify-center rounded-md",
          isActive ? "bg-accent-subtle text-primary" : "bg-bg-hover text-fg-muted",
        )}
      >
        <KindIcon size={14} weight={isActive ? "fill" : "regular"} />
        {status !== "idle" && (
          <span
            className={cn(
              "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-bg-chrome",
              STATUS_STYLES[status],
            )}
            title={STATUS_LABELS[status]}
            aria-label={`Status: ${STATUS_LABELS[status]}`}
          />
        )}
      </span>

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
            className="h-7 rounded-md text-ui-sm"
          />
        </form>
      ) : (
        <button
          type="button"
          onClick={() => onSelect(session.id)}
          onDoubleClick={startRename}
          aria-current={isActive ? "true" : undefined}
          className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <span
            className={cn(
              "truncate text-ui-sm transition-colors",
              isActive
                ? "font-medium text-fg-default"
                : "text-fg-muted group-hover:text-fg-default",
            )}
            title={session.title}
          >
            {session.title}
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-ui-2xs text-fg-subtle">
            {statusText ? (
              <span
                className={cn(
                  "truncate",
                  status === "running" && "text-primary",
                  status === "waiting-approval" && "text-status-warning",
                  status === "error" && "text-status-error",
                )}
              >
                {statusText}
              </span>
            ) : (
              session.worktree && (
                <span
                  className="flex min-w-0 items-center gap-1"
                  title={`${session.worktree.branch} ${session.worktree.path}`}
                >
                  <GitBranch size={11} className="shrink-0" />
                  <span className="truncate">{session.worktree.branch}</span>
                </span>
              )
            )}
            <span className="ml-auto shrink-0 tabular-nums">
              {formatRelativeTime(session.updatedAt)}
            </span>
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
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-fg-muted opacity-0 transition-colors outline-none group-hover:opacity-100 hover:bg-bg-hover hover:text-fg-default focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/60 data-popup-open:opacity-100"
            >
              <DotsThree size={15} weight="bold" />
            </button>
          }
        />
        <DropdownMenuContent align="end" className="min-w-[180px]">
          <DropdownMenuItem onClick={startRename}>
            <PencilSimple size={14} />
            Rename
          </DropdownMenuItem>
          {session.worktree && (
            <DropdownMenuItem onClick={() => onDiscard(session.id)}>
              <GitBranch size={14} />
              Discard worktree
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(session.id)}>
            <Trash size={14} />
            Delete thread
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
