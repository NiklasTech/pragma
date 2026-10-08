"use client";

import { CaretDown } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

import { TASK_PRIORITIES } from "./organize";
import type { Task, TaskPriority } from "./types";

const NO_PRIORITY = "none";

interface TaskOrganizeFieldsProps {
  priority: TaskPriority | undefined;
  onPriorityChange: (priority: TaskPriority | undefined) => void;
  labels: string;
  onLabelsChange: (labels: string) => void;
  blockedBy: string[];
  onBlockedByChange: (blockedBy: string[]) => void;
  /** Tasks this one may wait for: every other task that does not already wait for it. */
  candidates: Task[];
}

export function TaskOrganizeFields({
  priority,
  onPriorityChange,
  labels,
  onLabelsChange,
  blockedBy,
  onBlockedByChange,
  candidates,
}: TaskOrganizeFieldsProps) {
  const priorityLabel =
    TASK_PRIORITIES.find((item) => item.value === priority)?.label ?? "No priority";
  const blockerTitles = candidates
    .filter((task) => blockedBy.includes(task.id))
    .map((task) => task.title);

  const toggleBlocker = (taskId: string, checked: boolean) => {
    onBlockedByChange(checked ? [...blockedBy, taskId] : blockedBy.filter((id) => id !== taskId));
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-ui-xs font-medium text-fg-muted">Priority</span>
          <Select
            value={priority ?? NO_PRIORITY}
            onValueChange={(value) => {
              const match = TASK_PRIORITIES.find((item) => item.value === value);
              onPriorityChange(match?.value);
            }}
          >
            <SelectTrigger aria-label="Priority">
              <SelectValue>{priorityLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PRIORITY}>No priority</SelectItem>
              {TASK_PRIORITIES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-ui-xs font-medium text-fg-muted">Labels</span>
          <Input
            value={labels}
            onChange={(event) => onLabelsChange(event.target.value)}
            placeholder="bug, frontend"
            className="text-ui-sm"
          />
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-ui-xs font-medium text-fg-muted">Blocked by</span>
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={candidates.length === 0}
            render={
              <Button type="button" variant="outline" className="justify-between font-normal" />
            }
          >
            <span className="truncate">
              {blockerTitles.length > 0
                ? blockerTitles.join(", ")
                : candidates.length > 0
                  ? "No blocking tasks"
                  : "No other tasks"}
            </span>
            <CaretDown size={12} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-64 min-w-[260px] overflow-y-auto">
            {candidates.map((task) => (
              <DropdownMenuCheckboxItem
                key={task.id}
                checked={blockedBy.includes(task.id)}
                onCheckedChange={(checked) => toggleBlocker(task.id, checked)}
                closeOnClick={false}
              >
                <span className="truncate">{task.title}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
