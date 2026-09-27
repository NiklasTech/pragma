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
  meta?: ReactNode;
};

export function ActivityBlock({
  icon,
  title,
  children,
  defaultOpen = false,
  streaming = false,
  hint,
  meta,
}: ActivityBlockProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="flex animate-in flex-col duration-200 fade-in-0 slide-in-from-bottom-1 motion-reduce:animate-none">
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
          {meta && <span className="shrink-0 text-fg-subtle tabular-nums">{meta}</span>}
        </span>
        <CaretRight
          size={11}
          weight="bold"
          className={cn(
            "shrink-0 text-fg-subtle opacity-50 transition-[transform,opacity] group-hover/activity:opacity-100",
            open && "rotate-90 opacity-100",
          )}
        />
      </button>
      {open && (
        <div
          data-state={streaming ? "streaming" : "done"}
          className="mt-1 mb-1 ml-2 max-h-56 animate-in overflow-y-auto border-l border-border pl-4 duration-200 fade-in-0 slide-in-from-top-1 motion-reduce:animate-none"
        >
          {children}
        </div>
      )}
    </div>
  );
}
