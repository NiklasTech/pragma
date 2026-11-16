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
  default: "bg-bg-hover text-fg-muted",
  warning: "bg-status-warning/10 text-status-warning",
  success: "bg-status-success/10 text-status-success",
  error: "bg-status-error/10 text-status-error",
};

const BODY =
  "flex flex-col divide-y divide-border-subtle rounded-xl border border-border-subtle bg-bg-surface px-4";

export function SettingSection({
  title,
  children,
  badge,
  action,
  collapsible,
}: SettingSectionProps) {
  if (collapsible) {
    return (
      <Collapsible className="flex flex-col gap-2">
        <CollapsibleTrigger className="group flex min-h-7 items-center gap-1.5 self-start rounded-md px-1 text-ui-xs font-semibold text-fg-muted transition-colors hover:text-fg-default">
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
          <div className={BODY}>{children}</div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex min-h-7 items-center gap-2 px-1">
        <h3 className="text-ui-xs font-semibold text-fg-muted">{title}</h3>
        {badge && (
          <span
            className={`rounded-full px-2 py-px text-ui-2xs font-medium ${BADGE_COLORS[badge.variant ?? "default"]}`}
          >
            {badge.label}
          </span>
        )}
        {action && <div className="ml-auto flex items-center gap-1.5">{action}</div>}
      </div>
      <div className={BODY}>{children}</div>
    </section>
  );
}
