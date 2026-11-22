import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

import type { SetupSection } from "./setupSections";

interface SetupBlockProps {
  section: SetupSection;
  index: number;
  focused: boolean;
  onFocus: () => void;
  children: ReactNode;
}

/// One section of the setup page, headed like a command block; the focused one glows.
export function SetupBlock({ section, index, focused, onFocus, children }: SetupBlockProps) {
  return (
    <section
      aria-label={section}
      onPointerDown={onFocus}
      onFocusCapture={onFocus}
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-well bg-bg-surface ring-1 transition-shadow duration-(--motion-base) ease-(--motion-ease) ring-inset",
        focused ? "shadow-[0_0_0_3px_var(--color-accent-glow)] ring-primary" : "ring-border-subtle",
      )}
    >
      <div className="flex shrink-0 items-center gap-2.5 border-b border-border-subtle px-3.5 py-2.5 font-mono text-ui-xs text-fg-subtle">
        <span className="text-primary">›</span>
        <span>pragma setup {section}</span>
        <span className="ml-auto">{index + 1}</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3.5">{children}</div>
    </section>
  );
}
