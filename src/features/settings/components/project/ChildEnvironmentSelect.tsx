"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

type ChildEnvironment = "parent" | "worktree";

const OPTIONS = [
  { value: "worktree", label: "Own worktree from the parent's branch" },
  { value: "parent", label: "Where the parent works" },
] as const;

/// Where a child session works when the agent does not choose; the default is an own worktree.
export function ChildEnvironmentSelect({
  value,
  onChange,
}: {
  value: ChildEnvironment | undefined;
  onChange: (value: ChildEnvironment | undefined) => void;
}) {
  const current = value ?? "worktree";
  return (
    <Select
      value={current}
      onValueChange={(next) => onChange(next === "parent" ? "parent" : undefined)}
    >
      <SelectTrigger aria-label="Child sessions work in" className="w-64">
        <SelectValue>{OPTIONS.find((option) => option.value === current)?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
