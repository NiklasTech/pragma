"use client";

import { Brain, Flame } from "@phosphor-icons/react";

import { Toggle } from "@/shared/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { useSettingsStore } from "@/shared/stores/settings";
import { cn } from "@/shared/lib/utils";

type ChatToolbarProps = {
  className?: string;
};

export function ChatToolbar({ className }: ChatToolbarProps) {
  const yoloMode = useSettingsStore((state) => state.ai.yoloMode);
  const showThinking = useSettingsStore((state) => state.ai.showThinking);
  const setYoloMode = useSettingsStore((state) => state.setYoloMode);
  const setShowThinking = useSettingsStore((state) => state.setShowThinking);

  return (
    <TooltipProvider delay={300}>
      <div className={cn("flex items-center gap-1", className)}>
        <Tooltip>
          <TooltipTrigger
            render={
              <Toggle
                size="sm"
                variant="accent"
                pressed={yoloMode}
                onPressedChange={setYoloMode}
                aria-label="Yolo mode"
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
