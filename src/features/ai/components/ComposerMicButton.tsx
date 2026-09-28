"use client";

import { useEffect, useRef } from "react";
import { Microphone } from "@phosphor-icons/react";

import { cn } from "@/shared/lib/utils";

interface ComposerMicButtonProps {
  recording: boolean;
  disabled?: boolean;
  onClick: () => void;
  /** Live microphone level; without it the button pulses while recording. */
  subscribeLevel?: (listener: (level: number) => void) => () => void;
}

export function ComposerMicButton({
  recording,
  disabled,
  onClick,
  subscribeLevel,
}: ComposerMicButtonProps) {
  const ringRef = useRef<HTMLSpanElement>(null);
  const metered = recording && Boolean(subscribeLevel);

  useEffect(() => {
    if (!metered || !subscribeLevel) return;
    // Styled directly so level updates do not re-render the composer.
    return subscribeLevel((level) => {
      const ring = ringRef.current;
      if (ring) {
        ring.style.transform = `scale(${1 + level * 0.8})`;
      }
    });
  }, [metered, subscribeLevel]);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={recording}
      aria-label={recording ? "Stop dictation" : "Dictate"}
      title={recording ? "Stop dictation" : "Dictate"}
      className={cn(
        "relative flex size-7 shrink-0 items-center justify-center rounded-full transition-colors",
        recording
          ? "bg-status-error/15 text-status-error hover:bg-status-error/25"
          : "text-fg-muted hover:bg-bg-hover hover:text-fg-default",
        recording && !metered && "animate-pulse",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      {metered && (
        <span
          ref={ringRef}
          aria-hidden
          data-slot="mic-level"
          className="pointer-events-none absolute inset-0 rounded-full bg-status-error/20 transition-transform duration-100 ease-out"
        />
      )}
      <Microphone size={13} weight={recording ? "fill" : "bold"} className="relative" />
    </button>
  );
}
