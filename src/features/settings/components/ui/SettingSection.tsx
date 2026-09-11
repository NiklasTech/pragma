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
  default: "text-fg-muted",
  warning: "text-status-warning",
  success: "text-status-success",
  error: "text-status-error",
};

export function SettingSection({ title, children, badge }: SettingSectionProps) {
  return (
    <section className="flex flex-col">
      <div className="flex items-baseline gap-2 pb-1">
        <h3 className="text-ui-xs font-semibold tracking-wide text-fg-muted uppercase">{title}</h3>
        {badge && (
          <span className={`text-ui-xs normal-case ${BADGE_COLORS[badge.variant ?? "default"]}`}>
            {badge.label}
          </span>
        )}
      </div>
      <div className="flex flex-col divide-y divide-border">{children}</div>
    </section>
  );
}
