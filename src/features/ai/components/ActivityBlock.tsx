"use client";

import { useState, type ReactNode } from "react";
import { CaretDown } from "@phosphor-icons/react";

import { cn } from "@/shared/lib/utils";

type ActivityBlockProps = {
  icon?: ReactNode;
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  streaming?: boolean;
};

export function ActivityBlock({
  icon,
  title,
  children,
  defaultOpen = false,
  streaming = false,
}: ActivityBlockProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="my-2 overflow-hidden rounded-sm border border-border bg-[color-mix(in_srgb,var(--bg-hover)_30%,transparent)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left outline-none transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] hover:bg-[color-mix(in_srgb,var(--bg-hover)_50%,transparent)] focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.98]"
      >
        <span className="flex min-w-0 items-center gap-1.5 text-ui-xs text-fg-muted">
          {icon && <span className="shrink-0">{icon}</span>}
          <span className="min-w-0 truncate">{title}</span>
        </span>
        <CaretDown
          size={12}
          className={cn("shrink-0 text-fg-muted transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div
          data-state={streaming ? "streaming" : "done"}
          className="max-h-48 overflow-y-auto border-t border-border px-3 py-2 data-[state=streaming]:animate-pulse"
        >
          {children}
        </div>
      )}
    </div>
  );
}
