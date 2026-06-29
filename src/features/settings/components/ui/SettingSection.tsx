"use client";

import { Separator } from "@/shared/components/ui/separator";

interface SettingSectionBadge {
  label: string;
  variant?: "default" | "warning" | "success" | "error";
}

interface SettingSectionProps {
  title: string;
  children: React.ReactNode;
  badge?: SettingSectionBadge;
}

const BADGE_COLORS: Record<NonNullable<SettingSectionBadge["variant"]>, string> = {
  default: "bg-primary/10 text-primary",
  warning: "bg-status-warning/10 text-status-warning",
  success: "bg-status-success/10 text-status-success",
  error: "bg-status-error/10 text-status-error",
};

export function SettingSection({ title, children, badge }: SettingSectionProps) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2">
        <h3 className="text-ui-xs font-medium text-fg-muted uppercase tracking-wider">{title}</h3>
        {badge && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-ui-xs ${BADGE_COLORS[badge.variant ?? "default"]}`}
          >
            {badge.label}
          </span>
        )}
      </div>
      <Separator className="my-2 bg-border/30" />
      <div className="flex flex-col">{children}</div>
    </div>
  );
}
