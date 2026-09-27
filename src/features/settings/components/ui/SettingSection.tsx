"use client";

interface SettingSectionBadge {
  label: string;
  variant?: "default" | "warning" | "success" | "error";
}

interface SettingSectionProps {
  title: string;
  children: React.ReactNode;
  badge?: SettingSectionBadge;
  action?: React.ReactNode;
}

const BADGE_COLORS: Record<NonNullable<SettingSectionBadge["variant"]>, string> = {
  default: "bg-bg-hover text-fg-muted",
  warning: "bg-status-warning/10 text-status-warning",
  success: "bg-status-success/10 text-status-success",
  error: "bg-status-error/10 text-status-error",
};

export function SettingSection({ title, children, badge, action }: SettingSectionProps) {
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
      <div className="flex flex-col divide-y divide-border-subtle rounded-xl border border-border-subtle bg-bg-surface px-4">
        {children}
      </div>
    </section>
  );
}
