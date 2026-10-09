"use client";

import { invoke } from "@tauri-apps/api/core";
import {
  ArrowClockwise,
  Clock,
  DotsThree,
  GithubLogo,
  LockSimple,
  PencilSimple,
  Play,
  Robot,
  Stop,
  Trash,
} from "@phosphor-icons/react";

import { Badge } from "@/shared/components/ui/badge";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { cn } from "@/shared/lib/utils";

import { seededAccent } from "../panes/providerAccent";

import type { TaskActionState } from "./actionState";
import { TASK_PRIORITIES } from "./organize";
import { describeSchedule } from "./schedule";
import type { Task, TaskPriority } from "./types";

const PRIORITY_VARIANTS: Record<TaskPriority, "destructive" | "warning" | "secondary"> = {
  high: "destructive",
  medium: "warning",
  low: "secondary",
};

export const TASK_MIME = "application/x-pragma-task";

interface TaskCardProps {
  task: Task;
  agentName: string | null;
  /** Titles of blocking tasks that are not done yet. */
  blockers: string[];
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
  blockers,
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
      className="group flex animate-in cursor-grab items-start gap-1 rounded-lg border border-border-subtle bg-bg-surface py-2 pr-1 pl-2.5 shadow-[var(--shadow-sm)] transition-[border-color,translate] duration-150 fade-in-0 hover:-translate-y-px hover:border-border active:cursor-grabbing"
    >
      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-1 flex-col gap-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <span className="line-clamp-3 text-ui-sm text-fg-default wrap-break-word">
          {task.title}
        </span>
        {(task.priority || (task.labels?.length ?? 0) > 0 || blockers.length > 0) && (
          <span className="flex flex-wrap items-center gap-1">
            {task.priority && (
              <Badge variant={PRIORITY_VARIANTS[task.priority]}>
                {TASK_PRIORITIES.find((item) => item.value === task.priority)?.label}
              </Badge>
            )}
            {blockers.length > 0 && (
              <Badge variant="outline" title={`Blocked by ${blockers.join(", ")}`}>
                <LockSimple />
                Blocked
              </Badge>
            )}
            {task.labels?.map((label) => (
              <Badge key={label} variant="outline">
                {label}
              </Badge>
            ))}
          </span>
        )}
        {task.issueNumber !== undefined && (
          <span className="flex items-center gap-1 text-ui-2xs text-fg-subtle">
            <GithubLogo size={11} />
            Issue #{task.issueNumber}
          </span>
        )}
        {task.schedule && (
          <span className="flex items-center gap-1 text-ui-2xs text-fg-subtle">
            <Clock size={11} />
            {describeSchedule(task.schedule)}
            {task.schedule.paused && " (paused)"}
          </span>
        )}
        {agentName && task.agentId && (
          <span className="flex items-center gap-1 text-ui-2xs text-fg-subtle">
            <Robot size={11} weight="fill" className={cn(seededAccent(task.agentId).text)} />
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
          {task.issueUrl && (
            <DropdownMenuItem
              onClick={() => void invoke("open_external_url", { url: task.issueUrl })}
            >
              <GithubLogo size={14} />
              Open issue
            </DropdownMenuItem>
          )}
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
