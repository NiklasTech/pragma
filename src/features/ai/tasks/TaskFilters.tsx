"use client";

import { X } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

import { EMPTY_TASK_FILTER, TASK_PRIORITIES, type TaskFilter } from "./organize";

const ANY = "any";

export function TaskFilters({
  filter,
  labels,
  onChange,
}: {
  filter: TaskFilter;
  labels: string[];
  onChange: (filter: TaskFilter) => void;
}) {
  const active = filter.priority !== null || filter.label !== null;

  return (
    <div className="flex shrink-0 items-center gap-2 px-3 pt-2">
      <Select
        value={filter.priority ?? ANY}
        onValueChange={(value) => {
          const match = TASK_PRIORITIES.find((item) => item.value === value);
          onChange({ ...filter, priority: match?.value ?? null });
        }}
      >
        <SelectTrigger aria-label="Filter by priority" className="h-7 w-36 text-ui-xs">
          <SelectValue>
            {TASK_PRIORITIES.find((item) => item.value === filter.priority)?.label ??
              "Any priority"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any priority</SelectItem>
          {TASK_PRIORITIES.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filter.label ?? ANY}
        onValueChange={(value) => {
          onChange({ ...filter, label: typeof value === "string" && value !== ANY ? value : null });
        }}
      >
        <SelectTrigger
          aria-label="Filter by label"
          className="h-7 w-36 text-ui-xs"
          disabled={labels.length === 0}
        >
          <SelectValue>{filter.label ?? "Any label"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any label</SelectItem>
          {labels.map((label) => (
            <SelectItem key={label} value={label}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {active && (
        <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_TASK_FILTER)}>
          <X size={12} />
          Clear filters
        </Button>
      )}
    </div>
  );
}
