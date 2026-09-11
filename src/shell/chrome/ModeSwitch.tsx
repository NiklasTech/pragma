"use client";

import { useCallback } from "react";

import { cn } from "@/shared/lib/utils";
import { useUiMode, useUiModeStore, type UiMode } from "@/shell/mode";

const MODES: { id: UiMode; label: string }[] = [
  { id: "agents", label: "Agents" },
  { id: "editor", label: "Editor" },
];

export function ModeSwitch() {
  const uiMode = useUiMode();
  const setUiMode = useUiModeStore((state) => state.setUiMode);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();

      const index = MODES.findIndex((mode) => mode.id === uiMode);
      const offset = event.key === "ArrowRight" ? 1 : MODES.length - 1;
      setUiMode(MODES[(index + offset) % MODES.length].id);
    },
    [setUiMode, uiMode],
  );

  return (
    <div
      role="group"
      aria-label="Workspace mode"
      onKeyDown={handleKeyDown}
      className="flex h-7 items-center gap-0.5 rounded-pill border border-border/60 bg-bg-input p-0.5"
    >
      {MODES.map((mode) => {
        const isActive = uiMode === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => setUiMode(mode.id)}
            className={cn(
              "h-6 rounded-pill px-3 text-ui-xs font-semibold transition-colors duration-fast",
              isActive
                ? "bg-bg-elevated text-fg-default shadow-[var(--shadow-sm)]"
                : "text-fg-muted hover:text-fg-default",
            )}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
