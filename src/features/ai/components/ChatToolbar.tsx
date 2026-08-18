"use client";

import { Brain, Flame, MagicWand } from "@phosphor-icons/react";

import { Toggle } from "@/shared/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { useSettingsStore } from "@/shared/stores/settings";
import { useAgentStore } from "@/features/agent/store";
import { cn } from "@/shared/lib/utils";

type ChatToolbarProps = {
  className?: string;
};

export function ChatToolbar({ className }: ChatToolbarProps) {
  const yoloMode = useSettingsStore((state) => state.ai.yoloMode);
  const showThinking = useSettingsStore((state) => state.ai.showThinking);
  const setYoloMode = useSettingsStore((state) => state.setYoloMode);
  const setShowThinking = useSettingsStore((state) => state.setShowThinking);
  const agentEnabled = useSettingsStore((state) => state.agent.enabled);
  const agentModeActive = useAgentStore((state) => state.modeActive);
  const setAgentModeActive = useAgentStore((state) => state.setModeActive);

  return (
    <TooltipProvider delay={300}>
      <div className={cn("flex items-center gap-1", className)}>
        {agentEnabled && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Toggle
                  size="sm"
                  variant="accent"
                  pressed={agentModeActive}
                  onPressedChange={setAgentModeActive}
                  aria-label="Agent mode"
                  type="button"
                >
                  <MagicWand size={13} weight={agentModeActive ? "fill" : "bold"} />
                  <span>Agent</span>
                </Toggle>
              }
            />
            <TooltipContent side="top" sideOffset={6}>
              <p>Let the AI complete tasks autonomously with workspace tools</p>
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger
            render={
              <Toggle
                size="sm"
                variant="accent"
                pressed={yoloMode}
                onPressedChange={setYoloMode}
                aria-label="Yolo mode"
                type="button"
              >
                <Flame size={13} weight={yoloMode ? "fill" : "bold"} />
                <span>Yolo</span>
              </Toggle>
            }
          />
          <TooltipContent side="top" sideOffset={6}>
            <p>Auto-approve tool requests in this chat</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Toggle
                size="sm"
                variant="accent"
                pressed={showThinking}
                onPressedChange={setShowThinking}
                aria-label="Show thinking"
                type="button"
              >
                <Brain size={13} weight={showThinking ? "fill" : "bold"} />
                <span>Thinking</span>
              </Toggle>
            }
          />
          <TooltipContent side="top" sideOffset={6}>
            <p>Show model reasoning blocks</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
