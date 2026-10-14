import { UsersThree } from "@phosphor-icons/react";

import { cn } from "@/shared/lib/utils";

import { useSharers } from "./useSharers";

/** The number of sessions in a shared worktree; renders nothing for a worktree of one session. */
export function SharersBadge({
  environmentId,
  className,
}: {
  environmentId: string | undefined;
  className?: string;
}) {
  const count = useSharers(environmentId);
  if (count < 2) return null;
  return (
    <span
      className={cn("flex shrink-0 items-center gap-0.5 tabular-nums", className)}
      title={`${count} sessions share this worktree`}
      aria-label={`${count} sessions share this worktree`}
    >
      <UsersThree size={11} className="shrink-0" />
      {count}
    </span>
  );
}
