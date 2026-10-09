"use client";

import { useCallback, useState } from "react";
import type { Icon } from "@phosphor-icons/react";
import {
  ChatCircle,
  CheckSquare,
  Copy,
  DotsThree,
  FolderSimple,
  GitBranch,
  PencilSimple,
  Robot,
  TerminalWindow,
  Trash,
} from "@phosphor-icons/react";

import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Input } from "@/shared/components/ui/input";
import type { ChatSession } from "@/shared/stores/ai";
import { cn } from "@/shared/lib/utils";
import type { FinishAction } from "@/features/ai/worktree/finish";
import { FinishWorktreeMenu } from "@/features/ai/worktree/FinishWorktreeMenu";
import { ExportSessionMenu } from "@/features/ai/export/ExportSessionMenu";

import { providerAccent } from "../panes/providerAccent";
import { ProviderLogo } from "../panes/ProviderLogo";
import { useTerminalActivity } from "../terminal/useTerminalActivity";
import { CategoryMenuItems } from "./CategoryMenuItems";
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

const DEPTH_INDENT = ["", "ml-5", "ml-10"];

const KIND_ICONS: Record<NonNullable<ChatSession["kind"]>, Icon> = {
  ask: ChatCircle,
  agent: Robot,
  terminal: TerminalWindow,
};

interface ThreadRowProps {
  session: ChatSession;
  isActive: boolean;
  status: ThreadStatus;
  depth?: number;
  runningChildren?: number;
  selectionMode?: boolean;
  isSelected?: boolean;
  categories?: string[];
  /** Matching message text shown under the title while searching. */
  snippet?: string;
  onSelect: (sessionId: string) => void;
  onToggleSelect?: (sessionId: string, extend: boolean) => void;
  onRename: (sessionId: string, title: string) => void;
  onDuplicate?: (sessionId: string) => void;
  onMoveToCategory?: (sessionId: string, category: string | null) => void;
  onNewCategory?: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  onDiscard: (sessionId: string) => void;
  onFinish?: (sessionId: string, action: FinishAction) => void;
}

export function ThreadRow({
  session,
  isActive,
  status,
  depth = 0,
  runningChildren = 0,
  selectionMode = false,
  isSelected = false,
  categories = [],
  snippet,
  onSelect,
  onToggleSelect,
  onRename,
  onDuplicate,
  onMoveToCategory,
  onNewCategory,
  onDelete,
  onDiscard,
  onFinish,
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
  const accent = providerAccent(session);
  const terminalActive = useTerminalActivity(session.kind === "terminal" ? session.id : null);
  const shownStatus: ThreadStatus = status === "idle" && terminalActive ? "running" : status;
  const statusText = STATUS_TEXT[shownStatus];

  return (
    <div
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg py-1.5 pr-1 pl-2 transition-colors",
        DEPTH_INDENT[Math.min(depth, DEPTH_INDENT.length - 1)],
        isSelected
          ? "bg-accent-subtle"
          : isActive && !selectionMode
            ? "bg-bg-root shadow-[var(--shadow-sm)] ring-1 ring-border-subtle"
            : "hover:bg-bg-hover",
      )}
      data-thread-status={shownStatus}
    >
      <span
        className={cn(
          "relative flex size-7 shrink-0 items-center justify-center rounded-md transition-colors",
          accent.soft,
          accent.text,
        )}
      >
        {selectionMode ? (
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect?.(session.id, false)}
            aria-label={`Select ${session.title}`}
          />
        ) : session.cliProviderId ? (
          <ProviderLogo providerId={session.cliProviderId} name={session.title} size={14} />
        ) : (
          <KindIcon size={14} weight={isActive ? "fill" : "regular"} />
        )}
        {shownStatus !== "idle" && (
          <span
            className={cn(
              "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-bg-chrome",
              STATUS_STYLES[shownStatus],
            )}
            title={STATUS_LABELS[shownStatus]}
            aria-label={`Status: ${STATUS_LABELS[shownStatus]}`}
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
          onClick={(event) => {
            const modified = event.metaKey || event.ctrlKey || event.shiftKey;
            if (onToggleSelect && (selectionMode || modified)) {
              onToggleSelect(session.id, event.shiftKey);
            } else {
              onSelect(session.id);
            }
          }}
          onDoubleClick={selectionMode ? undefined : startRename}
          aria-current={isActive ? "true" : undefined}
          aria-pressed={selectionMode ? isSelected : undefined}
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
          {snippet && (
            <span className="line-clamp-2 text-ui-2xs text-fg-muted" title={snippet}>
              {snippet}
            </span>
          )}
          <span className="flex min-w-0 items-center gap-1.5 text-ui-2xs text-fg-subtle">
            {statusText ? (
              <span
                className={cn(
                  "truncate",
                  shownStatus === "running" && "text-primary",
                  shownStatus === "waiting-approval" && "text-status-warning",
                  shownStatus === "error" && "text-status-error",
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
            {runningChildren > 0 && (
              <span className="shrink-0 text-primary tabular-nums">{runningChildren} running</span>
            )}
            <span className="ml-auto shrink-0 tabular-nums">
              {formatRelativeTime(session.updatedAt)}
            </span>
          </span>
        </button>
      )}

      {!selectionMode && (
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
            {onDuplicate && (
              <DropdownMenuItem onClick={() => onDuplicate(session.id)}>
                <Copy size={14} />
                Duplicate
              </DropdownMenuItem>
            )}
            <ExportSessionMenu session={session} />
            {onMoveToCategory && onNewCategory && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FolderSimple size={14} />
                  Move to category
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-[180px]">
                  <CategoryMenuItems
                    categories={categories}
                    current={session.category ?? null}
                    canRemove={Boolean(session.category)}
                    onMove={(category) => onMoveToCategory(session.id, category)}
                    onNew={() => onNewCategory(session.id)}
                  />
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            {onToggleSelect && (
              <DropdownMenuItem onClick={() => onToggleSelect(session.id, false)}>
                <CheckSquare size={14} />
                Select
              </DropdownMenuItem>
            )}
            {session.worktree && onFinish && (
              <FinishWorktreeMenu
                disabled={shownStatus === "running" || shownStatus === "waiting-approval"}
                onFinish={(action) => onFinish(session.id, action)}
              />
            )}
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
      )}
    </div>
  );
}
