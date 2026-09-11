"use client";

import { Info } from "@phosphor-icons/react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
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
        "flex w-full flex-row items-center justify-between py-3",
        disabled && "opacity-50",
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5 pr-4">
        <span className="text-ui-sm text-fg-default">{label}</span>
        {description && (
          <Tooltip>
            <TooltipTrigger
              type="button"
              delay={100}
              aria-label={`About ${label}`}
              className="flex items-center text-fg-subtle transition-colors hover:text-fg-default"
            >
              <Info size={14} />
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">{description}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
