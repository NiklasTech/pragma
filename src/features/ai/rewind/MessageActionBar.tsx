"use client";

import type { ReactNode } from "react";

import { Button } from "@/shared/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";

/// Message-level actions that show while the message is hovered or focused.
export function MessageActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
      {children}
    </div>
  );
}

export function MessageActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        delay={300}
        aria-label={label}
        onClick={onClick}
        render={<Button variant="ghost" size="icon-xs" className="text-fg-subtle" />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
