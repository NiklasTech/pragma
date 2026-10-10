"use client";

import { Stop, X } from "@phosphor-icons/react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

interface PaneCloseButtonProps {
  /** A running terminal asks whether its process stops with the pane. */
  runningTerminal: boolean;
  className: string;
  onClose: () => void;
  onCloseTerminal: (stop: boolean) => void;
}

export function PaneCloseButton({
  runningTerminal,
  className,
  onClose,
  onCloseTerminal,
}: PaneCloseButtonProps) {
  if (!runningTerminal) {
    return (
      <button
        type="button"
        onClick={onClose}
        aria-label="Close pane"
        title="Close pane"
        className={className}
      >
        <X size={13} />
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button type="button" aria-label="Close pane" title="Close pane" className={className}>
            <X size={13} />
          </button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-[200px]">
        <DropdownMenuItem variant="destructive" onClick={() => onCloseTerminal(true)}>
          <Stop size={13} />
          <span>Stop process and close</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onCloseTerminal(false)}>
          <X size={13} />
          <span>Close, keep running</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
