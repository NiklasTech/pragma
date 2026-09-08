"use client";

import { Brain, Check, DotsThree, Flame, MagicWand } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
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

type ModeToggle = {
  key: string;
  icon: Icon;
  label: string;
  description: string;
  visible: boolean;
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
};

export function ChatToolbar({ className }: ChatToolbarProps) {
  const yoloMode = useSettingsStore((state) => state.ai.yoloMode);
  const showThinking = useSettingsStore((state) => state.ai.showThinking);
  const setYoloMode = useSettingsStore((state) => state.setYoloMode);
  const setShowThinking = useSettingsStore((state) => state.setShowThinking);
  const agentEnabled = useSettingsStore((state) => state.agent.enabled);
  const agentModeActive = useAgentStore((state) => state.modeActive);
  const setAgentModeActive = useAgentStore((state) => state.setModeActive);

  const modes: ModeToggle[] = [
    {
      key: "agent",
      icon: MagicWand,
      label: "Agent mode",
      description: "Let the AI complete tasks autonomously with workspace tools",
      visible: agentEnabled,
      pressed: agentModeActive,
      onPressedChange: setAgentModeActive,
    },
    {
      key: "yolo",
      icon: Flame,
      label: "Yolo mode",
      description: "Auto-approve tool requests in this chat",
      visible: true,
      pressed: yoloMode,
      onPressedChange: setYoloMode,
    },
    {
      key: "thinking",
      icon: Brain,
      label: "Show thinking",
      description: "Show model reasoning blocks",
      visible: true,
      pressed: showThinking,
      onPressedChange: setShowThinking,
    },
  ].filter((mode) => mode.visible);

  return (
    <TooltipProvider delay={300}>
      <div className={cn("flex items-center gap-1", className)}>
        <div className="flex items-center gap-1 @max-[320px]:hidden">
          {modes.map((mode) => (
            <Tooltip key={mode.key}>
              <TooltipTrigger
                render={
                  <Toggle
                    size="sm"
                    variant="accent"
                    pressed={mode.pressed}
                    onPressedChange={mode.onPressedChange}
                    aria-label={mode.label}
                    type="button"
                  >
                    <mode.icon size={13} weight={mode.pressed ? "fill" : "bold"} />
                  </Toggle>
                }
              />
              <TooltipContent side="top" sideOffset={6}>
                <p>{mode.description}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        {modes.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  aria-label="Chat options"
                  className="hidden size-6 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default @max-[320px]:inline-flex"
                >
                  <DotsThree size={15} weight="bold" />
                </button>
              }
            />
            <DropdownMenuContent align="start" side="top" sideOffset={6} className="w-44">
              {modes.map((mode) => (
                <DropdownMenuItem
                  key={mode.key}
                  onClick={() => mode.onPressedChange(!mode.pressed)}
                  className="flex items-center gap-2"
                >
                  <mode.icon size={14} weight={mode.pressed ? "fill" : "bold"} />
                  <span className="flex-1">{mode.label}</span>
                  {mode.pressed && <Check size={13} weight="bold" className="text-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </TooltipProvider>
  );
}
