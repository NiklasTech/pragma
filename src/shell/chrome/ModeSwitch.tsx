"use client";

import { useCallback } from "react";
import type { Icon } from "@phosphor-icons/react";
import { Code, Robot } from "@phosphor-icons/react";

import { cn } from "@/shared/lib/utils";
import { useUiMode, useUiModeStore, type UiMode } from "@/shell/mode";

const MODES: { id: UiMode; label: string; icon: Icon }[] = [
  { id: "agents", label: "Agents", icon: Robot },
  { id: "editor", label: "Editor", icon: Code },
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
      className="flex h-7 shrink-0 items-center gap-0.5"
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
              "flex h-7 items-center gap-1.5 rounded-full px-3 text-ui-xs font-semibold transition-colors duration-fast",
              isActive
                ? "bg-bg-elevated text-fg-default shadow-[var(--shadow-sm)] ring-1 ring-border [&>svg]:text-primary"
                : "text-fg-muted hover:bg-bg-hover hover:text-fg-default",
            )}
          >
            <mode.icon size={13} weight={isActive ? "fill" : "regular"} aria-hidden="true" />
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
