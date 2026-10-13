"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

import { GROUP_ENVIRONMENT_LABELS, type GroupEnvironment } from "./group";

export function GroupEnvironmentSelect<T extends GroupEnvironment>({
  value,
  modes,
  label,
  className,
  onChange,
}: {
  value: T;
  modes: readonly T[];
  label: string;
  className?: string;
  onChange: (value: T) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        const mode = modes.find((item) => item === next);
        if (mode) onChange(mode);
      }}
    >
      <SelectTrigger aria-label={label} className={className}>
        <SelectValue>{GROUP_ENVIRONMENT_LABELS[value]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {modes.map((mode) => (
          <SelectItem key={mode} value={mode}>
            {GROUP_ENVIRONMENT_LABELS[mode]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
