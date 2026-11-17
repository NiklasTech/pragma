"use client";

import { CaretRight } from "@phosphor-icons/react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/components/ui/collapsible";

interface SettingSectionBadge {
  label: string;
  variant?: "default" | "warning" | "success" | "error";
}

interface SettingSectionProps {
  title: string;
  children: React.ReactNode;
  badge?: SettingSectionBadge;
  action?: React.ReactNode;
  /** Starts folded; search still finds and unfolds the rows inside. */
  collapsible?: boolean;
}

const BADGE_COLORS: Record<NonNullable<SettingSectionBadge["variant"]>, string> = {
  default: "text-fg-muted ring-fg-default/15",
  warning: "text-status-warning ring-status-warning/40",
  success: "text-status-success ring-status-success/40",
  error: "text-status-error ring-status-error/40",
};

const BODY = "flex flex-col divide-y divide-border-subtle";
// A small mono label with a hairline running to the right, as in design D.
const LABEL =
  "flex min-h-7 items-center gap-2 font-mono text-[10.5px] tracking-[0.08em] text-fg-subtle uppercase after:h-px after:flex-1 after:bg-border-subtle after:content-['']";

export function SettingSection({
  title,
  children,
  badge,
  action,
  collapsible,
}: SettingSectionProps) {
  if (collapsible) {
    return (
      <Collapsible className="-ml-3 flex flex-col gap-1 pt-4">
        <CollapsibleTrigger
          className={`group ${LABEL} w-full rounded-[4px] text-left hover:text-fg-default`}
        >
          <CaretRight
            size={12}
            aria-hidden="true"
            className="transition-transform duration-200 group-data-[panel-open]:rotate-90 motion-reduce:transition-none"
          />
          {title}
        </CollapsibleTrigger>
        <CollapsibleContent
          hiddenUntilFound
          className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0 motion-reduce:transition-none"
        >
          <div className={`${BODY} pl-3`}>{children}</div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <section className="-ml-3 flex flex-col gap-1 pt-4">
      <div className="flex min-h-7 items-center gap-2">
        <h3 className={`${LABEL} min-w-0 flex-1`}>
          <span className="shrink-0">{title}</span>
          {badge && (
            <span
              className={`shrink-0 rounded-[4px] px-1.5 py-px tracking-normal normal-case ring-1 ring-inset ${BADGE_COLORS[badge.variant ?? "default"]}`}
            >
              {badge.label}
            </span>
          )}
        </h3>
        {action && (
          // Header actions sit on the hairline, so they stay small whatever size their page asked for.
          <div className="flex shrink-0 items-center gap-1 [&_[data-slot=button]]:h-6 [&_[data-slot=button]]:px-2 [&_[data-slot=button]]:text-[11px]">
            {action}
          </div>
        )}
      </div>
      <div className={`${BODY} pl-3`}>{children}</div>
    </section>
  );
}
