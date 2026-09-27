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
        "flex w-full flex-row items-center justify-between gap-6 py-3",
        disabled && "opacity-50",
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-ui-sm font-medium text-fg-default">{label}</span>
        {description && (
          <span className="text-ui-xs leading-relaxed text-fg-subtle">{description}</span>
        )}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
