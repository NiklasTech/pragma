"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import type { SessionUsage } from "@/shared/stores/ai";

import { formatTokens } from "./formatTokens";

function UsageRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex w-full items-center justify-between gap-4">
      <span className="text-fg-muted">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

interface SessionUsageBadgeProps {
  usage: SessionUsage | undefined;
  className?: string;
}

export function SessionUsageBadge({ usage, className }: SessionUsageBadgeProps) {
  if (!usage || usage.responses === 0) return null;

  const total = usage.inputTokens + usage.outputTokens;
  const responses = usage.responses === 1 ? "1 response" : `${usage.responses} responses`;

  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        delay={200}
        aria-label={`${total.toLocaleString("en-US")} tokens used in this session`}
        className={cn(
          "flex shrink-0 items-center rounded-md px-1 text-ui-2xs text-fg-subtle tabular-nums transition-colors hover:text-fg-default",
          className,
        )}
      >
        {formatTokens(total)} tokens
      </TooltipTrigger>
      <TooltipContent side="bottom" className="min-w-44 flex-col items-start gap-0.5 py-1.5">
        <UsageRow label="Input" value={usage.inputTokens.toLocaleString("en-US")} />
        {usage.cacheReadTokens > 0 && (
          <UsageRow label="Cache read" value={usage.cacheReadTokens.toLocaleString("en-US")} />
        )}
        {usage.cacheWriteTokens > 0 && (
          <UsageRow label="Cache write" value={usage.cacheWriteTokens.toLocaleString("en-US")} />
        )}
        <UsageRow label="Output" value={usage.outputTokens.toLocaleString("en-US")} />
        <span className="pt-0.5 text-ui-2xs text-fg-subtle">
          {responses}. Cached tokens are part of the input.
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
