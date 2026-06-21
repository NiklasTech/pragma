"use client";

import type { ComponentProps, ReactNode } from "react";
import { useCallback } from "react";
import { ArrowDown, DownloadSimple } from "@phosphor-icons/react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";

import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

export type ConversationProps = ComponentProps<typeof StickToBottom>;

export const Conversation = ({ className, ...props }: ConversationProps) => (
  <StickToBottom
    className={cn("relative flex-1 overflow-y-hidden", className)}
    initial="smooth"
    resize="smooth"
    role="log"
    {...props}
  />
);

export type ConversationContentProps = ComponentProps<typeof StickToBottom.Content>;

export const ConversationContent = ({ className, ...props }: ConversationContentProps) => (
  <StickToBottom.Content className={cn("flex flex-col gap-5 p-4", className)} {...props} />
);

export type ConversationEmptyStateProps = ComponentProps<"div"> & {
  title?: string;
  description?: string;
  icon?: ReactNode;
};

export const ConversationEmptyState = ({
  className,
  title = "No messages yet",
  description = "Start a conversation to see messages here",
  icon,
  children,
  ...props
}: ConversationEmptyStateProps) => (
  <div
    className={cn(
      "flex size-full flex-col items-center justify-center gap-3 p-8 text-center",
      className,
    )}
    {...props}
  >
    {children ?? (
      <>
        {icon && <div className="text-fg-muted">{icon}</div>}
        <div className="space-y-1">
          <h3 className="text-sm font-medium">{title}</h3>
          {description && <p className="text-sm text-fg-muted">{description}</p>}
        </div>
      </>
    )}
  </div>
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
        "absolute bottom-3 left-1/2 size-7 -translate-x-1/2 rounded-full border-border/50 bg-bg-root/90 shadow-md backdrop-blur",
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

export type ConversationDownloadProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  onDownload: () => void;
};

export const ConversationDownload = ({
  onDownload,
  className,
  children,
  ...props
}: ConversationDownloadProps) => (
  <Button
    className={cn("absolute top-4 right-4 rounded-full bg-bg-root hover:bg-bg-hover", className)}
    onClick={onDownload}
    size="icon"
    type="button"
    variant="outline"
    {...props}
  >
    {children ?? <DownloadSimple size={16} />}
  </Button>
);
