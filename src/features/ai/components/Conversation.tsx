"use client";

import type { ComponentProps } from "react";
import { useCallback } from "react";
import { ArrowDown } from "@phosphor-icons/react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";

import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { useReducedMotion } from "@/theme/useReducedMotion";

export type ConversationProps = ComponentProps<typeof StickToBottom>;

export const Conversation = ({ className, ...props }: ConversationProps) => {
  const motion = useReducedMotion() ? "instant" : "smooth";
  return (
    <StickToBottom
      className={cn("relative flex-1 overflow-y-hidden", className)}
      initial={motion}
      resize={motion}
      role="log"
      {...props}
    />
  );
};

export type ConversationContentProps = ComponentProps<typeof StickToBottom.Content>;

export const ConversationContent = ({ className, ...props }: ConversationContentProps) => (
  <StickToBottom.Content
    className={cn("mx-auto flex w-full max-w-3xl min-h-full flex-col gap-6 px-4 py-5", className)}
    {...props}
  />
);

export type ConversationScrollButtonProps = ComponentProps<typeof Button>;

export const ConversationScrollButton = ({
  className,
  ...props
}: ConversationScrollButtonProps) => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  const handleScrollToBottom = useCallback(() => {
    void scrollToBottom();
  }, [scrollToBottom]);

  if (isAtBottom) return null;

  return (
    <Button
      className={cn(
        "absolute bottom-3 left-1/2 size-7 -translate-x-1/2 rounded-full border-border bg-bg-root shadow-md",
        className,
      )}
      onClick={handleScrollToBottom}
      size="icon"
      type="button"
      variant="outline"
      {...props}
    >
      <ArrowDown size={13} weight="bold" />
    </Button>
  );
};
