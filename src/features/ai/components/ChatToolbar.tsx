"use client";

import { CaretDown, ChatCircle, MagicWand } from "@phosphor-icons/react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { cn } from "@/shared/lib/utils";
import { useAgentStore } from "@/features/agent/store";
import { useSettingsStore } from "@/shared/stores/settings";

export function ChatToolbar() {
  const yoloMode = useSettingsStore((state) => state.ai.yoloMode);
  const showThinking = useSettingsStore((state) => state.ai.showThinking);
  const setYoloMode = useSettingsStore((state) => state.setYoloMode);
  const setShowThinking = useSettingsStore((state) => state.setShowThinking);
  const agentEnabled = useSettingsStore((state) => state.agent.enabled);
  const agentModeActive = useAgentStore((state) => state.modeActive);
  const setAgentModeActive = useAgentStore((state) => state.setModeActive);

  const agentMode = agentEnabled && agentModeActive;
  const ModeIcon = agentMode ? MagicWand : ChatCircle;
  const modeLabel = agentMode ? "Agent" : "Ask";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Mode: ${modeLabel}`}
            title={modeLabel}
            className={cn(
              "flex h-7 items-center gap-1 rounded-lg px-2 text-ui-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              agentMode
                ? "bg-primary/10 text-primary hover:bg-primary/15"
                : "text-fg-muted hover:bg-bg-hover hover:text-fg-default",
            )}
          >
            <ModeIcon size={13} weight={agentMode ? "fill" : "bold"} className="shrink-0" />
            <span className="@max-[320px]:hidden">{modeLabel}</span>
            <CaretDown
              size={10}
              weight="bold"
              className={cn(
                "shrink-0 @max-[320px]:hidden",
                agentMode ? "text-primary/70" : "text-fg-subtle",
              )}
            />
          </button>
        }
      />
      <DropdownMenuContent align="start" side="top" sideOffset={6} className="w-48">
        <DropdownMenuRadioGroup
          value={agentMode ? "agent" : "ask"}
          onValueChange={(value) => setAgentModeActive(value === "agent")}
        >
          <DropdownMenuRadioItem value="ask">Ask</DropdownMenuRadioItem>
          {agentEnabled && <DropdownMenuRadioItem value="agent">Agent</DropdownMenuRadioItem>}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked={yoloMode} onCheckedChange={setYoloMode}>
          Auto-approve
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={showThinking} onCheckedChange={setShowThinking}>
          Show thinking
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
