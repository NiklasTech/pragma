"use client";

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
    <section className="flex flex-col rounded-xl border border-border bg-bg-surface px-4 py-3">
      <div className="flex items-center gap-2 pb-1">
        <h3 className="text-ui-sm font-semibold text-fg-default">{title}</h3>
        {badge && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-ui-xs ${BADGE_COLORS[badge.variant ?? "default"]}`}
          >
            {badge.label}
          </span>
        )}
      </div>
      <div className="flex flex-col divide-y divide-border/40">{children}</div>
    </section>
  );
}
