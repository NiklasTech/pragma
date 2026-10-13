"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

import { SCOPE_LABELS } from "./scope";
import type { AgentScope } from "./types";

const SCOPE_HINTS: Record<AgentScope, string> = {
  personal: "On this machine, in every workspace",
  project: "In .pragma/agents, shared with the repository",
};

interface AgentScopePickerProps {
  value: AgentScope;
  projectAvailable: boolean;
  onChange: (scope: AgentScope) => void;
}

export function AgentScopePicker({ value, projectAvailable, onChange }: AgentScopePickerProps) {
  return (
    <div className="flex flex-col gap-1">
      <Select value={value} onValueChange={(next) => next && onChange(next)}>
        <SelectTrigger className="h-8 w-full max-w-[280px]">
          <SelectValue>{SCOPE_LABELS[value]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="personal">{SCOPE_LABELS.personal}</SelectItem>
          <SelectItem value="project" disabled={!projectAvailable}>
            {SCOPE_LABELS.project}
          </SelectItem>
        </SelectContent>
      </Select>
      <span className="text-ui-2xs text-fg-subtle">
        {projectAvailable || value === "project"
          ? SCOPE_HINTS[value]
          : `${SCOPE_HINTS[value]}. Open a folder to create project agents.`}
      </span>
    </div>
  );
}
