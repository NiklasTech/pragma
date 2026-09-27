"use client";

import {
  ArrowClockwise,
  DotsThree,
  PencilSimple,
  Play,
  Robot,
  Stop,
  Trash,
} from "@phosphor-icons/react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

import type { TaskActionState } from "./actionState";
import type { Task } from "./types";

export const TASK_MIME = "application/x-pragma-task";

interface TaskCardProps {
  task: Task;
  agentName: string | null;
  actions: TaskActionState;
  onEdit: () => void;
  onRun: () => void;
  onStop: () => void;
  onResume: () => void;
  onDelete: () => void;
}

export function TaskCard({
  task,
  agentName,
  actions,
  onEdit,
  onRun,
  onStop,
  onResume,
  onDelete,
}: TaskCardProps) {
  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(TASK_MIME, task.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      className="group flex items-start gap-1 rounded-lg border border-border-subtle bg-bg-surface py-2 pr-1 pl-2.5 shadow-[var(--shadow-sm)] transition-colors hover:border-border"
    >
      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-1 flex-col gap-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <span className="line-clamp-3 text-ui-sm text-fg-default wrap-break-word">
          {task.title}
        </span>
        {agentName && (
          <span className="flex items-center gap-1 text-ui-2xs text-fg-subtle">
            <Robot size={11} />
            <span className="truncate">{agentName}</span>
          </span>
        )}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label="Task actions"
              title="Task actions"
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-fg-muted opacity-0 transition-colors outline-none group-hover:opacity-100 hover:bg-bg-hover hover:text-fg-default focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/60 data-popup-open:opacity-100"
            >
              <DotsThree size={15} weight="bold" />
            </button>
          }
        />
        <DropdownMenuContent align="end" className="min-w-[160px]">
          <DropdownMenuItem onClick={onEdit}>
            <PencilSimple size={14} />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!actions.canRun} onClick={onRun}>
            <Play size={14} />
            Run
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!actions.canStop} onClick={onStop}>
            <Stop size={14} />
            Stop
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!actions.canResume} onClick={onResume}>
            <ArrowClockwise size={14} />
            Resume
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash size={14} />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
