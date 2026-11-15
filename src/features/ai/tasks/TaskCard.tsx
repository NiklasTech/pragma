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

import { Button } from "@/shared/components/ui/button";
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
      <Button
        variant="ghost"
        onClick={onEdit}
        className="min-w-0 flex-1 flex-col items-stretch gap-1 p-0 text-left h-auto whitespace-normal font-normal hover:bg-transparent"
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
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Task actions"
              title="Task actions"
              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100"
            >
              <DotsThree size={15} weight="bold" />
            </Button>
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
