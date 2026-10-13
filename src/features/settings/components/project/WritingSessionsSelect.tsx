"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

type WritingSessions = "worktree" | "checkout";

const OPTIONS = [
  { value: "automatic", label: "Automatic" },
  { value: "worktree", label: "New worktree" },
  { value: "checkout", label: "This checkout" },
] as const;

/// Where sessions that change files start; Automatic picks a worktree while the checkout is in use.
export function WritingSessionsSelect({
  value,
  onChange,
}: {
  value: WritingSessions | undefined;
  onChange: (value: WritingSessions | undefined) => void;
}) {
  const current = value ?? "automatic";
  return (
    <Select
      value={current}
      onValueChange={(next) =>
        onChange(next === "worktree" || next === "checkout" ? next : undefined)
      }
    >
      <SelectTrigger aria-label="Writing sessions work in" className="w-36">
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
