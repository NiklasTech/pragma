"use client";

import { Progress } from "@/shared/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";

import { contextLevel } from "./contextWindow";
import { formatTokens } from "./formatTokens";
import { useContextUsage } from "./useContextUsage";

const LEVEL_TEXT = {
  normal: "text-fg-subtle",
  warning: "text-status-warning",
  critical: "text-status-error",
} as const;

const LEVEL_INDICATOR = {
  normal: "**:data-[slot=progress-indicator]:bg-fg-muted",
  warning: "**:data-[slot=progress-indicator]:bg-status-warning",
  critical: "**:data-[slot=progress-indicator]:bg-status-error",
} as const;

/// How full the context window of the active session is, next to the send button.
export function ContextMeter() {
  const usage = useContextUsage();
  if (!usage) return null;

  const ratio = Math.min(usage.used / usage.size, 1);
  const percent = Math.round(ratio * 100);
  const level = contextLevel(ratio);

  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        delay={200}
        aria-label={`Context window ${percent}% full`}
        className={cn(
          "flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2 text-ui-2xs tabular-nums transition-colors hover:bg-bg-hover",
          LEVEL_TEXT[level],
        )}
      >
        <Progress value={percent} className={cn("w-8 gap-0", LEVEL_INDICATOR[level])} />
        {percent}%
      </TooltipTrigger>
      <TooltipContent className="max-w-64 flex-col items-start gap-0.5 py-1.5">
        <span>
          {formatTokens(usage.used)} of {formatTokens(usage.size)} tokens in context
        </span>
        {level !== "normal" && (
          <span className={cn("text-ui-2xs", LEVEL_TEXT[level])}>
            The context window is almost full. Start a new session before the model loses earlier
            messages.
          </span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
