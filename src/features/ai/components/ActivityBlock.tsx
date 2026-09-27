"use client";

import { useState, type ReactNode } from "react";
import { CaretRight } from "@phosphor-icons/react";

import { cn } from "@/shared/lib/utils";
import { Shimmer } from "./Shimmer";

type ActivityBlockProps = {
  icon?: ReactNode;
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  streaming?: boolean;
  hint?: string;
};

export function ActivityBlock({
  icon,
  title,
  children,
  defaultOpen = false,
  streaming = false,
  hint,
}: ActivityBlockProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title={hint}
        className="group/activity -mx-2 flex min-h-7 items-center gap-2 rounded-md px-2 text-left text-ui-xs text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
      >
        {icon && <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>}
        <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
          {streaming && typeof title === "string" ? (
            <Shimmer as="span" className="max-w-full truncate" duration={1.4}>
              {title}
            </Shimmer>
          ) : (
            title
          )}
        </span>
        <CaretRight
          size={11}
          weight="bold"
          className={cn(
            "shrink-0 text-fg-subtle opacity-0 transition-[transform,opacity] group-hover/activity:opacity-100",
            open && "rotate-90 opacity-100",
          )}
        />
      </button>
      {open && (
        <div
          data-state={streaming ? "streaming" : "done"}
          className="mt-1 mb-1 ml-2 max-h-56 overflow-y-auto border-l border-border pl-4"
        >
          {children}
        </div>
      )}
    </div>
  );
}
