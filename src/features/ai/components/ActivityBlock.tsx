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
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 text-left text-ui-xs text-fg-muted transition-colors hover:text-fg-default"
      >
        {icon && <span className="shrink-0">{icon}</span>}
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <CaretDown
          size={12}
          className={cn("shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div
          data-state={streaming ? "streaming" : "done"}
          className="mt-1 max-h-48 overflow-y-auto border-l border-border/40 pl-2 data-[state=streaming]:animate-pulse"
        >
          {children}
        </div>
      )}
    </div>
  );
}
