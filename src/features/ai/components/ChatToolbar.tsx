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
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { useAgentStore } from "@/features/agent/store";
import { useSettingsStore } from "@/shared/stores/settings";

export function ChatToolbar() {
  const yoloMode = useSettingsStore((state) => state.ai.yoloMode);
  const showThinking = useSettingsStore((state) => state.ai.showThinking);
  const setYoloMode = useSettingsStore((state) => state.setYoloMode);
  const setShowThinking = useSettingsStore((state) => state.setShowThinking);
  const agentModeActive = useAgentStore((state) => state.modeActive);
  const setAgentModeActive = useAgentStore((state) => state.setModeActive);

  const agentMode = agentModeActive;
  const ModeIcon = agentMode ? MagicWand : ChatCircle;
  const modeLabel = agentMode ? "Agent" : "Ask";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Mode: ${modeLabel}`}
            title={modeLabel}
            className={cn(
              "h-7 gap-1.5 rounded-full px-2.5",
              agentMode && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
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
          </Button>
        }
      />
      <DropdownMenuContent align="start" side="top" sideOffset={6} className="w-48">
        <DropdownMenuRadioGroup
          value={agentMode ? "agent" : "ask"}
          onValueChange={(value) => setAgentModeActive(value === "agent")}
        >
          <DropdownMenuRadioItem value="ask">Ask</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="agent">Agent</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked={yoloMode} onCheckedChange={setYoloMode}>
          Auto-approve
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={showThinking} onCheckedChange={setShowThinking}>
          Expand thinking
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
