"use client";

import { useState, type ReactNode } from "react";
import { CaretDown } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

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
    <div className="my-2 overflow-hidden rounded-md border border-border/40 bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-muted/50"
      >
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          {icon && <span className="shrink-0">{icon}</span>}
          <span className="min-w-0 truncate">{title}</span>
        </span>
        <CaretDown
          size={12}
          className={cn(
            "shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div
          data-state={streaming ? "streaming" : "done"}
          className="border-t border-border/30 px-3 py-2 data-[state=streaming]:animate-pulse"
        >
          {children}
        </div>
      )}
    </div>
  );
}
