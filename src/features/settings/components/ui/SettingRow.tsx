"use client";

import { cn } from "@/shared/lib/utils";

interface SettingRowProps {
  label: string;
  description?: React.ReactNode;
  control: React.ReactNode;
  disabled?: boolean;
}

export function SettingRow({ label, description, control, disabled }: SettingRowProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-row items-center justify-between py-2.5",
        "border-b border-border/30 last:border-b-0",
        disabled && "opacity-50",
      )}
    >
      <div className="flex flex-col gap-0.5 pr-4">
        <span className="text-ui-sm text-fg-default">{label}</span>
        {description && <span className="text-ui-xs text-fg-muted">{description}</span>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
