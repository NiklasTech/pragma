"use client";

import { Microphone } from "@phosphor-icons/react";

import { cn } from "@/shared/lib/utils";

interface ComposerMicButtonProps {
  recording: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function ComposerMicButton({ recording, disabled, onClick }: ComposerMicButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={recording}
      aria-label={recording ? "Stop dictation" : "Dictate"}
      title={recording ? "Stop dictation" : "Dictate"}
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md transition-colors",
        recording
          ? "bg-status-error text-fg-inverse hover:bg-status-error/90"
          : "text-fg-muted hover:bg-bg-hover hover:text-fg-default",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      <Microphone size={13} weight={recording ? "fill" : "bold"} />
    </button>
  );
}
