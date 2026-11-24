import { cn } from "@/shared/lib/utils";

interface TabNumberProps {
  number: number;
  active: boolean;
  waiting: boolean;
}

/// The number of a tab; it lights up while an agent in the tab waits for an answer.
export function TabNumber({ number, active, waiting }: TabNumberProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-[15px] min-w-[15px] shrink-0 items-center justify-center rounded-[3px] px-0.5 text-[10.5px] ring-1 transition-[background-color,color,box-shadow] duration-(--motion-base) ring-inset",
        waiting
          ? "bg-state-needs-you font-semibold text-primary-foreground shadow-[0_0_8px_var(--color-accent-glow)] ring-transparent"
          : active
            ? "text-fg-default ring-fg-default/15"
            : "text-fg-subtle ring-fg-default/8",
      )}
    >
      {number}
    </span>
  );
}
